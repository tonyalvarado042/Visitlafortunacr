import 'server-only';
import { redirect } from 'next/navigation';
import { sesion } from './supabase-sesion';
import { NOMBRES_DE_CAMPOS_TRADUCIBLES } from '@/lib/traducciones-de-tour';

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
  /** Cuando el dueño avisó que terminó de cargar. Null = todavía no avisó. */
  revision_pedida_en: string | null;
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
  /* De cuál de SUS tours es la reseña. Null = del negocio entero. Un operador
     con varias tours necesita saber a cuál se refiere lo que está leyendo. */
  tour_id: string | null;
  tour_nombre: string | null;
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
  pendiente: { texto: 'Sin publicar', detalle: 'Todavía no aparece en el directorio.',             color: '#FF6A00' },
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
  punto_encuentro: string | null;
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

/*
 * La identidad legal del negocio: cédula, razón social y patente.
 *
 * Vive en `dst_negocio_fiscal` y no en `dst_negocio` porque `anon` lee las
 * fichas publicadas enteras: una columna `cedula` ahí quedaría a una llamada
 * REST de distancia. Una cédula jurídica es registro público; una física es el
 * número de identidad de una persona, y eso no puede estar a un clic.
 *
 * El NOMBRE COMERCIAL no está acá: es `dst_negocio.nombre`, el que se muestra
 * en el sitio. Guardarlo dos veces garantiza que un día no coincidan.
 */
export type MisDatosFiscales = {
  tipo_cedula: 'fisica' | 'dimex' | 'juridica' | 'asociacion' | null;
  cedula: string | null;
  razon_social: string | null;
  tiene_patente: boolean | null;
  patente_numero: string | null;
};

export async function misDatosFiscales(negocioId: string): Promise<MisDatosFiscales | null> {
  const db = await sesion();
  const { data, error } = await db.rpc('mis_datos_fiscales', { p_negocio_id: negocioId });
  if (error) {
    console.error('mis_datos_fiscales:', error.message);
    return null;
  }
  return ((data ?? []) as MisDatosFiscales[])[0] ?? null;
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


export type MiFotoDeTour = { id: string; url: string; es_portada: boolean };

/**
 * Las fotos de UN tour mío.
 *
 * Va por consulta directa y no por RPC, al revés que `mis_fotos`: la política
 * de `dst_tour_foto` ya deja al dueño ver las de SUS tours, así que una
 * función que repitiera esa comprobación sería la misma regla escrita dos
 * veces — y el día que cambie una, la otra se queda vieja.
 */
export async function fotosDeMiTour(tourId: string): Promise<MiFotoDeTour[]> {
  const db = await sesion();
  const { data, error } = await db
    .from('dst_tour_foto')
    .select('id, url, es_portada')
    .eq('tour_id', tourId)
    .order('es_portada', { ascending: false })
    .order('orden');
  if (error) {
    console.error('fotosDeMiTour:', error.message);
    return [];
  }
  return (data ?? []) as MiFotoDeTour[];
}

/*
 * Cuántas fotos necesita un tour para que valga la pena mandarlo al mundo.
 *
 * ⚠️ Estaba en CERO y era un error: Tony lo cachó. Con una sola foto el
 * sistema decía «no falta nada» y el botón de pedirle fotos al operador ni
 * aparecía — justo lo que pasa con los dos tours de Jacamar, que tienen una
 * foto cada uno y están publicados.
 *
 * Tres, porque la ficha tiene galería: con una, la galería es un cuadrito
 * solo y el visitante no ve ni el lugar ni la gente ni la actividad. No es un
 * número sagrado; es el mínimo para que la galería no se vea pobre.
 */
export const MINIMO_FOTOS_TOUR = 3;

/* ---- Traducciones de una tour ---- */

/**
 * Lo que el operador ya tradujo de SU tour, para rellenar el formulario.
 *
 * Lee `dst_traduccion` directo y no por una función de la base: esa tabla ya
 * se lee en público —así salen traducidas las etiquetas y el lema del
 * destino— así que una función nueva solo agregaría una pieza que mantener.
 *
 * Si falla, devuelve vacío: el formulario sale sin rellenar y el operador
 * puede escribir. Lo que NO puede pasar es que la pantalla no cargue por esto.
 */
export async function traduccionesDeMiTour(
  tourId: string,
): Promise<Record<string, Record<string, string>>> {
  const db = await sesion();
  const { data, error } = await db
    .from('dst_traduccion')
    .select('campo, idioma, texto')
    .eq('entidad', 'tour')
    .eq('entidad_id', tourId)
    .in('campo', NOMBRES_DE_CAMPOS_TRADUCIBLES as string[]);

  if (error) {
    console.error('traduccionesDeMiTour:', error.message);
    return {};
  }

  const porIdioma: Record<string, Record<string, string>> = {};
  for (const fila of (data ?? []) as { campo: string; idioma: string; texto: string }[]) {
    (porIdioma[fila.idioma] ??= {})[fila.campo] = fila.texto;
  }
  return porIdioma;
}

/* ---- Las paradas del itinerario de una tour ---- */

export type MiParadaDeTour = {
  id: string;
  orden: number;
  tipo: 'salida' | 'parada' | 'paso' | 'regreso';
  titulo: string;
  descripcion: string | null;
  duracion_minutos: number | null;
  entrada_incluida: boolean | null;
  negocio_id: string | null;
  negocio_nombre: string | null;
};

/**
 * Las paradas como las ve su dueño: SIN traducir.
 *
 * A propósito. La ficha pública las pasa por `texto_en`; acá el operador edita
 * el original, y mostrarle la traducción sería dejarlo corregir un texto que
 * no es el que se guarda.
 */
export async function misParadasDeTour(tourId: string): Promise<MiParadaDeTour[]> {
  const db = await sesion();
  const { data, error } = await db.rpc('mis_paradas_de_tour', { p_tour_id: tourId });
  if (error) {
    console.error('mis_paradas_de_tour:', error.message);
    return [];
  }
  return (data ?? []) as MiParadaDeTour[];
}

/**
 * Los lugares del directorio a los que una parada se puede enlazar.
 *
 * Solo publicados y solo de este destino — la base lo vuelve a comprobar en
 * `guardar_mi_parada`, porque un `<select>` se edita desde el navegador en
 * diez segundos.
 */
export async function lugaresParaEnlazar(
  dominio: string,
): Promise<{ id: string; nombre: string }[]> {
  const db = await sesion();
  const { data, error } = await db.rpc('negocios_publicados', { p_dominio: dominio, p_idioma: 'es' });
  if (error) {
    console.error('lugaresParaEnlazar:', error.message);
    return [];
  }
  return ((data ?? []) as { id: string; nombre: string }[])
    .map((n) => ({ id: n.id, nombre: n.nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
