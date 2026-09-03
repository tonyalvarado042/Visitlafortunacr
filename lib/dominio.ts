/**
 * De qué destino es una petición, según el Host. En desarrollo y en las URLs
 * de vista previa de Vercel el Host no es un dominio real, así que se cae al
 * destino por defecto. Mismo criterio que lib/destino.ts, compartido para que
 * las rutas de API no lo repitan.
 */
export function dominioDeHost(host: string | null | undefined): string {
  const limpio = (host ?? '').split(':')[0].replace(/^www\./, '').toLowerCase();
  const desdeEntorno = process.env.NEXT_PUBLIC_DOMINIO_POR_DEFECTO?.trim();
  const porDefecto =
    desdeEntorno && desdeEntorno.includes('.') && !desdeEntorno.includes('...') ? desdeEntorno : 'visitlafortunacr.com';
  const esLocal =
    !limpio || limpio === 'localhost' || limpio.endsWith('.vercel.app') || /^\d+\.\d+\.\d+\.\d+$/.test(limpio);
  return esLocal ? porDefecto : limpio;
}
