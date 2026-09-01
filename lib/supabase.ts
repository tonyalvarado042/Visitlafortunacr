import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.NEXT_PUBLIC_SUPABASE_KEY;

if (!url || !clave) {
  throw new Error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_KEY. Copiá .env.example a .env.local.'
  );
}

/**
 * Cliente contra el esquema `destinos`. La clave publicable viaja al navegador
 * a propósito: solo puede hacer lo que permitan las políticas de acceso, que
 * dejan leer contenido publicado y nada más. Escribir pasa por la función
 * registrar_solicitud, nunca por INSERT directo.
 */
export const supabase = createClient(url, clave, {
  db: { schema: 'destinos' },
  auth: { persistSession: false },
});
