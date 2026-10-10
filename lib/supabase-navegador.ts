'use client';

import { createBrowserClient } from '@supabase/ssr';
import { credencialesPublicas } from './credenciales-publicas';

/*
 * El cliente que corre EN EL NAVEGADOR, con la sesión de quien está usando el
 * sitio. Existe por una sola razón: subir fotos.
 *
 * Las fotos no pueden pasar por el servidor del sitio. Un server action corta
 * el cuerpo en 1 MB y Vercel lo corta en 4.5 MB pase lo que pase: una sola
 * foto de teléfono no cabe, y cinco menos. Así que el navegador las encoge y
 * las sube derecho a Storage, donde las políticas de la migración 25 deciden
 * si esta persona puede escribir en esa carpeta.
 *
 * Lee la misma cookie que el servidor, así que no hay dos sesiones: es la
 * misma vista desde el otro lado.
 */
let guardado: ReturnType<typeof createBrowserClient> | null = null;

export function navegador() {
  if (!guardado) {
    const { url, clave } = credencialesPublicas();
    guardado = createBrowserClient(url, clave, { db: { schema: 'destinos' } });
  }
  return guardado;
}
