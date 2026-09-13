import { headers } from 'next/headers';
import { supabase } from './supabase';
import type { Idioma } from './idiomas';

export type Destino = {
  id: string;
  babosa: string;
  nombre: string;
  nombre_largo: string | null;
  dominio: string;
  pais_nombre: string;
  region: string | null;
  marca_nombre: string;
  marca_sigla: string | null;
  lema: string | null;
  idioma_principal: Idioma;
  idiomas: Idioma[];
  moneda_iso: string;
  moneda_visitante: string | null;
  latitud: number | null;
  longitud: number | null;
  zoom_mapa: number;
  color_tinta: string;
  color_acento: string;
  color_naturaleza: string;
  color_gris: string;
  tipografia: string;
  logo_url: string | null;
  /* El ícono de la pestaña. La columna existía desde el principio; el tipo
     se la había saltado, así que el sitio no podía ni verla. */
  favicon_url: string | null;
  video_portada_url: string | null;
  imagen_portada_url: string | null;
  whatsapp: string | null;
};

/**
 * Qué destino sirve esta petición. Se resuelve por el Host, que es lo que
 * permite que un solo despliegue atienda visitlafortunacr.com y
 * visitmonteverdecr.com sin ramas ni variables por destino.
 */
export async function destinoActual(): Promise<Destino> {
  const cabeceras = await headers();
  const host = (cabeceras.get('host') ?? '').split(':')[0].replace(/^www\./, '');

  // Solo se acepta si parece un dominio de verdad: al importar el repo, Vercel
  // puede haber tomado un marcador del archivo de ejemplo.
  const desdeEntorno = process.env.NEXT_PUBLIC_DOMINIO_POR_DEFECTO?.trim();
  const porDefecto = desdeEntorno && desdeEntorno.includes('.') && !desdeEntorno.includes('...')
    ? desdeEntorno
    : 'visitlafortunacr.com';

  // En desarrollo y en las URLs de vista previa el Host no es un dominio real.
  const esLocal = !host || host === 'localhost' || host.endsWith('.vercel.app');
  const dominio = esLocal ? porDefecto : host;

  const { data, error } = await supabase
    .from('dst_destino')
    .select('*')
    .eq('dominio', dominio)
    .eq('esta_activo', true)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el destino ${dominio}: ${error.message}`);
  if (!data) throw new Error(`No hay ningún destino activo para el dominio ${dominio}.`);

  return data as Destino;
}

export type Categoria = {
  categoria_id: string;
  babosa: string;
  nombre: string;
  seccion: string;
  orden: number;
  total: number;
};

/** Las categorías encendidas del destino, en el idioma pedido y con su conteo. */
export async function categoriasDe(destino: Destino, idioma: Idioma): Promise<Categoria[]> {
  const { data, error } = await supabase.rpc('categorias_del_destino', {
    p_destino_id: destino.id,
    p_idioma: idioma,
  });
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
  return (data ?? []) as Categoria[];
}

export type Negocio = {
  id: string;
  categoria_id: string;
  categoria_babosa: string;
  categoria_nombre: string;
  seccion: string;
  nombre: string;
  babosa: string;
  resumen: string | null;
  descripcion: string | null;
  logo_url: string | null;
  email: string | null;
  telefono: string | null;
  telefono_whatsapp: string | null;
  sitio_web: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  rango_precio: 'economico' | 'moderado' | 'alto' | 'lujo' | null;
  precio_desde_usd: number | null;
  estado_verificacion: 'pendiente' | 'parcial' | 'verificado' | 'reclamado';
  es_destacado: boolean;
  membresia: 'gratis' | 'pro' | 'destacado';
  atributos: Record<string, unknown>;
  total_resenas: number;
  promedio_calificacion: number | null;
  /* La portada, desde la migración 22. `generica` en true significa que la
     foto ilustra la categoría y no retrata a este negocio: la tarjeta la usa
     de fondo y nunca la presenta como una imagen del lugar. */
  foto_portada_url: string | null;
  foto_portada_generica: boolean | null;
};

/** Los negocios publicados del destino, ya resueltos al idioma pedido. */
export async function negociosDe(destino: Destino, idioma: Idioma): Promise<Negocio[]> {
  const { data, error } = await supabase.rpc('negocios_publicados', {
    p_dominio: destino.dominio,
    p_idioma: idioma,
  });
  if (error) throw new Error(`No se pudieron leer los negocios: ${error.message}`);
  return (data ?? []) as Negocio[];
}

export const SIMBOLO_PRECIO: Record<string, string> = {
  economico: '$',
  moderado: '$$',
  alto: '$$$',
  lujo: '$$$$',
};

export type FichaNegocio = Negocio & { como_llegar: string | null };

/** Un negocio por su babosa en cualquier idioma. Devuelve null si no existe. */
export async function negocioPorBabosa(
  destino: Destino,
  babosa: string,
  idioma: Idioma
): Promise<FichaNegocio | null> {
  const { data, error } = await supabase.rpc('negocio_por_babosa', {
    p_dominio: destino.dominio,
    p_babosa: babosa,
    p_idioma: idioma,
  });
  if (error) throw new Error(`No se pudo leer la ficha: ${error.message}`);
  const filas = (data ?? []) as FichaNegocio[];
  return filas[0] ?? null;
}

export type Seccion = { clave: string; orden: number; contenido: string };

/**
 * Los bloques plegables de la ficha, ya resueltos al idioma pedido. El título
 * visible no viene de la base: lo pone `lib/idiomas.ts`, para que salga
 * traducido a los cinco idiomas sin repetir el texto en cada negocio.
 */
export async function seccionesDe(negocioId: string, idioma: Idioma): Promise<Seccion[]> {
  const { data, error } = await supabase.rpc('secciones_de_negocio', {
    p_negocio_id: negocioId,
    p_idioma: idioma,
  });
  if (error) return [];
  return (data ?? []) as Seccion[];
}

export type FotoNegocio = {
  url: string;
  texto_alternativo: string | null;
  credito: string | null;
  licencia: string | null;
  fuente_url: string | null;
  es_generica: boolean;
  es_portada: boolean;
};

/**
 * La galería de una ficha: primero las fotos reales del negocio y al final las
 * genéricas de categoría. Devuelve crédito, licencia y enlace de origen porque
 * CC BY y CC BY-SA exigen mostrarlos junto a la imagen, no en una página
 * aparte.
 */
export async function fotosDe(negocioId: string, idioma: Idioma): Promise<FotoNegocio[]> {
  const { data, error } = await supabase.rpc('fotos_de_negocio', {
    p_negocio_id: negocioId,
    p_idioma: idioma,
  });
  if (error) return [];
  return (data ?? []) as FotoNegocio[];
}

export type Horario = { dia_semana: number; abre_a: string | null; cierra_a: string | null; esta_cerrado: boolean };

/** El horario de atención, ordenado de lunes a domingo y no de domingo a sábado. */
export async function horarioDe(negocioId: string): Promise<Horario[]> {
  const { data, error } = await supabase
    .from('dst_negocio_horario')
    .select('dia_semana, abre_a, cierra_a, esta_cerrado')
    .eq('negocio_id', negocioId);
  if (error) return [];
  // dia_semana 0 es domingo en la base; aquí se muestra al final de la semana.
  return ((data ?? []) as Horario[]).sort(
    (a, b) => ((a.dia_semana + 6) % 7) - ((b.dia_semana + 6) % 7)
  );
}

export type EtiquetaNegocio = { babosa: string; grupo: string; nombre: string };

/** Servicios, ambiente, accesibilidad, público y formas de pago del negocio. */
export async function etiquetasDe(negocioId: string, idioma: Idioma): Promise<EtiquetaNegocio[]> {
  const { data, error } = await supabase
    .from('dst_negocio_etiqueta')
    .select('etiqueta:dst_etiqueta(id, babosa, grupo, nombre)')
    .eq('negocio_id', negocioId);
  if (error || !data) return [];

  const etiquetas = data
    .map((f) => (Array.isArray(f.etiqueta) ? f.etiqueta[0] : f.etiqueta))
    .filter(Boolean) as { id: string; babosa: string; grupo: string; nombre: string }[];
  if (!etiquetas.length || idioma === 'es') {
    return etiquetas.map(({ babosa, grupo, nombre }) => ({ babosa, grupo, nombre }));
  }

  // El nombre del catálogo está en español; los demás idiomas en dst_traduccion.
  const { data: trad } = await supabase
    .from('dst_traduccion')
    .select('entidad_id, texto')
    .eq('entidad', 'etiqueta')
    .eq('campo', 'nombre')
    .eq('idioma', idioma)
    .in('entidad_id', etiquetas.map((e) => e.id));

  const porId = Object.fromEntries((trad ?? []).map((t) => [t.entidad_id, t.texto]));
  return etiquetas.map((e) => ({ babosa: e.babosa, grupo: e.grupo, nombre: porId[e.id] ?? e.nombre }));
}

export type ExtractoExterno = {
  autor_nombre: string;
  autor_url: string | null;
  autor_avatar_url: string | null;
  calificacion: number | null;
  texto: string;
  publicada_en: string | null;
  url_original: string;
};

export type NotaExterna = {
  plataforma: string;
  calificacion: number | null;
  total_resenas: number | null;
  url_fuente: string;
  extractos: ExtractoExterno[];
};

/**
 * Lo que dicen en otras plataformas: la nota, el conteo y —cuando la fuente da
 * licencia para mostrarlo— las reseñas con texto, cada una con su autor y su
 * enlace al original.
 *
 * Solo las vigentes. El vencimiento no es cosmético: Google no permite guardar
 * su contenido de forma indefinida, así que una fila vencida deja de verse
 * aunque nadie la borre. Los extractos cuelgan de la fila, de modo que vencen
 * con ella.
 */
export async function notasExternasDe(negocioId: string): Promise<NotaExterna[]> {
  const { data, error } = await supabase
    .from('dst_resena_externa')
    .select(`plataforma, calificacion, total_resenas, url_fuente,
             extractos:dst_resena_externa_extracto(autor_nombre, autor_url, autor_avatar_url, calificacion, texto, publicada_en, url_original)`)
    .eq('negocio_id', negocioId)
    .gt('expira_en', new Date().toISOString());
  if (error) return [];
  return (data ?? []).map((fila) => ({
    ...fila,
    extractos: (fila.extractos ?? []) as ExtractoExterno[],
  })) as NotaExterna[];
}
