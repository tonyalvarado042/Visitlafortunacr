/*
 * Los dos modos del itinerario. UNA sola fuente.
 *
 * ⚠️ POR QUÉ ESTE ARCHIVO EXISTE Y NO UN STRING SUELTO EN CADA LADO.
 *
 * El 14 de octubre de 2026 se perdió un itinerario completo porque el `z.enum`
 * del planificador pedía cuatro valores de `momento` y el CHECK de la base
 * aceptaba tres. El insert va por lote: una sola fila con el valor de más
 * tumbó el lote, el `throw` se llevó el enlace al lead y el correo al viajero,
 * y dejó una ficha pública y vacía tres semanas. Ver
 * `supabase/plataforma/32_el_mediodia_existe.sql`.
 *
 * Así que acá los dos valores viven en un solo lugar, y el comentario de
 * `dst_destino.itinerario_modo` apunta de vuelta a este archivo. Si alguien
 * agrega un tercer modo, tiene que tocar los dos lados o la base lo rechaza —
 * y eso es exactamente lo que se quiere.
 *
 * No lleva `server-only`: lo lee el panel, lo lee el planificador y lo lee la
 * portada para no prometer lo que no va a pasar.
 */

export const MODOS_ITINERARIO = ['automatico', 'manual'] as const;

export type ModoItinerario = (typeof MODOS_ITINERARIO)[number];

export const MODO_ITINERARIO_POR_OMISION: ModoItinerario = 'automatico';

/**
 * Lo que venga de la base o de un formulario, convertido a un modo válido.
 *
 * Ante la duda devuelve `automatico`, que es como venía funcionando el sitio
 * desde siempre: una columna nula, un valor raro o una lectura fallida no
 * deben apagar en silencio algo que hoy funciona.
 */
export function modoItinerario(valor: unknown): ModoItinerario {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  return (MODOS_ITINERARIO as readonly string[]).includes(limpio)
    ? (limpio as ModoItinerario)
    : MODO_ITINERARIO_POR_OMISION;
}

/** Cierto cuando el equipo arma el itinerario a mano. */
export function esManual(valor: unknown): boolean {
  return modoItinerario(valor) === 'manual';
}

/*
 * Los orígenes que cuentan como AUTOMÁTICOS, y por eso se frenan en modo
 * manual.
 *
 * `panel` NO está, y es la decisión que importa de todo este archivo: modo
 * manual significa «no se dispara solo», no «el equipo no puede usar la IA».
 * Si alguien del equipo aprieta «generar plan» en la pantalla del lead, eso
 * tiene que funcionar en los dos modos — lo pidió una persona, que es justo lo
 * que el modo manual quiere.
 *
 * `email` tampoco: hoy nadie lo usa para esto, y el día que se use será
 * alguien contestando, no un disparo automático.
 */
export const ORIGENES_AUTOMATICOS = ['web', 'whatsapp', 'cron', 'api'] as const;

export function esDisparoAutomatico(origen: string): boolean {
  return (ORIGENES_AUTOMATICOS as readonly string[]).includes(origen);
}
