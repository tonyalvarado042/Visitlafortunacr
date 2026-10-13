'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sesion } from '@/lib/supabase-sesion';
import { escribirClaveNueva, pedirEnlaceDeClave } from '@/lib/recuperacion';

export type EstadoComercio = {
  ok?: string | null;
  error?: string | null;
  /* Lo que de verdad quedó guardado. `revalidatePath` invalida la caché pero
     el componente de cliente puede volver a montarse ANTES de que lleguen las
     propiedades nuevas, y entonces pinta las viejas: se guardaba una cédula
     jurídica y el formulario seguía diciendo «física». Devolviéndolo acá, lo
     que se muestra no depende de quién gane esa carrera. */
  guardados?: Record<string, unknown> | null;
};

const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));

/** Un teléfono como lo pide la base: solo dígitos y con el + adelante. */
function telefono(valor: string): string | null {
  const limpio = valor.replace(/[^\d+]/g, '');
  if (!limpio) return null;
  return limpio.startsWith('+') ? limpio : `+${limpio}`;
}

export async function salir() {
  const db = await sesion();
  await db.auth.signOut();
  redirect('/negocio/ingresar');
}

export async function entrarComercio(_previo: EstadoComercio, datos: FormData): Promise<EstadoComercio> {
  const email = texto(datos, 'email').toLowerCase();
  const clave = String(datos.get('clave') ?? '');
  if (!email || !clave) return { error: 'Escribí tu correo y tu contraseña.' };

  const db = await sesion();
  const { error } = await db.auth.signInWithPassword({ email, password: clave });
  if (error) return { error: 'Correo o contraseña incorrectos.' };
  redirect('/negocio');
}

/** "Olvidé mi contraseña": mismo mecanismo que usa el equipo. */
export async function olvideMiClaveComercio(
  _previo: EstadoComercio, datos: FormData
): Promise<EstadoComercio> {
  const r = await pedirEnlaceDeClave(texto(datos, 'email').toLowerCase(), '/negocio');
  return { error: r.error ?? null, ok: r.mensaje ?? null };
}

/** Guardar la contraseña nueva después de volver por el enlace del correo. */
export async function guardarNuevaClaveComercio(
  _previo: EstadoComercio, datos: FormData
): Promise<EstadoComercio> {
  const r = await escribirClaveNueva(
    String(datos.get('clave') ?? ''),
    String(datos.get('repetida') ?? ''),
  );
  if (r.error) return { error: r.error };
  redirect('/negocio');
}

/**
 * Guardar los cambios de la ficha.
 *
 * Esto manda TODO el formulario a actualizar_mi_negocio, y es la función de la
 * base la que decide qué se escribe. Aunque alguien agregue campos al HTML a
 * mano —categoría, destacado, comisión— no llegan a ninguna columna: no son
 * parámetros de la función.
 */
export async function guardarMiNegocio(_previo: EstadoComercio, datos: FormData): Promise<EstadoComercio> {
  const id = texto(datos, 'id');
  if (!esUuid(id)) return { error: 'Falta el negocio.' };

  const nombre = texto(datos, 'nombre');
  if (!nombre) return { error: 'El negocio necesita un nombre.' };

  const db = await sesion();
  const { error } = await db.rpc('actualizar_mi_negocio', {
    p_negocio_id: id,
    p_nombre: nombre,
    p_resumen: texto(datos, 'resumen') || null,
    p_descripcion: texto(datos, 'descripcion') || null,
    p_telefono: telefono(texto(datos, 'telefono')),
    p_whatsapp: telefono(texto(datos, 'telefono_whatsapp')),
    p_email: texto(datos, 'email').toLowerCase() || null,
    p_sitio_web: texto(datos, 'sitio_web') || null,
    p_direccion: texto(datos, 'direccion') || null,
    p_como_llegar: texto(datos, 'como_llegar') || null,
    p_rango_precio: texto(datos, 'rango_precio') || null,
    p_esta_cerrado: texto(datos, 'esta_cerrado') === '1',
  });

  if (error) {
    console.error('actualizar_mi_negocio:', error.message);
    return { error: 'No se pudo guardar. Probá de nuevo.' };
  }

  revalidatePath(`/negocio/${id}`);
  revalidatePath('/negocio');
  return { ok: 'Guardado.' };
}

export async function responderResena(_previo: EstadoComercio, datos: FormData): Promise<EstadoComercio> {
  const resenaId = texto(datos, 'resena_id');
  const negocioId = texto(datos, 'negocio_id');
  if (!esUuid(resenaId)) return { error: 'Falta la reseña.' };

  const db = await sesion();
  const { error } = await db.rpc('responder_resena', {
    p_resena_id: resenaId,
    p_respuesta: texto(datos, 'respuesta') || null,
  });

  if (error) {
    console.error('responder_resena:', error.message);
    return { error: 'No se pudo guardar la respuesta.' };
  }

  revalidatePath(`/negocio/${negocioId}`);
  return { ok: 'Respuesta publicada.' };
}

/* ---- Fotos ----------------------------------------------------------- */
/*
 * El archivo YA está en Storage: lo subió el navegador con la sesión del
 * dueño, porque por acá no cabe (1 MB el server action, 4.5 MB Vercel). Estas
 * acciones solo anotan, marcan y borran.
 *
 * Todo pasa por funciones de la base. El dueño no escribe dst_negocio_foto:
 * si pudiera, se marcaría es_generica, se inventaría un crédito o apuntaría
 * la url a cualquier lado. En las funciones eso no son parámetros.
 */

export async function anotarMiFoto(negocioId: string, url: string, texto?: string): Promise<EstadoComercio> {
  if (!esUuid(negocioId)) return { error: 'Falta el negocio.' };

  const db = await sesion();
  const { error } = await db.rpc('agregar_mi_foto', {
    p_negocio_id: negocioId,
    p_url: url,
    p_texto: texto?.trim() || null,
  });
  if (error) {
    console.error('agregar_mi_foto:', error.message);
    return { error: error.message };
  }
  revalidatePath(`/negocio/${negocioId}`);
  return { ok: 'Foto agregada.' };
}

export async function ponerMiPortada(datos: FormData): Promise<void> {
  const negocioId = texto(datos, 'negocio_id');
  const fotoId = texto(datos, 'foto_id');
  if (!esUuid(negocioId) || !esUuid(fotoId)) return;

  const db = await sesion();
  const { error } = await db.rpc('marcar_mi_portada', { p_negocio_id: negocioId, p_foto_id: fotoId });
  if (error) console.error('marcar_mi_portada:', error.message);
  revalidatePath(`/negocio/${negocioId}`);
}

export async function quitarMiFoto(datos: FormData): Promise<void> {
  const negocioId = texto(datos, 'negocio_id');
  const fotoId = texto(datos, 'foto_id');
  if (!esUuid(negocioId) || !esUuid(fotoId)) return;

  const db = await sesion();
  /* La función devuelve la ruta en Storage justamente para esto: si solo se
     borrara la fila, el archivo quedaría huérfano y el bucket engorda solo. */
  const { data: ruta, error } = await db.rpc('borrar_mi_foto', {
    p_negocio_id: negocioId, p_foto_id: fotoId,
  });
  if (error) { console.error('borrar_mi_foto:', error.message); return; }

  if (typeof ruta === 'string' && ruta) {
    const { error: eArchivo } = await db.storage.from('negocios').remove([ruta]);
    if (eArchivo) console.error('borrar archivo:', eArchivo.message);
  }
  revalidatePath(`/negocio/${negocioId}`);
}


/**
 * Encender o apagar el aviso por correo de reseñas nuevas.
 *
 * Es por COMERCIANTE y no por negocio: quien recibe el correo es una persona,
 * y si tiene tres hoteles no quiere decidir tres veces lo mismo.
 *
 * Va con la sesión, así que las políticas deciden qué fila puede tocar: nadie
 * apaga los avisos de otro aunque adivine el id.
 */
export async function avisarmeDeResenas(datos: FormData): Promise<void> {
  const db = await sesion();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return;

  const quiere = String(datos.get('avisar') ?? '') === '1';
  /* Por `id`, igual que la lectura: es la llave de la RLS de la tabla. Con el
     email, una fila cuyo correo no coincida se actualiza en cero filas y
     Supabase NO devuelve error — el boton se apagaria sin apagar nada. */
  const { data, error } = await db
    .from('dst_comerciante')
    .update({ avisar_resenas: quiere })
    .eq('id', user.id)
    .select('id');
  if (error) console.error('avisarmeDeResenas:', error.message);
  else if (!data?.length) console.error('avisarmeDeResenas: sin fila de comerciante para', user.id);
  revalidatePath('/negocio');
}


/* ---------------------------------------------------------------------------
 * Las tours del operador.
 *
 * Mismo criterio que la ficha: todo va contra funciones de la base, que son
 * las que tienen escrita la lista de campos tocables. Si alguien agrega
 * `contrato_id` o `precio_neto_usd` al HTML a mano, no llega a ninguna
 * columna, porque no son parámetros de esas funciones.
 * ------------------------------------------------------------------------ */

const numero = (d: FormData, k: string) => {
  const v = texto(d, k);
  if (v === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export async function crearMiTour(_previo: EstadoComercio, datos: FormData): Promise<EstadoComercio> {
  const negocioId = texto(datos, 'negocio_id');
  const nombre = texto(datos, 'nombre');
  if (!esUuid(negocioId)) return { error: 'Falta el negocio.' };
  if (!nombre) return { error: 'Ponele un nombre a la tour.' };

  const db = await sesion();
  const { data, error } = await db.rpc('crear_mi_tour', {
    p_negocio_id: negocioId,
    p_nombre: nombre,
  });
  if (error) return { error: error.message };

  revalidatePath(`/negocio/${negocioId}/tours`);
  redirect(`/negocio/${negocioId}/tours/${data}`);
}

export async function guardarMiTour(_previo: EstadoComercio, datos: FormData): Promise<EstadoComercio> {
  const tourId = texto(datos, 'tour_id');
  const negocioId = texto(datos, 'negocio_id');
  if (!esUuid(tourId) || !esUuid(negocioId)) return { error: 'Falta la tour.' };

  const nombre = texto(datos, 'nombre');
  if (!nombre) return { error: 'La tour necesita un nombre.' };

  /* Los idiomas entran como "es, en" y salen como arreglo. La base vuelve a
     filtrar a dos letras: esto es comodidad, no validación. */
  const idiomas = texto(datos, 'idiomas_guia')
    .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

  const db = await sesion();
  const { error } = await db.rpc('actualizar_mi_tour', {
    p_tour_id: tourId,
    p_nombre: nombre,
    p_resumen: texto(datos, 'resumen') || null,
    p_descripcion: texto(datos, 'descripcion') || null,
    p_incluye: texto(datos, 'incluye') || null,
    p_no_incluye: texto(datos, 'no_incluye') || null,
    p_que_llevar: texto(datos, 'que_llevar') || null,
    p_duracion_horas: numero(datos, 'duracion_horas'),
    p_hora_inicio: texto(datos, 'hora_inicio') || null,
    p_dificultad: texto(datos, 'dificultad') || null,
    p_edad_minima: numero(datos, 'edad_minima'),
    p_cupo_maximo: numero(datos, 'cupo_maximo'),
    p_recoge_en_hotel: texto(datos, 'recoge_en_hotel') === '1',
    p_idiomas_guia: idiomas.length ? idiomas : null,
    p_imagen_url: texto(datos, 'imagen_url') || null,
    p_precio_adulto_usd: numero(datos, 'precio_adulto_usd'),
    p_precio_nino_usd: numero(datos, 'precio_nino_usd'),
    p_cancelacion_libre_horas: numero(datos, 'cancelacion_libre_horas'),
  });
  if (error) return { error: error.message };

  revalidatePath(`/negocio/${negocioId}/tours`);
  revalidatePath(`/negocio/${negocioId}/tours/${tourId}`);
  return { ok: 'Guardado.' };
}

export async function mandarMiTourARevision(datos: FormData): Promise<void> {
  const tourId = texto(datos, 'tour_id');
  const negocioId = texto(datos, 'negocio_id');
  if (!esUuid(tourId) || !esUuid(negocioId)) return;

  const db = await sesion();
  const { error } = await db.rpc('mandar_mi_tour_a_revision', { p_tour_id: tourId });
  if (error) console.error('mandar_mi_tour_a_revision:', error.message);
  revalidatePath(`/negocio/${negocioId}/tours`);
  revalidatePath(`/negocio/${negocioId}/tours/${tourId}`);
}

export async function borrarMiTour(datos: FormData): Promise<void> {
  const tourId = texto(datos, 'tour_id');
  const negocioId = texto(datos, 'negocio_id');
  if (!esUuid(tourId) || !esUuid(negocioId)) return;

  const db = await sesion();
  const { error } = await db.rpc('borrar_mi_tour', { p_tour_id: tourId });
  if (error) {
    console.error('borrar_mi_tour:', error.message);
    revalidatePath(`/negocio/${negocioId}/tours/${tourId}`);
    return;
  }
  revalidatePath(`/negocio/${negocioId}/tours`);
  redirect(`/negocio/${negocioId}/tours`);
}


/**
 * Los datos legales del negocio: cédula, razón social y patente.
 *
 * El formato de la cédula no se valida acá sino en la base, con el largo que
 * le toca a cada tipo. Un dedazo en una cédula no se descubre hasta que hay
 * que facturar, y entonces ya hay una reserva hecha.
 */
export async function guardarMisDatosFiscales(
  _previo: EstadoComercio, datos: FormData,
): Promise<EstadoComercio> {
  const negocioId = texto(datos, 'negocio_id');
  if (!esUuid(negocioId)) return { error: 'Falta el negocio.' };

  const patente = texto(datos, 'tiene_patente');

  const db = await sesion();
  const { error } = await db.rpc('guardar_mis_datos_fiscales', {
    p_negocio_id: negocioId,
    p_tipo_cedula: texto(datos, 'tipo_cedula'),
    p_cedula: texto(datos, 'cedula'),
    p_razon_social: texto(datos, 'razon_social') || null,
    /* Sin responder es `null`, no `false`: "todavía no contestó" y "no tiene"
       son cosas distintas, y de la primera hay que preguntar de nuevo. */
    p_tiene_patente: patente === '' ? null : patente === '1',
    p_patente_numero: texto(datos, 'patente_numero') || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/negocio/${negocioId}`);

  /* Se lee de vuelta de la base y no se arma con lo que vino del formulario:
     la función normaliza la cédula a dígitos, así que lo que se guardó no es
     exactamente lo que se escribió. */
  const { data } = await db.rpc('mis_datos_fiscales', { p_negocio_id: negocioId });
  return {
    ok: 'Datos guardados.',
    guardados: ((data ?? []) as Record<string, unknown>[])[0] ?? null,
  };
}
