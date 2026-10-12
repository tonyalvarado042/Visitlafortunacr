'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sesion } from '@/lib/supabase-sesion';
import { escribirClaveNueva, pedirEnlaceDeClave } from '@/lib/recuperacion';

export type EstadoComercio = { ok?: string | null; error?: string | null };

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
  const { error } = await db
    .from('dst_comerciante')
    .update({ avisar_resenas: quiere })
    .eq('email', user.email ?? '');
  if (error) console.error('avisarmeDeResenas:', error.message);
  revalidatePath('/negocio');
}
