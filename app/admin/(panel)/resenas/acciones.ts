'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';

/*
 * Moderar reseñas. Todo pasa por la sesión del usuario, así que las políticas
 * de acceso deciden qué filas puede tocar cada quien: un moderador de La
 * Fortuna no publica una reseña de Monteverde aunque adivine el id.
 */

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();

function refrescar() {
  revalidatePath('/admin/resenas');
}

async function moderar(datos: FormData, cambio: Record<string, unknown>) {
  const { db, usuario } = await contextoPanel('resenas');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const { error } = await db
    .from('dst_resena')
    .update({ ...cambio, moderador_id: usuario.id, moderada_en: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('moderar resena:', error.message);
  refrescar();
}

export async function publicarResena(datos: FormData) {
  await moderar(datos, { estado: 'publicada', motivo_rechazo: null });
}

export async function ocultarResena(datos: FormData) {
  await moderar(datos, { estado: 'oculta' });
}

/** Rechazar exige motivo: la restricción de la tabla no acepta otra cosa. */
export async function rechazarResena(datos: FormData) {
  const motivo = texto(datos, 'motivo') || 'No cumple las normas de la comunidad.';
  await moderar(datos, { estado: 'rechazada', motivo_rechazo: motivo });
}

/** La respuesta del negocio. La escribe el equipo mientras el dueño no entra. */
export async function responderResena(datos: FormData) {
  const { db } = await contextoPanel('resenas');
  const id = texto(datos, 'id');
  const respuesta = texto(datos, 'respuesta');
  if (!esUuid(id)) return;
  const { error } = await db
    .from('dst_resena')
    .update({
      respuesta_negocio: respuesta || null,
      respondida_en: respuesta ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) console.error('responder resena:', error.message);
  refrescar();
}

/**
 * Moderar antes o después de publicar. Apagado, la reseña se ve al enviarla;
 * encendido, espera aquí. Es del destino, no del código.
 */
export async function cambiarModeracion(datos: FormData) {
  const { db, destino } = await contextoPanel('resenas');
  const { error } = await db
    .from('dst_destino')
    .update({ resenas_moderadas: texto(datos, 'moderar') === '1' })
    .eq('id', destino.id);
  if (error) console.error('cambiarModeracion:', error.message);
  refrescar();
}
