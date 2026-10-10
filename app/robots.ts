import type { MetadataRoute } from 'next';
import { destinoActual } from '@/lib/destino';

export const dynamic = 'force-dynamic';

/*
 * El panel y las áreas con sesión no tienen nada que hacer en un buscador:
 * no son contenido, y rastrearlas gasta el presupuesto de rastreo en páginas
 * que de todas formas rebotan a la pantalla de entrar.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const destino = await destinoActual();
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/admin/', '/negocio', '/negocio/', '/api/'],
    }],
    sitemap: `https://${destino.dominio}/sitemap.xml`,
    host: `https://${destino.dominio}`,
  };
}
