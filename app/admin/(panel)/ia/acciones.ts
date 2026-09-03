'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contextoPanel } from '@/lib/admin/contexto';
import { hayClaveDeIA } from '@/lib/ia/cliente';
import { hayClaveDeServicio, servicio } from '@/lib/supabase-servidor';
import { responderConversacion } from '@/lib/ia/agente';
import { MODELOS_DISPONIBLES } from '@/lib/ia/modelos';
import { aprobarEnvio, correrAutomatizaciones, descartarEnvio } from '@/lib/automatizaciones';

export type Estado = { ok?: string | null; error?: string | null; respuesta?: string | null; conversacion_id?: string | null };

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const numero = (d: FormData, k: string) => { const v = texto(d, k); return v === '' ? null : Number(v); };
const marca = (d: FormData, k: string) => texto(d, k) === '1';

function json(d: FormData, k: string): Record<string, unknown> | null {
  const v = texto(d, k);
  if (!v) return {};
  try { const o = JSON.parse(v); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; }
}

function listo(): string | null {
  if (!hayClaveDeServicio()) return 'Falta SUPABASE_SECRET_KEY en el entorno.';
  if (!hayClaveDeIA()) return 'Falta ANTHROPIC_API_KEY en el entorno.';
  return null;
}

/* ---- Agentes ---- */
export async function editarAgente(datos: FormData) {
  const { db, destino } = await contextoPanel('ia');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const modelo = texto(datos, 'modelo');
  const esfuerzo = texto(datos, 'esfuerzo');
  const { error } = await db.from('dst_agente').update({
    nombre: texto(datos, 'nombre') || undefined,
    modelo: MODELOS_DISPONIBLES.includes(modelo) ? modelo : undefined,
    esfuerzo: ['low', 'medium', 'high', 'xhigh', 'max'].includes(esfuerzo) ? esfuerzo : undefined,
    max_tokens: Math.min(Math.max(numero(datos, 'max_tokens') ?? 4000, 256), 64000),
    max_iteraciones: Math.min(Math.max(numero(datos, 'max_iteraciones') ?? 8, 1), 20),
    instrucciones: texto(datos, 'instrucciones') || null,
    tono: texto(datos, 'tono') || null,
    puede_escalar: marca(datos, 'puede_escalar'),
    escala_a: esUuid(texto(datos, 'escala_a')) ? texto(datos, 'escala_a') : null,
    esta_activo: marca(datos, 'esta_activo'),
  }).eq('id', id).eq('destino_id', destino.id);
  if (error) console.error('editarAgente:', error.message);
  revalidatePath('/admin/ia');
  revalidatePath(`/admin/ia/agentes/${texto(datos, 'clave')}`);
}

/* ---- Conocimiento ---- */
export async function guardarConocimiento(datos: FormData) {
  const { db, destino, usuario } = await contextoPanel('ia');
  const id = texto(datos, 'id');
  const titulo = texto(datos, 'titulo');
  const contenido = texto(datos, 'contenido');
  if (!titulo || !contenido) return;
  const fila = {
    destino_id: destino.id,
    tipo: ['dato', 'faq', 'politica', 'guion', 'regla', 'aviso', 'negocio', 'tour'].includes(texto(datos, 'tipo')) ? texto(datos, 'tipo') : 'dato',
    titulo: titulo.slice(0, 200),
    contenido,
    idioma: destino.idiomas.includes(texto(datos, 'idioma')) ? texto(datos, 'idioma') : destino.idioma_principal,
    etiquetas: texto(datos, 'etiquetas').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    prioridad: Math.min(Math.max(numero(datos, 'prioridad') ?? 0, 0), 10),
    para_concierge: marca(datos, 'para_concierge'),
    para_planificador: marca(datos, 'para_planificador'),
    fuente: texto(datos, 'fuente') || null,
    esta_verificado: marca(datos, 'esta_verificado'),
    esta_activo: marca(datos, 'esta_activo'),
    vigente_hasta: texto(datos, 'vigente_hasta') || null,
    negocio_id: esUuid(texto(datos, 'negocio_id')) ? texto(datos, 'negocio_id') : null,
  };
  if (esUuid(id)) {
    const { error } = await db.from('dst_conocimiento').update(fila).eq('id', id).eq('destino_id', destino.id);
    if (error) console.error('guardarConocimiento:', error.message);
    revalidatePath(`/admin/ia/conocimiento/${id}`);
  } else {
    const { error } = await db.from('dst_conocimiento').insert({ ...fila, creado_por: usuario.id });
    if (error) console.error('guardarConocimiento:', error.message);
  }
  revalidatePath('/admin/ia/conocimiento');
  revalidatePath('/admin/ia');
  const volver = texto(datos, 'volver');
  if (volver.startsWith('/admin')) redirect(volver);
}

export async function eliminarConocimiento(datos: FormData) {
  const { db, destino } = await contextoPanel('ia');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.from('dst_conocimiento').delete().eq('id', id).eq('destino_id', destino.id);
  revalidatePath('/admin/ia/conocimiento');
  redirect('/admin/ia/conocimiento');
}

/* ---- Automatizaciones ---- */
export async function alternarAutomatizacion(datos: FormData) {
  const { db, destino } = await contextoPanel('ia');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.from('dst_automatizacion').update({ esta_activa: marca(datos, 'activa') }).eq('id', id).eq('destino_id', destino.id);
  revalidatePath('/admin/ia/automatizaciones');
  revalidatePath(`/admin/ia/automatizaciones/${id}`);
}

export async function editarAutomatizacion(datos: FormData) {
  const { db, destino } = await contextoPanel('ia');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const condiciones = json(datos, 'condiciones');
  const parametros = json(datos, 'parametros');
  if (!condiciones || !parametros) return;
  const disparador = texto(datos, 'disparador');
  const accion = texto(datos, 'accion');
  const { error } = await db.from('dst_automatizacion').update({
    nombre: texto(datos, 'nombre') || undefined,
    descripcion: texto(datos, 'descripcion') || null,
    disparador: ['solicitud_nueva', 'sin_respuesta', 'antes_de_llegar', 'despues_de_salir', 'conversacion_inactiva', 'etapa', 'puntaje'].includes(disparador) ? disparador : undefined,
    condiciones,
    accion: ['enviar_plantilla', 'mensaje_ia', 'crear_tarea', 'cambiar_etapa', 'avisar_equipo', 'puntuar'].includes(accion) ? accion : undefined,
    parametros,
    retraso_horas: Math.max(numero(datos, 'retraso_horas') ?? 0, 0),
    maximo_por_solicitud: Math.min(Math.max(numero(datos, 'maximo_por_solicitud') ?? 1, 1), 20),
    requiere_aprobacion: marca(datos, 'requiere_aprobacion'),
    orden: numero(datos, 'orden') ?? 0,
    esta_activa: marca(datos, 'esta_activa'),
  }).eq('id', id).eq('destino_id', destino.id);
  if (error) console.error('editarAutomatizacion:', error.message);
  revalidatePath('/admin/ia/automatizaciones');
  revalidatePath(`/admin/ia/automatizaciones/${id}`);
}

/* ---- Plantillas ---- */
export async function guardarPlantilla(datos: FormData) {
  const { db, destino } = await contextoPanel('ia');
  const id = texto(datos, 'id');
  const cuerpo = texto(datos, 'cuerpo');
  if (!cuerpo) return;
  if (esUuid(id)) {
    await db.from('dst_plantilla_mensaje').update({ asunto: texto(datos, 'asunto') || null, cuerpo, esta_activa: marca(datos, 'esta_activa') }).eq('id', id).eq('destino_id', destino.id);
    revalidatePath(`/admin/ia/plantillas/${id}`);
  } else {
    const clave = texto(datos, 'clave').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const canal = ['whatsapp', 'email'].includes(texto(datos, 'canal')) ? texto(datos, 'canal') : 'whatsapp';
    const idioma = destino.idiomas.includes(texto(datos, 'idioma')) ? texto(datos, 'idioma') : destino.idioma_principal;
    if (!clave) return;
    const { error } = await db.from('dst_plantilla_mensaje').upsert(
      { destino_id: destino.id, clave, canal, idioma, asunto: texto(datos, 'asunto') || null, cuerpo, esta_activa: true },
      { onConflict: 'destino_id,clave,canal,idioma' }
    );
    if (error) console.error('guardarPlantilla:', error.message);
  }
  revalidatePath('/admin/ia/plantillas');
}

export async function eliminarPlantilla(datos: FormData) {
  const { db, destino } = await contextoPanel('ia');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.from('dst_plantilla_mensaje').delete().eq('id', id).eq('destino_id', destino.id);
  revalidatePath('/admin/ia/plantillas');
  redirect('/admin/ia/plantillas');
}

/* ---- Aprobaciones y envíos manuales ---- */
export async function aprobar(_previo: Estado, datos: FormData): Promise<Estado> {
  const { usuario } = await contextoPanel('ia');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return { error: 'Envío inválido.' };
  if (!hayClaveDeServicio()) return { error: 'Falta SUPABASE_SECRET_KEY en el entorno.' };
  const r = await aprobarEnvio(id, usuario.id, texto(datos, 'texto') || null);
  revalidatePath('/admin/ia/aprobaciones');
  revalidatePath('/admin');
  return r.ok ? { ok: 'Aprobado y enviado.' } : { error: r.error ?? 'No se pudo.' };
}

export async function descartar(datos: FormData) {
  const { usuario } = await contextoPanel('ia');
  const id = texto(datos, 'id');
  if (!esUuid(id) || !hayClaveDeServicio()) return;
  await descartarEnvio(id, usuario.id);
  revalidatePath('/admin/ia/aprobaciones');
  revalidatePath('/admin');
}

export async function marcarEnviado(datos: FormData) {
  const { db, destino } = await contextoPanel('ia');
  const id = texto(datos, 'mensaje_id');
  if (!esUuid(id)) return;
  await db.from('dst_mensaje').update({ estado_envio: 'enviado', error_envio: null }).eq('id', id).eq('destino_id', destino.id);
  revalidatePath('/admin/ia/aprobaciones');
  revalidatePath('/admin');
}

/* ---- Probar el concierge y correr el motor ---- */
export async function probarConcierge(_previo: Estado, datos: FormData): Promise<Estado> {
  const { destino, usuario } = await contextoPanel('ia');
  const falta = listo();
  if (falta) return { error: falta };
  const pregunta = texto(datos, 'pregunta').slice(0, 2000);
  if (!pregunta) return { error: 'Escribí una pregunta.' };
  const idioma = destino.idiomas.includes(texto(datos, 'idioma')) ? texto(datos, 'idioma') : destino.idioma_principal;
  try {
    const db = servicio();
    const { data: entrada, error } = await db.rpc('registrar_mensaje_entrante', {
      p_destino_id: destino.id, p_canal: 'web', p_identificador: `prueba-${usuario.id.slice(0, 8)}`,
      p_cuerpo: pregunta, p_id_externo: null, p_nombre: `Prueba de ${usuario.nombre}`, p_idioma: idioma,
      p_metadatos: { prueba: true, usuario_id: usuario.id }, p_viajero_id: null,
    });
    if (error) return { error: error.message };
    if (entrada.atendida_por !== 'ia') await db.rpc('devolver_a_ia', { p_conversacion_id: entrada.conversacion_id });
    const r = await responderConversacion(entrada.conversacion_id, { origen: 'panel', forzar: true });
    revalidatePath('/admin/conversaciones');
    return { respuesta: r.texto ?? `(sin texto: ${r.motivo ?? 'escalada'})`, conversacion_id: entrada.conversacion_id, ok: r.escalada ? 'La IA escaló a una persona.' : null };
  } catch (fallo) {
    return { error: fallo instanceof Error ? fallo.message : 'Falló la prueba.' };
  }
}

export async function correrAhora(_previo: Estado, datos: FormData): Promise<Estado> {
  const { destino } = await contextoPanel('ia');
  void datos;
  if (!hayClaveDeServicio()) return { error: 'Falta SUPABASE_SECRET_KEY en el entorno.' };
  try {
    const r = await correrAutomatizaciones({ destino_id: destino.id, limite: 30 });
    revalidatePath('/admin/ia');
    revalidatePath('/admin/ia/aprobaciones');
    return { ok: `Programados ${r.programados} · ejecutados ${r.ejecutados} · por aprobar ${r.por_aprobar} · omitidos ${r.omitidos} · pospuestos ${r.pospuestos} · fallidos ${r.fallidos} · conversaciones analizadas ${r.analizadas}${r.detalles.length ? ` · ${r.detalles.slice(0, 3).join(' | ')}` : ''}` };
  } catch (fallo) {
    return { error: fallo instanceof Error ? fallo.message : 'Falló.' };
  }
}
