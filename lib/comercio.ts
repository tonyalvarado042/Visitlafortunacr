import 'server-only';
import { redirect } from 'next/navigation';
import { sesion } from './supabase-sesion';

/*
 * El lado del COMERCIANTE: el dueño de un negocio que administra su propia
 * ficha. Es deliberadamente distinto de lib/admin/: ahí vive el equipo, con
 * roles y destinos; aquí vive quien solo puede tocar lo suyo.
 *
 * Todo pasa por funciones de la base (mis_negocios, actualizar_mi_negocio…)
 * y no por consultas a las tablas. Dos razones: la lista de campos que un
 * dueño puede cambiar está escrita en la función y no se puede saltar desde
 * aquí, y el "¿es tuyo este negocio?" se contesta en un solo lugar.
 */

export type MiNegocio = {
  id: string;
  nombre: string;
  babosa: string;
  resumen: string | null;
  descripcion: string | null;
  telefono: string | null;
  telefono_whatsapp: string | null;
  email: string | null;
  sitio_web: string | null;
  direccion: string | null;
  como_llegar: string | null;
  rango_precio: string | null;
  estado_publicacion: 'borrador' | 'pendiente' | 'publicado' | 'archivado';
  estado_verificacion: string;
  esta_cerrado: boolean;
  categoria_nombre: string;
  categoria_babosa: string;
  destino_babosa: string;
  destino_dominio: string;
  idioma_principal: string;
  total_resenas: number;
  promedio_calificacion: number | null;
  total_vistas: number;
  mi_rol: 'duenno' | 'encargado';
};

export type ResenaDeMiNegocio = {
  id: string;
  calificacion: number;
  titulo: string | null;
  cuerpo: string | null;
  idioma: string;
  estado: string;
  visitado_el: string | null;
  creado_en: string;
  respuesta_negocio: string | null;
  respondida_en: string | null;
  autor: string;
};

/** Los negocios de quien está en sesión. Vacío si no tiene ninguno. */
export async function misNegocios(): Promise<MiNegocio[]> {
  const db = await sesion();
  const { data, error } = await db.rpc('mis_negocios');
  if (error) {
    console.error('mis_negocios:', error.message);
    return [];
  }
  return (data ?? []) as MiNegocio[];
}

/**
 * Lo que toda página de /negocio necesita. Manda a ingresar si no hay sesión,
 * y a sumar-negocio si la cuenta existe pero todavía no tiene ninguno — que
 * es el caso de quien se registró y abandonó a medio camino.
 */
export async function contextoComercio() {
  const db = await sesion();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/negocio/ingresar');

  const negocios = await misNegocios();

  /* La preferencia de avisos vive en el comerciante, no en el negocio: quien
     recibe el correo es una persona, y con tres hoteles no quiere decidir
     tres veces lo mismo.

     Se busca por `id` y no por email porque el id de la fila ES el del
     usuario de auth —asi esta armada la RLS de la tabla— y el email es un
     dato editable: el dia que alguien cambie el suyo, filtrar por email deja
     de encontrar la fila y el interruptor se queda mudo sin avisar. */
  const { data: yo } = await db
    .from('dst_comerciante')
    .select('avisar_resenas')
    .eq('id', user.id)
    .maybeSingle();

  return {
    cuenta: { id: user.id, email: user.email ?? null },
    negocios,
    avisarResenas: yo?.avisar_resenas !== false,
    db,
  };
}

export async function miNegocio(id: string): Promise<MiNegocio | null> {
  const negocios = await misNegocios();
  return negocios.find((n) => n.id === id) ?? null;
}

export async function resenasDeMiNegocio(negocioId: string): Promise<ResenaDeMiNegocio[]> {
  const db = await sesion();
  const { data, error } = await db.rpc('resenas_de_mi_negocio', { p_negocio_id: negocioId });
  if (error) {
    console.error('resenas_de_mi_negocio:', error.message);
    return [];
  }
  return (data ?? []) as ResenaDeMiNegocio[];
}

/** Cómo se le explica al dueño en qué estado está su ficha. */
export const ESTADO_FICHA: Record<string, { texto: string; detalle: string; color: string }> = {
  borrador:  { texto: 'Borrador',   detalle: 'Todavía no la mandaste a revisar.',                 color: '#8B8B87' },
  pendiente: { texto: 'En revisión', detalle: 'La estamos revisando. Te avisamos al publicarla.',  color: '#FF6A00' },
  publicado: { texto: 'Publicada',  detalle: 'Ya aparece en el directorio.',                      color: '#66BB2E' },
  archivado: { texto: 'Archivada',  detalle: 'No aparece en el directorio. Escribinos si es un error.', color: '#B42318' },
};

export type MiFoto = { id: string; url: string; es_portada: boolean };

/** Las fotos propias de un negocio mío. Las genéricas no entran: no son suyas. */
export async function fotosDeMiNegocio(negocioId: string): Promise<MiFoto[]> {
  const db = await sesion();
  const { data, error } = await db.rpc('mis_fotos', { p_negocio_id: negocioId });
  if (error) {
    console.error('mis_fotos:', error.message);
    return [];
  }
  return (data ?? []) as MiFoto[];
}

/*
 * Las tours del operador.
 *
 * `se_vende` es la que manda en el formulario: cuando la tour ya tiene
 * contrato, el precio deja de ser suyo —la comisión se calcula contra el neto
 * firmado— y el portal lo muestra bloqueado con el motivo. La función de la
 * base ignora el precio igual; esto es para que se entienda, no para proteger.
 */
export type MiTour = {
  id: string;
  nombre: string;
  babosa: string;
  resumen: string | null;
  estado: 'borrador' | 'pendiente' | 'publicado' | 'archivado';
  precio_adulto_usd: number;
  precio_nino_usd: number | null;
  imagen_url: string | null;
  total_reservas: number;
  actualizado_en: string;
  se_vende: boolean;
};

/** Lo que el portal necesita para editar UNA tour. Sale de la misma lista. */
export type MiTourDetalle = MiTour & {
  descripcion: string | null;
  incluye: string | null;
  no_incluye: string | null;
  que_llevar: string | null;
  duracion_horas: number | null;
  hora_inicio: string | null;
  dificultad: string | null;
  edad_minima: number | null;
  cupo_maximo: number | null;
  recoge_en_hotel: boolean;
  idiomas_guia: string[];
  cancelacion_libre_horas: number;
};

export async function misTours(negocioId: string): Promise<MiTour[]> {
  const db = await sesion();
  const { data, error } = await db.rpc('mis_tours', { p_negocio_id: negocioId });
  if (error) {
    console.error('mis_tours:', error.message);
    return [];
  }
  return (data ?? []) as MiTour[];
}

/** Una tour mía, entera. `null` si no es mía: la página da 404, no "prohibido". */
export async function miTour(tourId: string): Promise<MiTourDetalle | null> {
  const db = await sesion();
  const { data, error } = await db.rpc('mi_tour', { p_tour_id: tourId });
  if (error) {
    console.error('mi_tour:', error.message);
    return null;
  }
  return ((data ?? []) as MiTourDetalle[])[0] ?? null;
}

/** Cómo se le explica al operador en qué estado está una tour suya. */
export const ESTADO_TOUR: Record<string, { texto: string; detalle: string; color: string }> = {
  borrador:  { texto: 'Borrador',    detalle: 'Solo la ves vos. Mandala a revisión cuando esté lista.', color: '#8B8B87' },
  pendiente: { texto: 'En revisión', detalle: 'La estamos revisando. Te avisamos al publicarla.',       color: '#FF6A00' },
  publicado: { texto: 'Publicada',   detalle: 'Ya aparece en el sitio.',                                color: '#66BB2E' },
  archivado: { texto: 'Archivada',   detalle: 'No aparece. Escribinos si es un error.',                 color: '#B42318' },
};

/** Cuánta gente pidió los datos de este negocio. La prueba de que el directorio sirve. */
export async function pedidosDeMiNegocio(negocioId: string, dias = 30): Promise<{ cuantos: number; ultimo: string | null }> {
  const db = await sesion();
  const { data, error } = await db.rpc('pedidos_de_mi_negocio', { p_negocio_id: negocioId, p_dias: dias });
  if (error) {
    console.error('pedidos_de_mi_negocio:', error.message);
    return { cuantos: 0, ultimo: null };
  }
  const fila = ((data ?? []) as { cuantos: number; ultimo: string | null }[])[0];
  return { cuantos: Number(fila?.cuantos ?? 0), ultimo: fila?.ultimo ?? null };
}

