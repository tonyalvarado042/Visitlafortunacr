import { supabase } from './supabase';
import type { Destino } from './destino';
import type { Idioma } from './idiomas';
import type { Metadata } from 'next';

/*
 * hreflang: lo que más rinde de todo el SEO del sitio, y lo más barato.
 *
 * El problema que resuelve: /es/hoteles/x y /en/hotels/x dicen lo mismo en
 * dos idiomas. Sin hreflang, Google las ve como dos páginas parecidas y
 * elige una; la otra deja de existir. Con hreflang sabe que son la misma
 * pieza y le muestra a cada quien la suya, así que las dos suman en vez de
 * competir.
 *
 * Reglas que hay que respetar o no sirve de nada:
 *   - Cada versión apunta a TODAS las demás, incluida ella misma.
 *   - Las direcciones son las de cada idioma, no la de español con otro
 *     prefijo: en inglés la categoría es "hotels", no "hoteles".
 *   - x-default es adónde va quien no calza con ninguno.
 *   - El canónico apunta a ESTA versión, no a la de español.
 */

export type Alterna = { idioma: Idioma; ruta: string };

/**
 * El bloque de alternates de Next, listo para `generateMetadata`.
 *
 * `rutas` son rutas del sitio ("/es/hoteles/x"), no direcciones completas:
 * metadataBase las completa, así que el mismo código sirve en producción y
 * en local sin condicionales.
 */
export function alternativas(idiomaActual: Idioma, rutas: Alterna[]): Metadata['alternates'] {
  const propia = rutas.find((r) => r.idioma === idiomaActual);
  const languages: Record<string, string> = {};
  for (const { idioma, ruta } of rutas) languages[idioma] = ruta;

  /* x-default es para el buscador que no sabe qué idioma darle a alguien.
     Va al principal del destino, que es el que tiene todo el contenido. */
  const porDefecto = rutas.find((r) => r.idioma === 'es') ?? rutas[0];
  if (porDefecto) languages['x-default'] = porDefecto.ruta;

  return {
    canonical: propia?.ruta ?? rutas[0]?.ruta,
    languages,
  };
}

/** Las mismas rutas en todos los idiomas, cuando la dirección no cambia. */
export function mismasRutas(destino: Destino, cola: string): Alterna[] {
  return destino.idiomas.map((idioma) => ({
    idioma,
    ruta: `/${idioma}${cola}`,
  }));
}

/** Las rutas de una ficha, que SÍ cambian de idioma a idioma. */
export async function rutasDeNegocio(negocioId: string): Promise<Alterna[]> {
  const { data, error } = await supabase.rpc('rutas_de_negocio', { p_negocio_id: negocioId });
  if (error) {
    console.error('rutas_de_negocio:', error.message);
    return [];
  }
  return ((data ?? []) as { idioma: Idioma; categoria_babosa: string; negocio_babosa: string }[])
    .map((r) => ({ idioma: r.idioma, ruta: `/${r.idioma}/${r.categoria_babosa}/${r.negocio_babosa}` }));
}

/** Las rutas de una categoría. */
export async function rutasDeCategoria(destinoId: string, categoriaId: string): Promise<Alterna[]> {
  const { data, error } = await supabase.rpc('rutas_de_categoria', {
    p_destino_id: destinoId,
    p_categoria_id: categoriaId,
  });
  if (error) {
    console.error('rutas_de_categoria:', error.message);
    return [];
  }
  return ((data ?? []) as { idioma: Idioma; babosa: string }[])
    .map((r) => ({ idioma: r.idioma, ruta: `/${r.idioma}/${r.babosa}` }));
}

/** Las rutas de un artículo del blog: solo los idiomas en que existe. */
export async function rutasDeGuia(grupo: string): Promise<Alterna[]> {
  const { data, error } = await supabase.rpc('hermanas_de_guia', { p_grupo: grupo });
  if (error) {
    console.error('hermanas_de_guia:', error.message);
    return [];
  }
  return ((data ?? []) as { idioma: Idioma; babosa: string }[])
    .map((r) => ({ idioma: r.idioma, ruta: `/${r.idioma}/blog/${r.babosa}` }));
}
