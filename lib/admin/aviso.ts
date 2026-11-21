import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

/*
 * Que el panel diga cuando un guardado rebotó.
 *
 * ⚠️ POR QUÉ EXISTE. El 21 de noviembre de 2026 Tony escribió, ya enojado:
 * *«va de nuevo, le pongo admin y siempre vuelve al vendedor… te dije que
 * debés probar todo sin pretextos, son demasiados errores en VLF»*.
 *
 * No eran muchos errores distintos. Era UNO, cuarenta veces:
 *
 *     const { error } = await db.from(...).update(...);
 *     if (error) console.error('loquesea:', error.message);
 *
 * Cuarenta acciones del panel, en once archivos, hacían exactamente eso: el
 * error se va a los registros del servidor —donde Tony no entra nunca— y la
 * pantalla no cambia NADA.
 *
 * Y lo que lo vuelve venenoso: después de una acción de servidor el
 * formulario NO se vuelve a montar (medido en el navegador). O sea que el
 * `<select>` sigue mostrando lo que la persona eligió, haya guardado o no:
 *
 *   - guarda bien  → se ve «Administrador». Correcto.
 *   - falla        → se ve «Administrador» IGUAL. Mentira.
 *
 * Las dos pantallas son idénticas. La persona se va tranquila, vuelve al rato
 * y encuentra «Vendedor». De ahí el *«siempre vuelve al vendedor»*: nunca
 * guardó, y la pantalla se lo ocultó.
 *
 * ⚠️ POR QUÉ UNA REDIRECCIÓN Y NO ALGO MÁS FINO. Se probaron dos caminos
 * antes, los dos EN EL NAVEGADOR, y los dos fallaron:
 *
 *   1. Leer el aviso en el layout, del lado del servidor. El servidor lo
 *      dibujaba —quedó en los registros: «leyendo. hay galleta? true»— y el
 *      navegador NUNCA lo aplicaba: después de una acción, Next le manda solo
 *      el pedazo de la PÁGINA que cambió, no el layout.
 *   2. Una galleta legible desde el navegador. El servidor la escribía
 *      —«galleta escrita OK»— y al navegador no le llegaba nunca.
 *
 * Una redirección sí llega siempre, porque es una navegación de verdad. Y
 * además es el patrón que ESTE panel ya usaba: la pantalla de tours lee
 * `?fallo=` desde hace rato. Antes de inventar algo nuevo, se mira si ya
 * existe.
 */

/** El parámetro que lleva el mensaje. Lo lee `AvisoDeGuardado`. */
export const PARAM_FALLO = 'fallo';

/**
 * Lo llama una acción cuando la base devolvió error. **No vuelve nunca**:
 * corta ahí y manda a la misma pantalla con el mensaje a la vista.
 *
 * El mensaje va tal cual lo dio la base, sin maquillar: un «violates check
 * constraint ck_contrato_listo_para_cobrar» es feo, pero dice la verdad y se
 * puede buscar. Un «algo salió mal» no sirve para nada.
 */
export async function anotarFallo(donde: string, mensaje: string): Promise<never> {
  console.error(`${donde}: ${mensaje}`);
  const texto = `No se pudo guardar (${donde}): ${mensaje}`.slice(0, 300);

  /* A dónde volver: la pantalla desde la que se apretó el botón. Si no viene,
     al panel. Se limpia cualquier `fallo` viejo para no encadenar mensajes. */
  let destino = '/admin';
  try {
    const cabeceras = await headers();
    const ref = cabeceras.get('referer');
    if (ref) {
      const u = new URL(ref);
      /* Solo rutas del propio panel: el `referer` lo manda quien llama, así
         que nunca se redirige a un sitio de afuera. */
      if (u.pathname.startsWith('/admin')) {
        u.searchParams.delete(PARAM_FALLO);
        destino = u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : '');
      }
    }
  } catch { /* con el respaldo alcanza */ }

  const sep = destino.includes('?') ? '&' : '?';
  redirect(`${destino}${sep}${PARAM_FALLO}=${encodeURIComponent(texto)}`);
}
