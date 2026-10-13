import { supabase } from './supabase';
import type { Destino } from './destino';
import type { Idioma } from './idiomas';

/*
 * El motor de reservas, lado público.
 *
 * TRES INTERRUPTORES, y hacen falta los tres a la vez:
 *
 *   1. `destino.reservas_activas` — el módulo existe o no. Apagado, el sitio
 *      es exactamente el directorio de hoy.
 *   2. `negocio.vende_por_aqui`   — este operador firmó o no.
 *   3. `contrato.esta_activo`     — y para ESTE producto, bajo qué modo.
 *
 * No es redundancia: el primero es operativo (lanzar o matar el módulo), el
 * segundo comercial (quién firmó), el tercero legal y financiero (qué se
 * acordó exactamente, por producto). Juntar dos pierde algo real.
 *
 * Y un cuarto, que es el que protege plata: `destino.pasarela_lista`. Aunque
 * un contrato diga que cobramos nosotros, sin pasarela probada la acción cae
 * a "solicitar" y no se le cobra a nadie.
 *
 * Todo el filtrado vive en `productos_reservables`, que es SECURITY DEFINER.
 * Eso no es casualidad: el precio NETO y la comisión no pueden viajar al
 * navegador de un turista, y una función es lo único que deja elegir campo
 * por campo qué sale.
 */

/** Lo que decide el botón de la ficha. */
export type AccionReserva =
  /** Pasarela lista, contrato que lo autoriza, confirmación instantánea y cupo garantizado. */
  | 'reservar_y_pagar'
  /** Cobramos nosotros pero falta algo: se cotiza antes de cobrar. */
  | 'solicitar_disponibilidad'
  /** Cobra el operador: se le pasa la solicitud. */
  | 'solicitar_reserva';

export type ProductoReservable = {
  producto_id: string;
  babosa: string;
  nombre: string;
  resumen: string | null;
  incluye: string[];
  no_incluye: string[];
  duracion_horas: number | null;
  edad_minima: number | null;
  admite_ninos: boolean;
  horas_antelacion: number;
  /* Las tarifas VERIFICADAS, de mayor a menor. Vacío = sin precio que
     mostrar, y el widget dice "consultar".

     Van todas y no un "desde": con adulto a $47 y niño a $33, un "desde $33"
     es cierto y engañoso a la vez — el adulto lee 33 y paga 47.

     `es_para` viaja para poder sumar el total antes de enviar. Es el nombre
     CANÓNICO —adulto, nino, senior, general—, no el rótulo: el rótulo es texto
     libre y traducible ("Adulto", "Adult", "Pase general"), y adivinar por ahí
     falla en inglés sin que nadie se entere. */
  tarifas: { nombre: string; es_para: 'adulto' | 'nino' | 'senior' | 'general'; precio: number }[];
  moneda: string;
  precio_verificado: boolean;
  accion: AccionReserva;
  modo_disponibilidad: 'cupo_asignado' | 'api_operador' | 'a_solicitud';
  modo_confirmacion: 'instantanea' | 'manual';
  negocio_nombre: string;
  negocio_id: string;
  /* El descuento de lanzamiento vigente, en %. Viene de la MISMA función que
     lo cobra: un precio tachado que no coincide con el total es una promesa
     rota cuando la persona ya decidió. 0 = apagado. */
  descuento_pct: number;
};

/**
 * Lo que este negocio puede vender hoy.
 *
 * Devuelve lista vacía si falta cualquiera de los interruptores — que es
 * exactamente lo que queremos: la ficha sigue siendo la de siempre y nadie
 * se entera de que existe un motor de reservas apagado.
 */
export async function productosReservables(
  destino: Destino, negocioBabosa: string, idioma: Idioma,
): Promise<ProductoReservable[]> {
  /* Ni se pregunta si el módulo está apagado: es una llamada de red menos en
     cada ficha del directorio, que son casi todas las páginas del sitio. */
  if (!destino.reservas_activas) return [];

  const { data, error } = await supabase.rpc('productos_reservables', {
    p_dominio: destino.dominio,
    p_negocio_babosa: negocioBabosa,
    p_idioma: idioma,
  });
  if (error) {
    console.error('productos_reservables:', error.message);
    return [];
  }
  return (data ?? []) as ProductoReservable[];
}

/**
 * Cupo libre en una fecha.
 *
 * Devuelve `null` cuando el contrato es "a solicitud": no lo sabemos, y
 * decir que sí sería inventarlo. El widget muestra la fecha sin promesa.
 */
export async function cupoLibre(productoId: string, fecha: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('cupo_libre', {
    p_producto: productoId,
    p_fecha: fecha,
  });
  if (error) {
    console.error('cupo_libre:', error.message);
    return null;
  }
  return data as number | null;
}
