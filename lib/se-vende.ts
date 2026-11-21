/*
 * ¿Esta tour se puede reservar desde el sitio, sí o no? Y si no, ¿por qué?
 *
 * ⚠️ POR QUÉ EXISTE ESTE ARCHIVO.
 *
 * El 20 de noviembre de 2026 Tony abrió la ficha de Hanging Bridges Mistico
 * Park —publicada, con foto, con precio— y no había forma de reservar.
 * Escribió: *«ya aprobé este contrato pero sale aún sin posibilidad de
 * reservar, explicame qué hacer para que no pase más»*.
 *
 * El motivo era real y chiquito: la tour no estaba amarrada a ningún contrato
 * (`contrato_id = null`). **Nueve de las diez condiciones estaban bien.** Pero
 * el panel no lo decía en ninguna parte: la lista de tours mostraba
 * «publicado» —que es cierto— y punto. Para enterarse había que abrir la tour,
 * bajar hasta el bloque del contrato y darse cuenta de que el desplegable
 * estaba en «sin contrato».
 *
 * Eso es lo que esta función arregla: no cambia ninguna regla, pone en
 * palabras la que ya existe. Es la regla del cerebro aplicada al panel —
 * *«si se sabe de antemano que va a rebotar, no se ofrece el botón: se explica
 * por qué no está»*.
 *
 * ⚠️ LA VERDAD LA DICE LA BASE, NO ESTE ARCHIVO.
 *
 * Quien decide de verdad es `destinos.tour_reservable`, que es SECURITY
 * DEFINER y corre contra la base. Esto es un ESPEJO de esas mismas
 * condiciones, para poder explicarlas en el panel. Si algún día se cambia la
 * función, hay que cambiar esto — y por eso `scripts/probar-se-vende.mts`
 * existe y corre en cada build: compara las dos listas de condiciones.
 *
 * Sin dependencias a propósito: así el script lo puede importar sin arrastrar
 * `server-only` ni la cadena de Supabase. Mismo motivo que
 * `lib/correo/direcciones.ts` y `lib/correo/firma-svix.ts`.
 */

export type DatosDeVenta = {
  /** `dst_destino.reservas_activas` */
  reservas_activas: boolean;
  /** `dst_tour.estado` */
  estado: string;
  /** `dst_tour.negocio_id` */
  negocio_id: string | null;
  /** `dst_negocio.estado_publicacion` */
  negocio_estado: string | null;
  /** `dst_negocio.esta_cerrado` */
  negocio_cerrado: boolean | null;
  /** `dst_negocio.vende_por_aqui` */
  vende_por_aqui: boolean | null;
  /** `dst_tour.contrato_id` */
  contrato_id: string | null;
  /** `dst_contrato.esta_activo` */
  contrato_activo: boolean | null;
  /** `dst_contrato.vigencia_desde` (YYYY-MM-DD) */
  vigencia_desde: string | null;
  /** `dst_contrato.vigencia_hasta` (YYYY-MM-DD) */
  vigencia_hasta: string | null;
  /** `dst_tour.precio_adulto_usd` */
  precio_adulto_usd: number | null;
};

export type Veredicto = {
  /** `true` solo si la página pública va a mostrar el botón de reservar. */
  se_vende: boolean;
  /** Para la etiqueta de la lista. Corto. */
  rotulo: string;
  /** Qué hacer, en una frase, con el nombre del campo que falta. */
  arreglo: string | null;
  /** Cuál de las condiciones falló. Sirve para la prueba. */
  clave: string;
};

/* El orden importa: se devuelve el PRIMER problema, y está puesto de lo más
   general a lo más específico. Decirle a alguien «falta el precio» cuando en
   realidad el módulo de reservas está apagado lo manda a arreglar lo que no
   es. */
export function porQueNoSeVende(d: DatosDeVenta, hoy: string = new Date().toISOString().slice(0, 10)): Veredicto {
  if (!d.reservas_activas) {
    return { se_vende: false, clave: 'reservas_apagadas', rotulo: 'reservas apagadas',
      arreglo: 'El módulo de reservas está apagado para todo el destino. Se enciende en Ajustes.' };
  }
  if (d.estado !== 'publicado') {
    return { se_vende: false, clave: 'no_publicada', rotulo: d.estado,
      arreglo: 'Esta tour todavía no está publicada, así que nadie la ve.' };
  }
  if (!d.negocio_id) {
    return { se_vende: false, clave: 'sin_operador', rotulo: 'sin operador',
      arreglo: 'Elegí el operador que la opera y guardá. Sin operador no hay contrato posible.' };
  }
  if (d.negocio_estado !== 'publicado') {
    return { se_vende: false, clave: 'operador_no_publicado', rotulo: 'operador sin publicar',
      arreglo: 'El operador no está publicado. Publicalo en Negocios.' };
  }
  if (d.negocio_cerrado) {
    return { se_vende: false, clave: 'operador_cerrado', rotulo: 'operador cerrado',
      arreglo: 'El operador está marcado como cerrado. Mientras lo esté no vende nada.' };
  }
  if (!d.vende_por_aqui) {
    return { se_vende: false, clave: 'no_vende_por_aqui', rotulo: 'el operador no vende por aquí',
      arreglo: 'En la ficha del operador, encendé «vende por aquí». Es el interruptor comercial: dice que firmó.' };
  }
  if (!d.contrato_id) {
    return { se_vende: false, clave: 'sin_contrato', rotulo: 'SIN CONTRATO',
      arreglo: 'Abrí la tour y elegile un contrato en el desplegable. Tener el contrato cargado en el operador NO alcanza: hay que amarrarlo a ESTA tour.' };
  }
  if (!d.contrato_activo) {
    return { se_vende: false, clave: 'contrato_apagado', rotulo: 'contrato apagado',
      arreglo: 'El contrato está amarrado pero apagado. Encendé «contrato activo» en el operador.' };
  }
  if (d.vigencia_desde && d.vigencia_desde > hoy) {
    return { se_vende: false, clave: 'vigencia_no_empezo', rotulo: 'contrato aún no empieza',
      arreglo: `El contrato empieza el ${d.vigencia_desde}. Hasta ese día no se vende.` };
  }
  if (d.vigencia_hasta && d.vigencia_hasta < hoy) {
    return { se_vende: false, clave: 'contrato_vencido', rotulo: 'contrato vencido',
      arreglo: `El contrato venció el ${d.vigencia_hasta}. Renovalo o corré la fecha.` };
  }
  /* La base pide `precio_adulto_usd is not null and > 0` para dar la tour por
     reservable: sin precio de adulto no hay nada que cobrar ni que sumar. */
  if (d.precio_adulto_usd == null || d.precio_adulto_usd <= 0) {
    return { se_vende: false, clave: 'sin_precio', rotulo: 'sin precio de adulto',
      arreglo: 'Falta el precio de adulto. Sin él la base no la da por reservable.' };
  }
  return { se_vende: true, clave: 'ok', rotulo: 'se puede reservar', arreglo: null };
}

/* Las condiciones que la base revisa, en el mismo orden. La prueba compara
   esta lista contra las claves que devuelve la función: si alguien agrega una
   condición a `tour_reservable` y no la agrega acá, el panel diría «se puede
   reservar» sobre una tour que la página pública no vende — que es
   exactamente el problema que esto vino a resolver, al revés. */
export const CONDICIONES = [
  'reservas_apagadas',
  'no_publicada',
  'sin_operador',
  'operador_no_publicado',
  'operador_cerrado',
  'no_vende_por_aqui',
  'sin_contrato',
  'contrato_apagado',
  'vigencia_no_empezo',
  'contrato_vencido',
  'sin_precio',
] as const;
