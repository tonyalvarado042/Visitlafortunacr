'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { hayClaveDeIA } from '@/lib/ia/cliente';
import { hayClaveDeServicio } from '@/lib/supabase-servidor';
import { puntuarLead, redactarSeguimiento } from '@/lib/ia/seguimiento';
import { generarItinerarioParaSolicitud } from '@/lib/ia/planificador';
import { enviarAViajero } from '@/lib/ia/mensajeria';

export type Estado = { ok?: string | null; error?: string | null; borrador?: string | null; asunto?: string | null; url?: string | null };

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };

function listo(): string | null {
  if (!hayClaveDeServicio()) return 'Falta SUPABASE_SECRET_KEY en el entorno.';
  if (!hayClaveDeIA()) return 'Falta ANTHROPIC_API_KEY en el entorno.';
  return null;
}

function refrescar(id: string) {
  revalidatePath(`/admin/leads/${id}`);
  revalidatePath('/admin/leads');
  revalidatePath('/admin');
}

export async function moverEtapa(datos: FormData) {
  const { db } = await contextoPanel('leads');
  const id = texto(datos, 'id');
  const etapa = texto(datos, 'etapa');
  if (!esUuid(id)) return;
  await db.rpc('mover_etapa', { p_solicitud_id: id, p_etapa: etapa, p_motivo: texto(datos, 'motivo') || null });
  refrescar(id);
}

export async function asignarResponsable(datos: FormData) {
  const { db } = await contextoPanel('leads');
  const id = texto(datos, 'id');
  const responsable = texto(datos, 'responsable_id');
  if (!esUuid(id)) return;
  await db.from('dst_solicitud').update({ responsable_id: esUuid(responsable) ? responsable : null }).eq('id', id);
  refrescar(id);
}

export async function editarSolicitud(datos: FormData) {
  const { db } = await contextoPanel('leads');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.from('dst_solicitud').update({
    valor_estimado_usd: numero(datos, 'valor_estimado_usd'),
    probabilidad: numero(datos, 'probabilidad'),
    cierra_estimado_el: texto(datos, 'cierra_estimado_el') || null,
    siguiente_accion: texto(datos, 'siguiente_accion') || null,
    siguiente_accion_el: texto(datos, 'siguiente_accion_el') ? new Date(texto(datos, 'siguiente_accion_el')).toISOString() : null,
  }).eq('id', id);
  refrescar(id);
}

export async function agregarNota(datos: FormData) {
  const { db, usuario, destino } = await contextoPanel('leads');
  const id = texto(datos, 'id');
  const viajeroId = texto(datos, 'viajero_id');
  const cuerpo = texto(datos, 'cuerpo');
  if (!esUuid(id) || !cuerpo) return;
  await db.from('dst_mensaje').insert({
    destino_id: destino.id, viajero_id: esUuid(viajeroId) ? viajeroId : null, solicitud_id: id,
    canal: 'nota_interna', direccion: 'saliente', autor: 'equipo', cuerpo: cuerpo.slice(0, 4000), usuario_id: usuario.id,
  });
  refrescar(id);
}

export async function crearTarea(datos: FormData) {
  const { db, usuario, destino } = await contextoPanel('leads');
  const id = texto(datos, 'id');
  const titulo = texto(datos, 'titulo');
  if (!titulo) return;
  const responsable = texto(datos, 'responsable_id');
  await db.from('dst_tarea').insert({
    destino_id: destino.id,
    titulo: titulo.slice(0, 160),
    detalle: texto(datos, 'detalle') || null,
    viajero_id: esUuid(texto(datos, 'viajero_id')) ? texto(datos, 'viajero_id') : null,
    solicitud_id: esUuid(id) ? id : null,
    reserva_id: esUuid(texto(datos, 'reserva_id')) ? texto(datos, 'reserva_id') : null,
    responsable_id: esUuid(responsable) ? responsable : usuario.id,
    vence_el: texto(datos, 'vence_el') || new Date().toISOString().slice(0, 10),
    prioridad: ['baja', 'media', 'alta', 'urgente'].includes(texto(datos, 'prioridad')) ? texto(datos, 'prioridad') : 'media',
    creado_por: usuario.id,
  });
  if (esUuid(id)) refrescar(id);
  revalidatePath('/admin/tareas');
  const volver = texto(datos, 'volver');
  if (volver.startsWith('/admin')) redirect(volver);
}

export async function completarTarea(datos: FormData) {
  const { db } = await contextoPanel('tareas');
  const tareaId = texto(datos, 'tarea_id');
  if (!esUuid(tareaId)) return;
  const hecha = texto(datos, 'deshacer') !== '1';
  await db.from('dst_tarea').update({ esta_hecha: hecha, hecha_en: hecha ? new Date().toISOString() : null }).eq('id', tareaId);
  revalidatePath('/admin/tareas');
  revalidatePath('/admin');
  const id = texto(datos, 'id');
  if (esUuid(id)) refrescar(id);
}

export async function puntuarAhora(_previo: Estado, datos: FormData): Promise<Estado> {
  const { usuario } = await contextoPanel('leads');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return { error: 'Solicitud inválida.' };
  const falta = listo();
  if (falta) return { error: falta };
  try {
    const p = await puntuarLead(id, { origen: 'panel', solicitado_por: usuario.id });
    refrescar(id);
    return { ok: `Puntaje ${p.puntaje} (${p.temperatura}). ${p.siguiente_accion}` };
  } catch (fallo) {
    return { error: fallo instanceof Error ? fallo.message : 'No se pudo puntuar.' };
  }
}

export async function redactarConIA(_previo: Estado, datos: FormData): Promise<Estado> {
  const { usuario } = await contextoPanel('leads');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return { error: 'Solicitud inválida.' };
  const falta = listo();
  if (falta) return { error: falta };
  const canal = texto(datos, 'canal') === 'email' ? 'email' : 'whatsapp';
  try {
    const b = await redactarSeguimiento(id, {
      intento: Math.min(Math.max(Number(texto(datos, 'intento') || 1), 1), 9),
      canal, origen: 'panel', solicitado_por: usuario.id, indicaciones: texto(datos, 'indicaciones') || null,
    });
    return { borrador: b.mensaje, asunto: b.asunto, ok: b.razon };
  } catch (fallo) {
    return { error: fallo instanceof Error ? fallo.message : 'No se pudo redactar.' };
  }
}

export async function enviarMensaje(_previo: Estado, datos: FormData): Promise<Estado> {
  const { db, usuario, destino } = await contextoPanel('leads');
  const id = texto(datos, 'id');
  const cuerpo = texto(datos, 'texto');
  if (!esUuid(id) || !cuerpo) return { error: 'Escribí el mensaje.' };
  if (!hayClaveDeServicio()) return { error: 'Falta SUPABASE_SECRET_KEY en el entorno.' };

  const { data: s } = await db.from('dst_solicitud').select('id, etapa, viajero:dst_viajero(id, nombre, email, whatsapp, idioma, no_molestar)').eq('id', id).maybeSingle();
  const v = (Array.isArray(s?.viajero) ? s?.viajero[0] : s?.viajero) as { id: string; nombre: string | null; email: string | null; whatsapp: string | null; idioma: string | null; no_molestar: boolean } | null | undefined;
  if (!v) return { error: 'La solicitud no tiene viajero.' };

  const canal = texto(datos, 'canal') === 'email' ? 'email' : texto(datos, 'canal') === 'whatsapp' ? 'whatsapp' : null;
  const envio = await enviarAViajero(destino.id, v, {
    texto: cuerpo.slice(0, 4000), asunto: texto(datos, 'asunto') || null, autor: 'equipo', usuario_id: usuario.id, automatico: false,
  }, canal);
  if (!envio.mensaje_id) return { error: envio.error ?? 'No se pudo enviar.' };
  if (s?.etapa === 'nuevo') await db.rpc('mover_etapa', { p_solicitud_id: id, p_etapa: 'contactado', p_motivo: null });
  refrescar(id);
  return { ok: envio.enviado ? `Enviado por ${envio.canal}.` : `Guardado como pendiente de envío manual (${envio.error ?? 'canal sin configurar'}).` };
}

export async function generarPlan(_previo: Estado, datos: FormData): Promise<Estado> {
  await contextoPanel('leads');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return { error: 'Solicitud inválida.' };
  const falta = listo();
  if (falta) return { error: falta };
  try {
    const plan = await generarItinerarioParaSolicitud(id, 'panel');
    refrescar(id);
    return { ok: `Plan listo: ${plan.itinerario.titulo}`, url: plan.url };
  } catch (fallo) {
    return { error: fallo instanceof Error ? fallo.message : 'No se pudo generar el plan.' };
  }
}

export async function crearReserva(datos: FormData) {
  const { db, usuario, destino } = await contextoPanel('reservas');
  const id = texto(datos, 'id');
  const viajeroId = texto(datos, 'viajero_id');
  if (!esUuid(viajeroId)) return;
  const total = numero(datos, 'total_usd') ?? 0;
  const comision = numero(datos, 'comision_usd') ?? Math.round(total * ((destino.comision_por_defecto ?? 0) / 100) * 100) / 100;
  const { data, error } = await db.from('dst_reserva').insert({
    destino_id: destino.id,
    viajero_id: viajeroId,
    solicitud_id: esUuid(id) ? id : null,
    estado: 'solicitada',
    subtotal_usd: total,
    total_usd: total,
    comision_usd: comision,
    nombre_titular: texto(datos, 'nombre_titular') || null,
    email_titular: texto(datos, 'email_titular') || null,
    whatsapp_titular: texto(datos, 'whatsapp_titular') || null,
    notas: texto(datos, 'notas') || null,
    creado_por: usuario.id,
  }).select('id').single();
  if (error || !data) return;
  const descripcion = texto(datos, 'descripcion');
  if (descripcion) {
    await db.from('dst_reserva_linea').insert({
      reserva_id: data.id, descripcion: descripcion.slice(0, 200), para_el: texto(datos, 'para_el') || null,
      adultos: numero(datos, 'adultos'), ninos: numero(datos, 'ninos'), precio_unitario_usd: total, cantidad: 1, total_usd: total, comision_usd: comision,
    });
  }
  if (esUuid(id)) {
    await db.rpc('mover_etapa', { p_solicitud_id: id, p_etapa: 'reservado', p_motivo: null });
    refrescar(id);
  }
  revalidatePath('/admin/reservas');
  redirect(`/admin/reservas/${data.id}`);
}
