import { createClient } from '@supabase/supabase-js';

/*
 * La clave publicable NO es un secreto: viaja al navegador por diseño y solo
 * puede hacer lo que permitan las políticas de acceso, que dejan leer contenido
 * publicado y nada más. Escribir pasa por registrar_solicitud. Por eso puede ir
 * como respaldo en el código: el sitio despliega y funciona sin configurar
 * nada, y las variables de entorno siguen mandando cuando existen, que es como
 * se apunta a otra base sin tocar el código.
 *
 * La clave de servicio, esa sí secreta, no aparece en ninguna parte del sitio.
 */
const URL_POR_DEFECTO = 'https://eulkufetcymallfbpone.supabase.co';
const CLAVE_POR_DEFECTO = 'sb_publishable_1xWCcuzd0tCpcYCo8O5Ceg_nMnxx6pt';

function crear() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || URL_POR_DEFECTO;
  const clave = process.env.NEXT_PUBLIC_SUPABASE_KEY || CLAVE_POR_DEFECTO;
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
