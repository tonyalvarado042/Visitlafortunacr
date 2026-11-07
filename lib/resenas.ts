import { supabase } from './supabase';
import type { Idioma } from './idiomas';

/*
 * Las reseñas propias. Son el activo de la casa: las únicas que cuentan para
 * el promedio y para el aggregateRating del marcado. Lo de Google y Booking
 * vive aparte, en dst_resena_externa, y se muestra citado.
 */

export type Resena = {
  id: string;
  autor: string;
  calificacion: number;
  titulo: string | null;
  cuerpo: string;
  idioma: Idioma;
  visitado_el: string | null;
  creado_en: string;
  respuesta_negocio: string | null;
  respondida_en: string | null;
  total_util: number;
};

/**
 * Las reseñas publicadas de un negocio. Va por función y no por consulta
 * directa porque el nombre de quien escribe vive en dst_viajero, que es el
 * CRM: dar SELECT sobre esa tabla para poder firmar una reseña publicaría
 * correos, fechas de viaje y presupuestos.
 */
export async function resenasDe(negocioId: string, limite = 20): Promise<Resena[]> {
  const { data, error } = await supabase.rpc('resenas_de_negocio', {
    p_negocio_id: negocioId,
    p_limite: limite,
  });
  // Una ficha sin reseñas no es un error: se dibuja igual, invitando a dejar
  // la primera.
  if (error) return [];
  return (data ?? []) as Resena[];
}

/** "4,6" en todos los idiomas menos el inglés, que usa punto. */
export function nota(valor: number, idioma: Idioma): string {
  return valor.toFixed(1).replace('.', idioma === 'en' ? '.' : ',');
}

/**
 * Las reseñas publicadas de una TOUR.
 *
 * Hermana de `resenasDe`, y por la misma razón va por función de la base: el
 * nombre de quien escribe vive en `dst_viajero`, que es el CRM. Dar SELECT
 * sobre esa tabla para poder firmar una reseña publicaría correos, fechas de
 * viaje y presupuestos.
 */
export async function resenasDeTour(tourId: string, limite = 20): Promise<Resena[]> {
  const { data, error } = await supabase.rpc('resenas_de_tour', {
    p_tour_id: tourId,
    p_limite: limite,
  });
  if (error) {
    /* A diferencia de una ficha sin reseñas, esto SÍ es un fallo: la tour
       podría tener diez y no mostrar ninguna. Se dibuja el bloque vacío para
       no tumbar la página, pero queda en el registro. */
    console.error('resenasDeTour:', tourId, error.message);
    return [];
  }
  return (data ?? []) as Resena[];
}
