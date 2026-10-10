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
