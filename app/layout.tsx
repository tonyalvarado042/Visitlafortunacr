import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { esIdioma } from '@/lib/idiomas';
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
  /* El tema claro, por ahora solo con ?tema=claro. Cuando se decida encender
     para todos, esto pasa a salir del destino y el parametro queda como
     vista previa. */
  const tema = cabeceras.get('x-tema') === 'claro' ? 'claro' : undefined;

  return (
    <html lang={idioma} data-tema={tema}>
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
