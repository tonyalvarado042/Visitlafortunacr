import { supabase } from './supabase';
import type { Destino } from './destino';

/*
 * El sorteo.
 *
 * Una rifa por destino, encendida o apagada desde el panel. Todo lo que se ve
 * —el titulo, el premio, la fecha, las bases, la imagen, cuantos segundos
 * espera el aviso— sale de la fila, no del codigo: la proxima rifa va a ser
 * distinta y nadie quiere desplegar por cambiar un texto.
 */

export type Sorteo = {
  id: string;
  babosa: string;
  esta_activo: boolean;
  titulo: string;
  gancho: string | null;
  premio_titulo: string | null;
  premio_usd: number | null;
  /** El dia exacto, si ya se decidio. */
  fecha_sorteo: string | null;
  /** Lo que se muestra cuando todavia no hay dia: "Abril 2027". */
  cuando_texto: string | null;
  ganadores: number;
  en_vivo: boolean;
  enlace_vivo: string | null;
  imagen_url: string | null;
  bases_html: string | null;
  pide_whatsapp: boolean;
  whatsapp_obligatorio: boolean;
  aviso_activo: boolean;
  segundos_para_abrir: number;
  al_intentar_salir: boolean;
  dias_para_repreguntar: number;
  cerrado_en: string | null;
  ganador_nombre: string | null;
  ganador_nota: string | null;
  participantes: number;
};

/**
 * El sorteo del destino.
 *
 * `incluirApagado` es para la vista previa: deja ver como queda antes de
 * soltarlo. Un sorteo apagado no se puede mirar de otra forma, y publicar a
 * ciegas unas bases que van a leer personas de verdad no es una opcion.
 */
export async function sorteoDe(
  destino: Destino,
  incluirApagado = false,
): Promise<Sorteo | null> {
  const { data, error } = await supabase.rpc('sorteo_activo', {
    p_dominio: destino.dominio,
    p_incluir_apagado: incluirApagado,
  });
  if (error) {
    console.error('sorteo_activo:', error.message);
    return null;
  }
  return ((data ?? []) as Sorteo[])[0] ?? null;
}

export { cuandoSeSortea, premioEnPlata } from './sorteo-formato';
