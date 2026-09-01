import { createClient } from '@supabase/supabase-js';

/*
 * La clave publicable NO es un secreto: viaja al navegador por diseño y solo
 * puede hacer lo que permitan las políticas de acceso, que dejan leer contenido
 * publicado y nada más. Escribir pasa por registrar_solicitud. Por eso puede ir
 * como respaldo en el código: el sitio funciona sin configurar nada, y las
 * variables de entorno mandan cuando traen un valor de verdad.
 *
 * La clave de servicio, esa sí secreta, no aparece en ninguna parte del sitio.
 */
const URL_POR_DEFECTO = 'https://eulkufetcymallfbpone.supabase.co';
const CLAVE_POR_DEFECTO = 'sb_publishable_1xWCcuzd0tCpcYCo8O5Ceg_nMnxx6pt';

/*
 * Al importar un repo, Vercel ofrece como variables lo que encuentra en el
 * archivo de ejemplo, donde los valores son marcadores incompletos. Aceptar
 * eso deja el sitio con una clave que no existe y todo falla con un error de
 * render sin detalle. Así que una variable solo gana si trae algo que puede
 * ser una credencial real.
 */
function utilizable(valor: string | undefined): valor is string {
  if (!valor) return false;
  const limpio = valor.trim();
  return limpio.length >= 30 && !limpio.includes('...') && !limpio.endsWith('…');
}

function crear() {
  const url = utilizable(process.env.NEXT_PUBLIC_SUPABASE_URL)
    ? process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
    : URL_POR_DEFECTO;

  const clave = utilizable(process.env.NEXT_PUBLIC_SUPABASE_KEY)
    ? process.env.NEXT_PUBLIC_SUPABASE_KEY!.trim()
    : CLAVE_POR_DEFECTO;

  return createClient(url, clave, {
    db: { schema: 'destinos' },
    auth: { persistSession: false },
  });
}

type ClienteDestinos = ReturnType<typeof crear>;

let cliente: ClienteDestinos | null = null;

/* Perezoso: se crea al primer uso y no al importar, para que el build no
   dependa de que las variables estén puestas en el entorno de compilación. */
export const supabase = new Proxy({} as ClienteDestinos, {
  get(_objetivo, propiedad) {
    cliente ??= crear();
    const valor = Reflect.get(cliente, propiedad);
    return typeof valor === 'function' ? valor.bind(cliente) : valor;
  },
});
