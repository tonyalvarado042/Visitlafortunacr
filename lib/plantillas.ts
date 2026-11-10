/*
 * Rellenar una plantilla de mensaje: `{{nombre}}` → el nombre.
 *
 * ⚠️ POR QUÉ ESTO ES UNA FUNCIÓN SOLA Y NO UNA LÍNEA EN CADA LADO.
 *
 * Estaba copiada en `lib/automatizaciones.ts` y en `lib/ia/planificador.ts`,
 * idéntica salvo por la limpieza: una la hacía y la otra no. Resultado: el
 * 9 de noviembre de 2026 le salió a una viajera un correo que empezaba
 *
 *   Hi ,
 *
 * porque el viajero no tenía nombre cargado y la plantilla dice
 * `Hi {{nombre}},`. La automatización no lo habría hecho; el planificador sí,
 * porque su copia no limpiaba. Dos copias, dos comportamientos, un correo feo.
 *
 * LA LIMPIEZA NO ES COSMÉTICA. Una variable vacía deja basura de puntuación
 * que se lee como descuido —y un correo que se lee como descuido es un correo
 * que no se contesta:
 *
 *   «Hi {{nombre}},»          sin nombre → «Hi,»      (no «Hi ,»)
 *   «para {{destino}}.»       sin destino → «para.» → se queda, es raro pero
 *                             no se puede adivinar; eso lo arregla la
 *                             plantilla, no esto.
 *
 * Lo que SÍ se arregla acá es lo que la puntuación deja a la vista: el espacio
 * que sobra antes de una coma, de un punto o de un cierre, los espacios
 * dobles, el espacio al final de una línea y las líneas en blanco de más.
 */

/** Rellena `{{claves}}` y limpia lo que deja una variable vacía. */
export function rellenarPlantilla(
  texto: string,
  variables: Record<string, string | null | undefined>,
): string {
  return texto
    .replace(/\{\{([a-z_]+)\}\}/g, (_, clave: string) => variables[clave] ?? '')
    /* El espacio que sobra antes de la puntuación cuando la variable vino
       vacía: «Hi ,» → «Hi,». Es lo que delata el hueco. */
    .replace(/[ \t]+([,.;:!?)\]])/g, '$1')
    /* Dos espacios seguidos, de una variable vacía en medio de una frase. */
    .replace(/[ \t]{2,}/g, ' ')
    /* Espacios al final de línea, que en un correo de texto plano se ven como
       sangría fantasma en algunos clientes. */
    .replace(/[ \t]+\n/g, '\n')
    /* Tres saltos o más seguidos: un párrafo entero que desapareció. */
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
