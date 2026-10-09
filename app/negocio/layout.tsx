import type { Metadata } from 'next';
import { destinoActual, categoriasDe } from '@/lib/destino';
import { esIdioma, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mi negocio',
  // Nada de esto va a buscadores: es el panel privado de cada comercio.
  robots: { index: false, follow: false },
};

/*
 * El panel del COMERCIANTE. Vive en /negocio y no en /admin a propósito: el
 * dueño de un hotel no tiene por qué poder asomarse a los leads, los viajeros
 * o los reportes del equipo.
 *
 * Pero usa LA MISMA barra y el MISMO pie que el resto del sitio. Antes tenía
 * una barra propia, con el logo dibujado y sin menú, y el dueño quedaba
 * encerrado en su ficha sin poder navegar el directorio como cualquier otro.
 *
 * El destino se resuelve por el Host igual que en el sitio público: a /negocio
 * se llega por visitlafortunacr.com, así que la barra puede mostrar el emblema
 * y los colores que correspondan — y el día que entre otro destino, los suyos.
 */
export default async function LayoutComercio({ children }: { children: React.ReactNode }) {
  const destino = await destinoActual();
  const idioma: Idioma = esIdioma(destino.idioma_principal) ? destino.idioma_principal : 'es';
  const categorias = await categoriasDe(destino, idioma);

  /* La paleta del destino, igual que en /[idioma]/layout.tsx. Sin esto el
     panel se pintaría con los colores de respaldo del CSS en vez de los
     suyos. */
  const paleta = {
    '--negro': destino.color_tinta,
    '--naranja': destino.color_acento,
    '--verde': destino.color_naturaleza,
    '--gris': destino.color_gris,
    '--fuente': `'${destino.tipografia}', -apple-system, 'Helvetica Neue', Arial, sans-serif`,
  } as React.CSSProperties;

  return (
    <div style={paleta} className="comercio">
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual="" />
      <main className="comercio-cuerpo">{children}</main>
      <Pie destino={destino} />
    </div>
  );
}
