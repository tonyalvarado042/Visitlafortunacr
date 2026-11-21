import type { Destino, Categoria } from './destino';
import type { Idioma } from './idiomas';
import type { Alterna } from './seo';

/*
 * LA PÁGINA DE UNA SECCIÓN ENTERA: todos los lugares de "comer", no los de
 * una sola de sus categorías.
 *
 * EL AGUJERO QUE TAPA. En la barra, "Comer" y "Dónde dormir" no apuntaban a
 * la sección: apuntaban a la PRIMERA CATEGORÍA de la sección, la de menor
 * `orden`. Era un accidente del orden, no una decisión.
 *
 *   Comer        → /es/restaurantes → 1 lugar de 12
 *   Dónde dormir → /es/hoteles      → 10 lugares de 25
 *
 * O sea: quien tocaba "Comer" veía UN restaurante y se iba creyendo que en
 * La Fortuna hay uno. Los otros once estaban ahí, pero detrás de pastillas
 * que nadie tiene por qué saber que hay que tocar. Lo encontró Tony:
 * «esta pantalla parece que solo hay un restaurante, deberían salir todos
 * ahí no? luego filtrar».
 *
 * CÓMO. La sección es una página más del mismo listado —mismo buscador,
 * mismas pastillas, misma rejilla—, con las categorías de filtro y "Todos"
 * de entrada. Filtrar es una decisión del visitante; empezar filtrado sin
 * haberlo pedido, no.
 *
 * ⚠️ POR QUÉ LAS BABOSAS VIVEN ACÁ Y NO EN LA BASE. `dst_ruta` guarda la
 * babosa por idioma de una ENTIDAD (una categoría, un negocio). Una sección
 * no es una fila de ninguna tabla: es un valor de texto de `dst_categoria.
 * seccion`, y las seis son fijas en el código. Meterlas en la base pediría
 * una tabla nueva para seis constantes que no cambian.
 */
export const BABOSA_DE_SECCION: Record<string, Record<Idioma, string>> = {
  que_hacer:    { es: 'que-hacer',       en: 'things-to-do', pt: 'o-que-fazer',   fr: 'a-faire',        de: 'aktivitaeten' },
  tours:        { es: 'todos-los-tours', en: 'all-tours',    pt: 'todos-os-tours', fr: 'tous-les-tours', de: 'alle-touren' },
  donde_dormir: { es: 'donde-dormir',    en: 'where-to-stay', pt: 'onde-ficar',   fr: 'ou-dormir',      de: 'unterkuenfte' },
  comer_beber:  { es: 'donde-comer',     en: 'where-to-eat', pt: 'onde-comer',    fr: 'ou-manger',      de: 'wo-essen' },
  explorar:     { es: 'explorar',        en: 'explore',      pt: 'explorar',      fr: 'explorer',       de: 'entdecken' },
  transporte:   { es: 'transporte',      en: 'transport',    pt: 'transporte',    fr: 'transport',      de: 'transport' },
};

/**
 * Cuántas categorías CON CONTENIDO necesita una sección para tener página.
 *
 * Con una sola, la página de la sección y la de esa categoría mostrarían la
 * misma lista en dos direcciones distintas — contenido duplicado, que es de
 * las pocas cosas que Google castiga de verdad. Con una sola, la sección
 * redirige a su categoría y no existe como página aparte.
 */
export const MINIMO_CATEGORIAS_PARA_PAGINA = 2;

/** La babosa de esta sección en este idioma, si la sección existe. */
export function babosaDeSeccion(seccion: string, idioma: Idioma): string | null {
  return BABOSA_DE_SECCION[seccion]?.[idioma] ?? null;
}

/**
 * Qué sección es esta babosa, en este idioma. `null` si no es ninguna.
 *
 * ⚠️ LA CATEGORÍA SIEMPRE GANA. Quien llama tiene que haber buscado primero
 * entre las categorías: si alguna vez alguien crea una categoría con babosa
 * "explorar", esa categoría sigue abriéndose y la sección es la que se
 * queda sin página. Al revés, una categoría desaparecería del sitio sin que
 * nadie se entere — y las categorías son datos de Tony; las secciones son
 * seis constantes que puedo renombrar en un minuto.
 */
export function seccionPorBabosa(babosa: string, idioma: Idioma): string | null {
  for (const [seccion, porIdioma] of Object.entries(BABOSA_DE_SECCION)) {
    if (porIdioma[idioma] === babosa) return seccion;
  }
  return null;
}

/** La misma sección, en todas las babosas de los idiomas encendidos. */
export function rutasDeSeccion(destino: Destino, seccion: string): Alterna[] {
  return destino.idiomas
    .map((idioma) => ({ idioma, babosa: babosaDeSeccion(seccion, idioma) }))
    .filter((r): r is { idioma: Idioma; babosa: string } => r.babosa !== null)
    .map((r) => ({ idioma: r.idioma, ruta: `/${r.idioma}/${r.babosa}` }));
}

/**
 * La ruta a la que debe llevar esta sección: su página si la tiene, y si no
 * la única categoría con contenido que tenga. `null` si no tiene ninguna.
 *
 * Es lo que usa la barra. Antes usaba «la primera categoría» a secas, que es
 * de donde salía todo el problema.
 */
export function rutaDeSeccion(
  seccion: string,
  idioma: Idioma,
  categorias: Categoria[],
): string | null {
  const conContenido = categorias.filter((c) => c.seccion === seccion && c.total > 0);
  if (conContenido.length === 0) return null;

  const babosa = babosaDeSeccion(seccion, idioma);
  if (babosa && conContenido.length >= MINIMO_CATEGORIAS_PARA_PAGINA) {
    return `/${idioma}/${babosa}`;
  }
  return `/${idioma}/${conContenido[0].babosa}`;
}
