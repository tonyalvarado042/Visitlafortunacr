'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';
import { hayClaveDeIA } from '@/lib/ia/cliente';
import { hayClaveDeServicio } from '@/lib/supabase-servidor';
import { enviarEnConversacion } from '@/lib/ia/mensajeria';
import { sugerirRespuesta } from '@/lib/ia/agente';
import { analizarConversacion } from '@/lib/ia/analista';

export type Estado = { ok?: string | null; error?: string | null; borrador?: string | null };

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();

function refrescar(id: string) {
  revalidatePath(`/admin/conversaciones/${id}`);
  revalidatePath('/admin/conversaciones');
  revalidatePath('/admin');
}

export async function tomar(datos: FormData) {
  const { db } = await contextoPanel('conversaciones');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.rpc('tomar_conversacion', { p_conversacion_id: id });
  refrescar(id);
}

export async function devolver(datos: FormData) {
  const { db } = await contextoPanel('conversaciones');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.rpc('devolver_a_ia', { p_conversacion_id: id });
  refrescar(id);
}

export async function cerrar(datos: FormData) {
  const { db } = await contextoPanel('conversaciones');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.rpc('cerrar_conversacion', { p_conversacion_id: id });
  refrescar(id);
}

export async function revisar(datos: FormData) {
  const { db } = await contextoPanel('conversaciones');
  const id = texto(datos, 'id');
  const calificacion = Number(texto(datos, 'calificacion'));
  if (!esUuid(id) || !(calificacion >= 1 && calificacion <= 5)) return;
  await db.rpc('revisar_conversacion', { p_conversacion_id: id, p_calificacion: calificacion, p_nota: texto(datos, 'nota') || null });
  refrescar(id);
}

export async function marcarRevision(datos: FormData) {
  const { db } = await contextoPanel('conversaciones');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.from('dst_conversacion').update({ requiere_revision: texto(datos, 'valor') === '1', motivo_revision: texto(datos, 'motivo') || null }).eq('id', id);
  refrescar(id);
}

export async function notaInterna(datos: FormData) {
  const { db, usuario, destino } = await contextoPanel('conversaciones');
  const id = texto(datos, 'id');
  const cuerpo = texto(datos, 'cuerpo');
  if (!esUuid(id) || !cuerpo) return;
  const { data: c } = await db.from('dst_conversacion').select('viajero_id, solicitud_id').eq('id', id).maybeSingle();
  await db.from('dst_mensaje').insert({
    destino_id: destino.id, conversacion_id: id, viajero_id: c?.viajero_id ?? null, solicitud_id: c?.solicitud_id ?? null,
    canal: 'nota_interna', direccion: 'saliente', autor: 'equipo', cuerpo: cuerpo.slice(0, 4000), usuario_id: usuario.id,
  });
  refrescar(id);
}

export async function responder(_previo: Estado, datos: FormData): Promise<Estado> {
  const { usuario, db } = await contextoPanel('conversaciones');
  const id = texto(datos, 'id');
  const cuerpo = texto(datos, 'texto');
  if (!esUuid(id) || !cuerpo) return { error: 'Escribí la respuesta.' };
  if (!hayClaveDeServicio()) return { error: 'Falta SUPABASE_SECRET_KEY en el entorno.' };

  // Quien responde a mano se queda con la conversación: la IA no pisa a una persona.
  await db.rpc('tomar_conversacion', { p_conversacion_id: id });
  const r = await enviarEnConversacion(id, { texto: cuerpo.slice(0, 4000), asunto: texto(datos, 'asunto') || null, autor: 'equipo', usuario_id: usuario.id });
  refrescar(id);
  if (!r.mensaje_id) return { error: r.error ?? 'No se pudo enviar.' };
  return { ok: r.enviado ? (r.canal === 'web' ? 'Publicado en el chat.' : `Enviado por ${r.canal}.`) : `Guardado; pendiente de envío manual (${r.error ?? 'canal sin configurar'}).` };
}

export async function sugerir(_previo: Estado, datos: FormData): Promise<Estado> {
  const { usuario } = await contextoPanel('conversaciones');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return { error: 'Conversación inválida.' };
  if (!hayClaveDeServicio()) return { error: 'Falta SUPABASE_SECRET_KEY en el entorno.' };
  if (!hayClaveDeIA()) return { error: 'Falta ANTHROPIC_API_KEY en el entorno.' };
  try {
    const r = await sugerirRespuesta(id, { solicitado_por: usuario.id, indicaciones: texto(datos, 'indicaciones') || null });
    return { borrador: r.texto };
  } catch (fallo) {
    return { error: fallo instanceof Error ? fallo.message : 'No se pudo sugerir.' };
  }
}

export async function analizar(_previo: Estado, datos: FormData): Promise<Estado> {
  const { usuario } = await contextoPanel('conversaciones');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return { error: 'Conversación inválida.' };
  if (!hayClaveDeServicio()) return { error: 'Falta SUPABASE_SECRET_KEY en el entorno.' };
  if (!hayClaveDeIA()) return { error: 'Falta ANTHROPIC_API_KEY en el entorno.' };
  try {
    const a = await analizarConversacion(id, { origen: 'panel', solicitado_por: usuario.id });
    refrescar(id);
    return { ok: `${a.sentimiento} · ${a.intencion} · calidad ${a.calidad_respuestas}/5` };
  } catch (fallo) {
    return { error: fallo instanceof Error ? fallo.message : 'No se pudo analizar.' };
  }
}
