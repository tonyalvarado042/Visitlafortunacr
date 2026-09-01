import type { Metadata } from 'next';
import './globales.css';

export const metadata: Metadata = {
  title: 'Visit La Fortuna CR',
  description: 'Todo lo que necesitás para vivir La Fortuna.',
};

export default function RaizLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
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
