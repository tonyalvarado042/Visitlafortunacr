/*
 * Los textos del sitio que el equipo puede cambiar sin tocar el código.
 *
 * ⚠️ POR QUÉ NO HAY TABLA NUEVA.
 *
 * Se guardan en `dst_traduccion` con `entidad = 'destino'` y `campo` = la
 * clave de `lib/idiomas.ts`. Esa tabla ya hace exactamente esto: es la misma
 * donde vive el lema del destino traducido, y la misma que lee el sitio
 * público. Una tabla nueva para lo mismo habría sido una segunda verdad, y
 * dos lugares donde buscar cuando un texto no sale como alguien espera.
 *
 * Mismo criterio que `lib/intereses.ts` y `lib/traducciones-de-tour.ts`: antes
 * de construir, mirar si ya existe.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CÓMO FUNCIONA
 *
 *   1. Si hay fila en `dst_traduccion` para (este destino, esta clave, este
 *      idioma) → gana esa.
 *   2. Si no → el texto de `lib/idiomas.ts`, que es el de siempre.
 *
 * Así, **no configurar nada deja el sitio exactamente como está**. Y vaciar un
 * campo en Ajustes borra la fila y lo devuelve al texto base, que es lo que
 * alguien espera que pase al borrar.
 *
 * ⚠️ El idioma principal TAMBIÉN se guarda acá, no en una columna de
 * `dst_destino`. Es la diferencia con el lema —que sí tiene columna— y es a
 * propósito: así agregar un texto configurable nuevo no cuesta una migración,
 * solo una línea en la lista de abajo.
 */

import type { Idioma } from './idiomas';

export type TextoConfigurable = {
  /** La clave de `lib/idiomas.ts`. Es también el `campo` en dst_traduccion. */
  clave: string;
  /** Cómo se llama en Ajustes. */
  etiqueta: string;
  /** Dónde sale, para que quien lo edita sepa qué está tocando. */
  donde: string;
  filas: number;
};

export const TEXTOS_DEL_SITIO: readonly TextoConfigurable[] = [
  {
    clave: 'tour_otras',
    etiqueta: 'Título de las recomendadas',
    donde: 'Al pie de la ficha de una tour, encima de las tarjetas del directorio.',
    filas: 1,
  },
  {
    clave: 'reserva_sin_cobro',
    etiqueta: 'Letra chica del botón de reservar',
    donde: 'Debajo del botón de enviar, en la caja de reserva de una tour y de una ficha.',
    filas: 2,
  },
  {
    clave: 'tour_quien_confirma',
    etiqueta: 'Qué se dice del operador',
    donde: 'En la caja de precio de una tour, debajo de «lo opera una empresa local».',
    filas: 2,
  },
];

export const CLAVES_CONFIGURABLES: readonly string[] = TEXTOS_DEL_SITIO.map((x) => x.clave);

/** El nombre del campo del formulario de Ajustes. Un solo lugar que lo arma. */
export function campoDeTexto(idioma: string, clave: string): string {
  return `txt_${idioma}_${clave}`;
}

/** Lo que devuelve la consulta, listo para resolver. */
export type TextosPuestos = Record<string, string>;

/**
 * Agrupa las filas de `dst_traduccion` por clave, para el idioma pedido.
 *
 * Fuera de `lib/destino.ts` para que la pantalla de Ajustes —que necesita
 * TODOS los idiomas a la vez— pueda usar la misma forma sin arrastrar la
 * consulta del sitio público.
 */
export function agruparTextos(
  filas: { campo: string; idioma: string; texto: string }[] | null | undefined,
  idioma: Idioma,
): TextosPuestos {
  const puestos: TextosPuestos = {};
  for (const f of filas ?? []) {
    if (f.idioma !== idioma) continue;
    const limpio = (f.texto ?? '').trim();
    if (limpio) puestos[f.campo] = limpio;
  }
  return puestos;
}
