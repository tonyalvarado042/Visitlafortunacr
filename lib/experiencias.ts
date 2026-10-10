import { supabase } from './supabase';
import type { Destino } from './destino';
import type { Idioma } from './idiomas';

/*
 * Las experiencias armadas: el viaje de varios días con hoteles y tours ya
 * escogidos, precio por persona, y un botón que NO cobra — abre una consulta
 * y un asesor contesta. Es el modelo que usan las agencias de acá.
 *
 * Viven en dst_itinerario, la misma tabla donde el planificador guarda los
 * planes que arma para un viajero. Lo que las separa es
 * generado_por = 'equipo' + es_publico, y eso lo filtran las funciones de la
 * base, no este archivo.
 */

export type Experiencia = {
  id: string;
  babosa: string;
  titulo: string;
  subtitulo: string | null;
  resumen: string | null;
  dias: number;
  noches: number | null;
  personas: number | null;
  precio_desde_usd: number | null;
  imagen_url: string | null;
  zonas: string[];
};

export type ExperienciaCompleta = Experiencia & {
  consejos: string | null;
  /* El cuerpo entero en HTML, escrito por quien arma el viaje. Cada viaje se
     cuenta distinto y una estructura fija de columnas termina estorbando. */
  cuerpo_html: string | null;
  incluye: string[];
  no_incluye: string[];
};

export type DiaDeExperiencia = {
  dia: number;
  orden: number;
  momento: 'manana' | 'tarde' | 'noche' | null;
  titulo: string | null;
  nota: string | null;
  porque: string | null;
  negocio_nombre: string | null;
  negocio_babosa: string | null;
  negocio_categoria: string | null;
  tour_nombre: string | null;
};

export async function experienciasDe(destino: Destino, idioma: Idioma): Promise<Experiencia[]> {
  const { data, error } = await supabase.rpc('experiencias_publicas', {
    p_dominio: destino.dominio,
    p_idioma: idioma,
  });
  if (error) {
    console.error('experiencias_publicas:', error.message);
    return [];
  }
  return (data ?? []) as Experiencia[];
}

export async function experienciaPorBabosa(
  destino: Destino, babosa: string, idioma: Idioma,
): Promise<ExperienciaCompleta | null> {
  const { data, error } = await supabase.rpc('experiencia_por_babosa', {
    p_dominio: destino.dominio,
    p_babosa: babosa,
    p_idioma: idioma,
  });
  if (error) {
    console.error('experiencia_por_babosa:', error.message);
    return null;
  }
  const filas = (data ?? []) as ExperienciaCompleta[];
  return filas[0] ?? null;
}

export async function diasDeExperiencia(id: string, idioma: Idioma): Promise<DiaDeExperiencia[]> {
  const { data, error } = await supabase.rpc('dias_de_experiencia', {
    p_itinerario_id: id,
    p_idioma: idioma,
  });
  if (error) {
    console.error('dias_de_experiencia:', error.message);
    return [];
  }
  return (data ?? []) as DiaDeExperiencia[];
}

/** Las paradas vienen planas; la ficha las pinta por día. */
export function agruparPorDia(paradas: DiaDeExperiencia[]): { dia: number; paradas: DiaDeExperiencia[] }[] {
  const porDia = new Map<number, DiaDeExperiencia[]>();
  for (const p of paradas) {
    const lista = porDia.get(p.dia) ?? [];
    lista.push(p);
    porDia.set(p.dia, lista);
  }
  return [...porDia.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dia, lista]) => ({ dia, paradas: lista }));
}
