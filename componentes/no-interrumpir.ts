/*
 * No interrumpir a quien está conversando.
 *
 * ⚠️ POR QUÉ EXISTE. El 16 de noviembre de 2026, probando el chat ya encendido
 * en el sitio de verdad, la ventana de la rifa se abrió ENCIMA de una
 * conversación a medias: el viajero estaba preguntando por un tour nocturno y
 * le tapamos la pantalla con otra cosa. No es un detalle de estilo — alguien
 * que está escribiéndole al chat ya está haciendo justo lo que queremos que
 * haga, y taparle la pantalla es sabotearse. Es el mismo criterio que
 * `CuponAlSalir` ya aplicaba con el formulario de reserva («si ya metió mano,
 * no se le tapa»), que simplemente no conocía al chat.
 *
 * Se habla por un atributo del `<html>` y no por un contexto de React a
 * propósito: así ningún componente tiene que importar al otro, y el que no
 * sepa de esto sigue funcionando igual.
 */

const MARCA = 'conversando';

/** La llama el chat al abrirse y al cerrarse. */
export function marcarConversacion(abierta: boolean): void {
  if (typeof document === 'undefined') return;
  try {
    if (abierta) document.documentElement.dataset[MARCA] = '1';
    else delete document.documentElement.dataset[MARCA];
  } catch { /* si no se puede marcar, nadie se entera y todo sigue igual */ }
}

/** La miran los que están por taparle la pantalla a alguien. */
export function estaConversando(): boolean {
  if (typeof document === 'undefined') return false;
  try { return document.documentElement.dataset[MARCA] === '1'; } catch { return false; }
}
