import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { esIdioma } from '@/lib/idiomas';
import { destinoActual } from '@/lib/destino';
import './globales.css';

export const metadata: Metadata = {
  title: 'Visit La Fortuna CR',
  description: 'Todo lo que necesitás para vivir La Fortuna.',
};

export default async function RaizLayout({ children }: { children: React.ReactNode }) {
  /* El idioma lo pone el middleware en la peticion: ver middleware.ts. Las
     areas sin idioma en la ruta —/admin, /negocio— caen a español, que es el
     idioma en el que estan escritas. */
  const cabeceras = await headers();
  const pedido = cabeceras.get('x-idioma') ?? '';
  const idioma = esIdioma(pedido) ? pedido : 'es';
  /* El tema sale del destino, y ?tema= lo pisa SOLO para esa visita — para
     mirar como queda antes de cambiarlo de verdad. Si la base no se alcanza,
     claro: es lo que hay configurado, y un sitio en blanco se lee igual
     aunque el resto falle. */
  let tema = 'claro';
  let barraOscura = true;
  try {
    const destino = await destinoActual();
    tema = destino.tema ?? 'claro';
    barraOscura = destino.barra_oscura !== false;
  } catch { /* se queda con lo de arriba */ }

  const pisado = cabeceras.get('x-tema');
  if (pisado === 'claro' || pisado === 'oscuro') tema = pisado;

  return (
    <html lang={idioma} data-tema={tema} data-barra={barraOscura ? 'oscura' : undefined}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
