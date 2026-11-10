/*
 * El tamaño máximo del cuerpo de una acción de servidor.
 *
 * ⚠️ POR QUÉ ESTE ARCHIVO EXISTE Y POR QUÉ ESE NÚMERO.
 *
 * Tony, 10 de noviembre de 2026, subiendo la primera foto de Bike & Bed:
 * la pantalla entera se cambió por «Algo se rompió — An unexpected response
 * was received from the server», con un botón «Reintentar» que reintentaba
 * exactamente lo mismo y volvía a romperse.
 *
 * No era Supabase, ni Storage, ni los permisos. Era el LÍMITE DE CUERPO de
 * las acciones de servidor, que **por omisión es 1 MB**:
 *
 *   vinext/dist/entries/app-rsc-entry.js
 *     const bodySizeLimit = config?.bodySizeLimit ?? 1048576;
 *
 * y en `app-server-action-execution.js`:
 *
 *   if (content-length > maxActionBodySize) {
 *     request.body.cancel();                     // ← la foto NUNCA llega
 *     return renderFetchActionBodyExceededResponse(options);   // ← 500
 *   }
 *
 * Por eso fallaba callado: el cuerpo se CANCELA antes de que `subirFoto`
 * corra. No hay log, no hay error de Supabase, no hay nada que mirar — el
 * servidor contesta 500 con un flujo de React y el error boundary pinta esa
 * pantalla genérica. Una foto de teléfono (3–12 MB) rebota siempre, y el
 * límite es sobre LA TANDA ENTERA: ocho fotos de 200 KB también lo pasan.
 *
 * Con 245 fotos ya subidas, esto llevaba meses ahí: entraban las chiquitas y
 * las que bajaba el servidor desde la web del negocio (esas no pasan por
 * aquí). Nadie había subido una foto grande desde el panel.
 *
 * EL NÚMERO. 12 MB no es el arreglo, es la red. El arreglo de verdad es
 * `componentes/admin/ElegirFotos.tsx`, que encoge en el navegador antes de
 * mandar: el servidor la iba a dejar en 1600 px de todos modos, así que
 * mandar 8 MB era tirar 7,8 MB y hacer esperar a quien sube. Los 12 MB cubren
 * el caso en que el navegador no pudo encoger y así no se vuelve a romper en
 * silencio.
 *
 * MEDIDO EN UN NAVEGADOR, no calculado (10 nov 2026, foto de 4032x3024):
 *
 *   una foto      10,18 MB → 0,76 MB   (13x, en 402 ms)
 *   cinco fotos   50,88 MB → 3,82 MB   entra
 *   veinte fotos 203,51 MB → 15,27 MB  NO ENTRA → el botón se apaga y lo dice
 *
 * ⚠️ Ese último caso importa: **el tope es sobre la tanda entera, no por
 * foto**, así que una tanda larga se pasa aunque cada foto sea chiquita. Y la
 * foto de la prueba era ruido aleatorio —el peor caso posible para
 * comprimir—; una foto de hotel de verdad baja bastante más, así que veinte
 * reales normalmente sí entran. Normalmente no es siempre: por eso el
 * componente SUMA la tanda y avisa antes de mandar, en vez de confiar en el
 * promedio.
 *
 * Memoria del Worker: 128 MB. 12 MB de cuerpo más los buffers de conversión
 * caben de sobra.
 */

/** Tope del cuerpo de una acción de servidor, en bytes. */
export const LIMITE_ACCION_BYTES = 12 * 1024 * 1024;

/** El mismo tope como lo escribe Next en la config. Tienen que coincidir. */
export const LIMITE_ACCION_ETIQUETA = '12mb';

/** Para decirlo en pantalla: «4,2 MB». */
export function enMegas(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
