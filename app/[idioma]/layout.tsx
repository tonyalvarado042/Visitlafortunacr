import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { destinoActual } from '@/lib/destino';
import { esIdioma, type Idioma } from '@/lib/idiomas';
import { alternativas, mismasRutas } from '@/lib/seo';
import type { Metadata } from 'next';
import { Concierge } from '@/componentes/Concierge';
import { AvisoSorteo } from '@/componentes/AvisoSorteo';
import { sorteoDe } from '@/lib/sorteo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: { params: Promise<{ idioma: string }> }): Promise<Metadata> {
  const { idioma } = await params;
  try {
    const destino = await destinoActual();
    return {
      title: { default: destino.marca_nombre, template: `%s · ${destino.marca_nombre}` },
      description: destino.lema ?? undefined,
      /* metadataBase convierte las rutas relativas de abajo en direcciones
         completas. Sin el, hreflang sale con "/en" y Google lo ignora. */
      metadataBase: new URL(`https://${destino.dominio}`),
      alternates: alternativas(idioma as Idioma, mismasRutas(destino, '')),
      /* El ícono de la pestaña sale del destino, igual que el logo de la
         barra. Si no tiene uno propio manda el app/icon.png del repo, que
         además cubre lo que vive fuera de /[idioma] —el panel, los errores—
         y así ninguna pestaña se queda con el globito genérico. */
      ...(destino.favicon_url ? { icons: { icon: destino.favicon_url } } : {}),
      openGraph: {
        siteName: destino.marca_nombre,
        locale: idioma,
        type: 'website',
      },
    };
  } catch {
    return { title: 'Visit' };
  }
}

export default async function LayoutIdioma({
  children, params,
}: {
  children: React.ReactNode;
  params: Promise<{ idioma: string }>;
}) {
  const { idioma } = await params;
  if (!esIdioma(idioma)) notFound();

  const destino = await destinoActual();
  if (!destino.idiomas.includes(idioma)) notFound();

  /* El aviso de la rifa vive aca y no en la portada: el que entra por una
     ficha o por el blog cuenta igual, y son la mayoria. Si no hay sorteo
     encendido, `sorteoDe` vuelve null y no se monta nada. */
  const cabeceras = await headers();
  const vistaPrevia = cabeceras.get('x-vista') === '1';
  const sorteo = await sorteoDe(destino, vistaPrevia, idioma);

  /* La marca del destino entra como variables CSS. Es lo que permite que otro
     destino tenga otra paleta sin tocar una línea de estilos.

     ⚠️ `color_tinta` y `color_gris` solo entran con el tema OSCURO. Un estilo
     en línea le gana a `:root[data-tema="claro"]`, así que inyectarlos aquí
     deshacía el tema claro de este div para abajo: el `body` quedaba blanco
     —está fuera— pero cada `section.zona` volvía a pintarse de negro. Se veía
     como "la portada sigue negra" y no había forma de deducirlo leyendo el
     CSS, porque el CSS estaba bien.

     Los acentos sí entran siempre: el naranja y el verde son los mismos en los
     dos temas. */
  const oscuro = (cabeceras.get('x-tema') ?? destino.tema ?? 'claro') === 'oscuro';
  const paleta = {
    ...(oscuro ? { '--negro': destino.color_tinta, '--gris': destino.color_gris } : {}),
    '--naranja': destino.color_acento,
    '--verde': destino.color_naturaleza,
    '--fuente': `'${destino.tipografia}', -apple-system, 'Helvetica Neue', Arial, sans-serif`,
  } as React.CSSProperties;

  return (
    <div style={paleta}>
      {children}
      {/* El aviso decide solo cuando salir y cuando callarse: ver el
          componente. Aca solo se le pasa la configuracion del panel. */}
      {sorteo && sorteo.aviso_activo && <AvisoSorteo sorteo={sorteo} idioma={idioma} />}
      {/* Se apaga desde Ajustes. Ni se monta: apagado no deja ni el botón. */}
      {destino.chat_activo && (
        <Concierge idioma={idioma} marca={destino.marca_nombre} dominio={destino.dominio} />
      )}
    </div>
  );
}
