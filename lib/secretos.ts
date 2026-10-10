import 'server-only';
import { servicio, hayClaveDeServicio } from '@/lib/supabase-servidor';

/*
 * Las llaves que se ingresan desde el panel.
 *
 * Viven cifradas en la bóveda de Supabase (vault.secrets). El panel las
 * ESCRIBE y nunca las lee: la función que devuelve el valor está concedida
 * solo a service_role, así que desde el navegador no hay forma de sacarlas,
 * ni siquiera siendo administrador.
 *
 * Por qué no en variables de entorno: porque cambiar una obliga a redesplegar,
 * y porque Tony no debería tener que entrar a Vercel para rotar una llave.
 * La única que SÍ tiene que vivir en el entorno es SUPABASE_SECRET_KEY, que es
 * la que abre la base — no puede guardarse dentro de lo que ella misma abre.
 *
 * El entorno sigue sirviendo de respaldo: si una llave está en las dos partes,
 * manda la de la bóveda. Así se puede migrar sin apagar nada.
 */

/* Dentro de una misma petición la misma llave se pide varias veces (el correo
   de confirmación, el de aviso al equipo...). Una sola ida a la base. */
const enEstaPeticion = new Map<string, Promise<string | null>>();

async function desdeLaBoveda(nombre: string): Promise<string | null> {
  if (!hayClaveDeServicio()) return null;
  try {
    const { data, error } = await servicio().rpc('valor_de_secreto', { p_nombre: nombre });
    if (error) {
      console.error(`valor_de_secreto(${nombre}):`, error.message);
      return null;
    }
    const valor = typeof data === 'string' ? data.trim() : '';
    return valor.length >= 8 ? valor : null;
  } catch (fallo) {
    console.error(`valor_de_secreto(${nombre}):`, fallo instanceof Error ? fallo.message : fallo);
    return null;
  }
}

/**
 * El valor de una llave: primero la bóveda, y si no está, el entorno.
 *
 * Nunca devuelve una cadena vacía ni un marcador a medias: o hay algo
 * utilizable, o es null. Una llave recortada al pegarla se ve puesta y falla
 * en el momento de mandar, que es el peor momento para enterarse.
 */
export async function secreto(nombre: string): Promise<string | null> {
  const guardado = enEstaPeticion.get(nombre);
  if (guardado) return guardado;

  const busqueda = (async () => {
    const deLaBoveda = await desdeLaBoveda(nombre);
    if (deLaBoveda) return deLaBoveda;

    const delEntorno = process.env[nombre]?.trim();
    if (delEntorno && delEntorno.length >= 8 && !delEntorno.includes('...')) return delEntorno;

    return null;
  })();

  enEstaPeticion.set(nombre, busqueda);
  /* El mapa es de módulo, no de petición: en un servidor que vive mucho, una
     llave rotada seguiría sirviendo la vieja. Se suelta enseguida. */
  busqueda.finally(() => enEstaPeticion.delete(nombre)).catch(() => {});
  return busqueda;
}
