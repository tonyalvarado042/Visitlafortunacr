import { notFound } from 'next/navigation';
import { destinoActual } from '@/lib/destino';
import { esIdioma } from '@/lib/idiomas';
import type { Metadata } from 'next';
import { Concierge } from '@/componentes/Concierge';

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
      alternates: {
        languages: Object.fromEntries(destino.idiomas.map((i) => [i, `/${i}`])),
      },
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

  // La marca del destino entra como variables CSS. Es lo que permite que otro
  // destino tenga otra paleta sin tocar una línea de estilos.
  const paleta = {
    '--negro': destino.color_tinta,
    '--naranja': destino.color_acento,
    '--verde': destino.color_naturaleza,
    '--gris': destino.color_gris,
    '--fuente': `'${destino.tipografia}', -apple-system, 'Helvetica Neue', Arial, sans-serif`,
  } as React.CSSProperties;

  return (
    <div style={paleta}>
      {children}
      <Concierge idioma={idioma} marca={destino.marca_nombre} />
    </div>
  );
}
