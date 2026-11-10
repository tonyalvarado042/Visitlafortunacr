import type { NextConfig } from 'next';
import { LIMITE_ACCION_ETIQUETA } from './lib/limites';

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  experimental: {
    serverActions: {
      /* ⚠️ SIN ESTO EL TOPE ES 1 MB Y SUBIR UNA FOTO ROMPE LA PANTALLA.
         No es un ajuste de rendimiento: era el bug que encontró Tony el 10 de
         noviembre de 2026 subiendo la primera foto de Bike & Bed. El servidor
         CANCELA el cuerpo antes de que la acción corra y contesta 500, así que
         no quedaba ni un log para seguirle el rastro.
         El número y el porqué están en `lib/limites.ts`, de donde sale — se
         importa en vez de copiarse para que no se puedan separar: el navegador
         usa el mismo valor para avisar antes de mandar. */
      bodySizeLimit: LIMITE_ACCION_ETIQUETA,
    },
  },
};

export default config;
