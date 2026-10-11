import { supabase } from './supabase';
import type { Destino } from './destino';
import type { Idioma } from './idiomas';

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
  /* La frase del valor, aparte del numero. El titular lleva la cifra
     redonda; esto explica sin comprometer un monto que despues haya que
     demostrar con facturas. */
  premio_nota: string | null;
  /* Que incluye, renglon por renglon. Es lo que de verdad convence: "$1.000"
     es un numero, "cuatro dias, termales y catarata" es un viaje que uno se
     imagina. */
  incluye: string[];
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
  idioma?: Idioma,
): Promise<Sorteo | null> {
  const { data, error } = await supabase.rpc('sorteo_activo', {
    p_dominio: destino.dominio,
    p_incluir_apagado: incluirApagado,
    /* Sin idioma, la rifa salia en espanol en las cinco versiones del sitio:
       /en/rifa decia "Gana una experiencia" y las bases enteras en espanol.
       La traduccion vive en dst_traduccion, igual que la de negocios, tours
       y guias. */
    p_idioma: idioma ?? null,
  });
  if (error) {
    console.error('sorteo_activo:', error.message);
    return null;
  }
  return ((data ?? []) as Sorteo[])[0] ?? null;
}

export { cuandoSeSortea, premioEnPlata } from './sorteo-formato';
