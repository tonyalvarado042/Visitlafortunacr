/*
 * 37 — Los textos del sitio, configurables sin desplegar.
 *
 * 8 de noviembre de 2026. Tony, señalando tres frases de la ficha de un tour:
 * «Más para tu viaje», «Enviar no cuesta nada ni reserva todavía.» y
 * «Te decimos cuál al confirmar tu reserva.» — más **cuántas recomendadas
 * salen**, que era un `4` escrito en duro en la página.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ LA DECISIÓN QUE IMPORTA: NO HAY TABLA NUEVA.
 *
 * Los textos se guardan en `dst_traduccion` con `entidad = 'destino'` y
 * `campo` = la clave de `lib/idiomas.ts`. Esa tabla **ya hace exactamente
 * esto**: es donde vive el lema del destino traducido y la que lee el sitio
 * público. Una tabla nueva para lo mismo habría sido una segunda verdad, y
 * dos lugares donde buscar el día que un texto no salga como alguien espera.
 *
 * Por eso esta migración es tan corta: lo único que necesitaba columna es la
 * CANTIDAD, que es un número y no un texto.
 *
 * Mismo criterio que ya se aplicó con `dst_traduccion` para los tours: antes
 * de construir, mirar si ya existe.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CÓMO RESUELVE EL SITIO
 *
 *   1. ¿Hay fila para (este destino, esta clave, este idioma)? → gana esa.
 *   2. Si no → el texto de `lib/idiomas.ts`, el de siempre.
 *
 * Dos consecuencias buscadas:
 *   - **No configurar nada deja el sitio exactamente como estaba.** Soltar
 *     esto no cambia una sola página.
 *   - **Vaciar un campo en Ajustes BORRA la fila**, y el texto vuelve al
 *     original. Es lo que alguien espera al borrar; guardar una cadena vacía
 *     dejaría el título de la sección en blanco, y nadie pide eso queriendo.
 *
 * El respaldo es **por campo y por idioma**, no todo o nada: se puede tener el
 * título cambiado en español y en inglés y que el portugués siga con el texto
 * base. Comprobado en vivo.
 *
 * ⚠️ El idioma PRINCIPAL también se guarda en `dst_traduccion`, no en una
 * columna de `dst_destino`. Es la diferencia con el lema —que sí tiene
 * columna— y es a propósito: así agregar un texto configurable nuevo cuesta
 * una línea en `lib/textos-del-sitio.ts` y NO una migración.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PROBADO A PROPÓSITO, en transacción revertida y después en vivo:
 *   - sin configurar nada, las tres fichas muestran el texto de siempre;
 *   - configurado, gana el nuevo en los tres idiomas;
 *   - borrando SOLO el portugués, es/en siguen con el configurado y pt vuelve
 *     solo a «Mais para a sua viagem»;
 *   - la cantidad en 2 pinta 2 tarjetas; en 0 la sección desaparece entera y
 *     la ficha sigue dando 200 en los tres idiomas;
 *   - una cantidad de 99 la rechaza el CHECK.
 * Las filas de prueba se borraron y el destino quedó en 4, como estaba.
 */

alter table destinos.dst_destino
  add column if not exists cuantas_recomendadas smallint not null default 4;

alter table destinos.dst_destino drop constraint if exists ck_dst_destino_cuantas_recomendadas;
alter table destinos.dst_destino add constraint ck_dst_destino_cuantas_recomendadas
  check (cuantas_recomendadas between 0 and 12);

comment on column destinos.dst_destino.cuantas_recomendadas is
  'Cuantas fichas salen en «Mas para tu viaje», al pie de la ficha de un tour. Antes era un 4 en duro en la pagina. 0 apaga la seccion entera, que es una opcion legitima: con pocas fichas publicadas, recomendar al azar recomienda lo mismo siempre. Tope de 12 porque son tarjetas con foto y mas abajo nadie llega.';

/*
 * No hay nada más que crear. Los textos viven en `dst_traduccion`, que ya
 * existe, ya acepta `entidad = 'destino'` en su CHECK, y ya la lee el sitio
 * público con el cliente anónimo (es como sale el lema traducido).
 *
 * La lista de qué claves son configurables vive en `lib/textos-del-sitio.ts`
 * y se edita en Ajustes → «Textos del sitio».
 */
notify pgrst, 'reload schema';
