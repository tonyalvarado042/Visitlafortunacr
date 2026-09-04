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
  zona_horaria: string;
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
  video_portada_url: string | null;
  imagen_portada_url: string | null;
  whatsapp: string | null;
  /* Qué se le muestra al público: el directorio entero o la pantalla de
     prelanzamiento. No confundir con esta_activo, que corta hasta la lectura. */
  modo_sitio: 'completo' | 'teaser';
  /* Fecha de apertura. En modo teaser es a donde apunta la cuenta regresiva;
     en null el teaser no pinta números, que es mejor que inventar una fecha. */
  lanzado_el: string | null;
};

/** Si el sitio público de este destino está en pantalla de prelanzamiento. */
export function enTeaser(destino: Destino): boolean {
  return destino.modo_sitio === 'teaser';
}

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

export type NotaExterna = {
  plataforma: string;
  calificacion: number | null;
  total_resenas: number | null;
  url_fuente: string;
};

/** Notas de otras plataformas, solo las que siguen vigentes. */
export async function notasExternasDe(negocioId: string): Promise<NotaExterna[]> {
  const { data, error } = await supabase
    .from('dst_resena_externa')
    .select('plataforma, calificacion, total_resenas, url_fuente')
    .eq('negocio_id', negocioId)
    .gt('expira_en', new Date().toISOString());
  if (error) return [];
  return (data ?? []) as NotaExterna[];
}
