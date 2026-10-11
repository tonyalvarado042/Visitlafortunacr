import { supabase } from './supabase';
import type { Destino } from './destino';
import type { Idioma } from './idiomas';

/*
 * El blog.
 *
 * Por qué existe, en una línea: las fichas contestan "dónde queda este
 * hotel", y nadie busca eso. La gente busca "qué hacer en La Fortuna en tres
 * días" y "¿vale la pena el Mistico?". El blog es donde viven esas
 * respuestas, y desde ahí se enlaza a las fichas.
 *
 * Lo mismo vale para las IA: ChatGPT y Perplexity no citan directorios,
 * citan texto que responde una pregunta. Un artículo que dice cuáles son las
 * mejores termales y por qué, con los nombres enlazados, es algo que un
 * modelo puede citar. Una ficha suelta, no.
 *
 * Vive en dst_guia, que ya era una tabla de artículos. Cada idioma es una
 * fila con su propia dirección, unidas por `grupo` para el hreflang.
 */

export type ResumenGuia = {
  id: string;
  babosa: string;
  titulo: string;
  entradilla: string | null;
  tipo: string | null;
  imagen_url: string | null;
  publicado_en: string | null;
  total_vistas: number;
};

export type Guia = {
  id: string;
  babosa: string;
  titulo: string;
  entradilla: string | null;
  cuerpo: string | null;
  tipo: string | null;
  imagen_url: string | null;
  meta_titulo: string | null;
  meta_desc: string | null;
  publicado_en: string | null;
  actualizado_en: string | null;
  idioma: Idioma;
  grupo: string;
};

export async function guiasDe(destino: Destino, idioma: Idioma): Promise<ResumenGuia[]> {
  const { data, error } = await supabase.rpc('guias_publicadas', {
    p_dominio: destino.dominio,
    p_idioma: idioma,
  });
  if (error) {
    console.error('guias_publicadas:', error.message);
    return [];
  }
  return (data ?? []) as ResumenGuia[];
}

export async function guiaPorBabosa(
  destino: Destino, babosa: string, idioma: Idioma,
): Promise<Guia | null> {
  const { data, error } = await supabase.rpc('guia_por_babosa', {
    p_dominio: destino.dominio,
    p_babosa: babosa,
    p_idioma: idioma,
  });
  if (error) {
    console.error('guia_por_babosa:', error.message);
    return null;
  }
  return ((data ?? []) as Guia[])[0] ?? null;
}

/** La fecha como la leería una persona, no como la guarda la base. */
export function fechaLegible(iso: string | null, idioma: Idioma): string | null {
  if (!iso) return null;
  const local = idioma === 'es' ? 'es-CR' : idioma === 'pt' ? 'pt-BR' : idioma === 'fr' ? 'fr-FR' : idioma === 'de' ? 'de-DE' : 'en-US';
  try {
    return new Date(iso).toLocaleDateString(local, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return null;
  }
}

/* ---- La columna de la derecha del blog --------------------------------- */

export type PiezaLateral = {
  id: string;
  tipo: 'negocio' | 'experiencia' | 'guia' | 'enlace';
  titulo: string | null;
  texto: string | null;
  url: string | null;
  imagen_url: string | null;
};

/**
 * Lo que va en la columna del blog: un área de widgets, como la de un CMS.
 *
 * Se arma una vez por destino en Admin → Blog → Columna y sale en TODOS los
 * artículos. El título y la foto no se guardan copiados: salen de la tabla de
 * origen al pintar, así que cuando el negocio cambia de nombre la columna
 * cambia sola. Una copia sería una segunda verdad que envejece.
 *
 * Lo que apunta a algo despublicado no vuelve: pintar un título enlazado a un
 * 404 es peor que no pintar nada.
 */
export async function lateralDe(destino: Destino, idioma: Idioma): Promise<PiezaLateral[]> {
  const { data, error } = await supabase.rpc('columna_lateral', {
    p_dominio: destino.dominio,
    p_idioma: idioma,
  });
  if (error) {
    console.error('columna_lateral:', error.message);
    return [];
  }
  return (data ?? []) as PiezaLateral[];
}

/**
 * Las categorías del blog, sacadas de lo que REALMENTE hay publicado.
 *
 * No hay tabla de categorías ni falta: el tipo vive en la guía. Contarlas de
 * las publicadas evita el caso tonto de ofrecer un filtro que no devuelve
 * nada.
 */
export function categoriasDeGuias(guias: ResumenGuia[]): { tipo: string; total: number }[] {
  const cuenta = new Map<string, number>();
  for (const g of guias) {
    if (!g.tipo) continue;
    cuenta.set(g.tipo, (cuenta.get(g.tipo) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total || a.tipo.localeCompare(b.tipo));
}
