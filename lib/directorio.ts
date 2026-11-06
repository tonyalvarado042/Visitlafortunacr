import { supabase } from './supabase';
import type { Destino, Negocio, Categoria } from './destino';
import { negociosDe } from './destino';
import type { Idioma } from './idiomas';

/*
 * EL DIRECTORIO: negocios Y tours, en una sola lista.
 *
 * EL AGUJERO QUE TAPA: el directorio solo conocía negocios. Un tour existía
 * en su propia ficha y en ningún otro lado — no salía en su categoría, no
 * salía en el buscador, y la categoría que solo tenía tours contaba CERO y
 * desaparecía del menú. Tony lo encontró buscando sus propios tours y no
 * encontrándolos.
 *
 * Y es la mitad del catálogo: un OPERADOR no tiene ficha, así que todo lo que
 * aporta al sitio son sus tours. Dejarlos fuera del directorio es dejar fuera
 * a los operadores enteros.
 *
 * CÓMO: un tour se mapea a la MISMA forma que un negocio. No es un apaño por
 * pereza — es lo que hace que salgan iguales de verdad. Con dos tipos
 * distintos harían falta dos tarjetas, dos buscadores y dos ordenamientos, y
 * a la segunda semana uno de los dos tendría algo que el otro no.
 *
 * Lo único que los distingue es `tipo`, y lo único que cambia por eso es la
 * dirección: `/es/aguas-termales/paradise` contra `/es/tour/jet-ski`.
 */

export type EnElDirectorio = Negocio & {
  /** Qué es. La tarjeta arma el enlace con esto y nada más. */
  tipo: 'negocio' | 'tour';
};

/** La dirección pública de una ficha del directorio, sea lo que sea. */
export function rutaDe(ficha: EnElDirectorio, idioma: Idioma): string {
  return ficha.tipo === 'tour'
    ? `/${idioma}/tour/${ficha.babosa}`
    : `/${idioma}/${ficha.categoria_babosa}/${ficha.babosa}`;
}

type FilaTour = {
  id: string;
  categoria_id: string | null;
  babosa: string;
  nombre: string;
  resumen: string | null;
  descripcion: string | null;
  precio_adulto_usd: number | null;
  imagen_url: string | null;
  video_url: string | null;
  es_destacado: boolean | null;
  fotos?: { url: string; es_portada: boolean; orden: number }[];
};

/**
 * Todo lo que se puede mostrar en el directorio, ya en el idioma pedido.
 *
 * Los negocios salen del RPC de siempre; los tours se traen aparte y se
 * visten de negocio. El nombre y la babosa de la categoría se toman de la
 * lista de categorías que la página YA pidió, así que no hay una consulta más
 * por eso.
 */
export async function fichasDelDirectorio(
  destino: Destino,
  idioma: Idioma,
  categorias: Categoria[],
): Promise<EnElDirectorio[]> {
  const negocios = await negociosDe(destino, idioma);

  const { data, error } = await supabase
    .from('dst_tour')
    .select(`id, categoria_id, babosa, nombre, resumen, descripcion,
             precio_adulto_usd, imagen_url, video_url, es_destacado,
             fotos:dst_tour_foto(url, es_portada, orden)`)
    .eq('destino_id', destino.id)
    .eq('estado', 'publicado');

  if (error) {
    /* El motivo al registro. Devolver solo los negocios en silencio es cómo
       se vuelve a perder la mitad del catálogo sin que nadie lo note. */
    console.error('fichasDelDirectorio (tours):', error.message);
    return negocios.map((n) => ({ ...n, tipo: 'negocio' as const }));
  }

  const porCategoria = new Map(categorias.map((c) => [c.categoria_id, c]));

  const tours: EnElDirectorio[] = ((data ?? []) as FilaTour[])
    /* Sin categoría no hay dónde listarlo. No se inventa una. */
    .filter((t) => t.categoria_id && porCategoria.has(t.categoria_id))
    .map((t) => {
      const cat = porCategoria.get(t.categoria_id!)!;
      const portada = (t.fotos ?? [])
        .slice()
        .sort((a, b) => (Number(b.es_portada) - Number(a.es_portada)) || (a.orden - b.orden))[0];

      return {
        tipo: 'tour' as const,
        id: t.id,
        categoria_id: cat.categoria_id,
        categoria_babosa: cat.babosa,
        categoria_nombre: cat.nombre,
        seccion: cat.seccion,
        nombre: t.nombre,
        babosa: t.babosa,
        resumen: t.resumen,
        descripcion: t.descripcion,
        /* Lo que un tour no tiene, va vacío — NO inventado. Un tour no tiene
           teléfono propio (el del operador no se muestra: ver la nota del
           operador en la ficha), ni dirección, ni reseñas todavía. */
        logo_url: null,
        email: null,
        telefono: null,
        telefono_whatsapp: null,
        sitio_web: null,
        direccion: null,
        latitud: null,
        longitud: null,
        rango_precio: null,
        precio_desde_usd: t.precio_adulto_usd,
        /* La verificación es del negocio, no del tour. 'pendiente' es lo
           honesto: la tarjeta no le pone el sello a algo que nadie verificó. */
        estado_verificacion: 'pendiente' as const,
        es_destacado: Boolean(t.es_destacado),
        membresia: 'gratis' as const,
        atributos: {},
        total_resenas: 0,
        promedio_calificacion: null,
        foto_portada_url: portada?.url ?? t.imagen_url,
        foto_portada_generica: false,
        video_url: t.video_url,
      };
    });

  return [...negocios.map((n) => ({ ...n, tipo: 'negocio' as const })), ...tours];
}

/**
 * Unas pocas fichas AL AZAR, mezclando negocios y tours.
 *
 * Tony la pidió así: «debe ser random de negocios y tours». Es para
 * descubrir, no para recomendar algo parecido — quien ya está mirando un tour
 * de cuadraciclos no necesita ver cuatro casi iguales.
 *
 * ⚠️ POR QUE NO ES UN SHUFFLE A SECAS. Hay 65 negocios y 2 tours: barajar
 * todo junto y cortar en cuatro casi nunca sacaría un tour, y entonces «random
 * de negocios y tours» sería random de negocios nomás. Se reserva hasta la
 * mitad de los lugares para tours cuando los hay, se llena el resto con
 * negocios, y recién ahí se barajan juntos para que no salgan agrupados por
 * tipo.
 *
 * Barajado de Fisher-Yates, que es el único que reparte parejo. `sort(() =>
 * Math.random() - 0.5)` parece lo mismo y no lo es: sesga el resultado según
 * cómo ordene el motor, y el sesgo no se ve mirando.
 */
export function alAzarDelDirectorio(fichas: EnElDirectorio[], cuantas: number): EnElDirectorio[] {
  const barajar = <T,>(lista: T[]): T[] => {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  };

  const tours = barajar(fichas.filter((f) => f.tipo === 'tour'));
  const negocios = barajar(fichas.filter((f) => f.tipo === 'negocio'));

  const deTours = tours.slice(0, Math.min(tours.length, Math.ceil(cuantas / 2)));
  const deNegocios = negocios.slice(0, cuantas - deTours.length);

  /* Si faltan negocios se completa con más tours, y al revés: la sección no
     sale a medias por un reparto que no se pudo cumplir. */
  const faltan = cuantas - deTours.length - deNegocios.length;
  const extra = faltan > 0 ? tours.slice(deTours.length, deTours.length + faltan) : [];

  return barajar([...deTours, ...deNegocios, ...extra]);
}
