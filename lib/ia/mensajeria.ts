import 'server-only';
import { servicio } from '@/lib/supabase-servidor';

/*
 * Por dónde sale cada mensaje. La configuración del canal vive en dst_canal
 * (qué número de WhatsApp, qué remitente de correo); el secreto vive en una
 * variable de entorno cuyo NOMBRE está en dst_canal.variable_secreto. Si el
 * canal no está configurado, el mensaje igual se guarda como "pendiente" para
 * que una persona lo mande a mano desde el panel: nunca se pierde.
 */

export type Canal = 'whatsapp' | 'email' | 'web';

export type ConfigCanal = {
  id: string;
  destino_id: string;
  tipo: Canal;
  proveedor: 'meta' | 'resend' | 'web' | 'manual';
  identificador: string | null;
  nombre_visible: string | null;
  variable_secreto: string | null;
  esta_activo: boolean;
};

const VARIABLE_POR_DEFECTO: Record<Canal, string | null> = {
  whatsapp: 'WHATSAPP_TOKEN',
  email: 'RESEND_API_KEY',
  web: null,
};

function secretoDe(config: ConfigCanal): string | null {
  const nombre = config.variable_secreto ?? VARIABLE_POR_DEFECTO[config.tipo];
  if (!nombre) return null;
  const valor = process.env[nombre]?.trim();
  return valor && valor.length > 10 ? valor : null;
}

export async function canalesDe(destinoId: string): Promise<ConfigCanal[]> {
  const { data } = await servicio()
    .from('dst_canal')
    .select('*')
    .eq('destino_id', destinoId)
    .eq('esta_activo', true);
  return (data ?? []) as ConfigCanal[];
}

/** El canal está listo para enviar: existe, está activo y su secreto está en el entorno. */
export async function canalListo(destinoId: string, tipo: Canal): Promise<(ConfigCanal & { secreto: string }) | null> {
  const canales = await canalesDe(destinoId);
  const config = canales.find((c) => c.tipo === tipo && (tipo === 'web' || c.proveedor !== 'manual'));
  if (!config) return null;
  if (tipo === 'web') return { ...config, secreto: '' };
  const secreto = secretoDe(config);
  if (!secreto) return null;
  if (tipo === 'whatsapp' && !(config.identificador ?? process.env.WHATSAPP_PHONE_NUMBER_ID)) return null;
  return { ...config, secreto };
}

type Resultado = { ok: boolean; id_externo?: string; error?: string };

export async function enviarWhatsapp(config: ConfigCanal & { secreto: string }, para: string, texto: string): Promise<Resultado> {
  const phoneNumberId = config.identificador ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
  try {
    const respuesta = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.secreto}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: para.replace(/^\+/, ''),
        type: 'text',
        text: { preview_url: true, body: texto },
      }),
    });
    const cuerpo = (await respuesta.json().catch(() => ({}))) as {
      messages?: { id: string }[]; error?: { message?: string };
    };
    if (!respuesta.ok) return { ok: false, error: cuerpo.error?.message ?? `HTTP ${respuesta.status}` };
    return { ok: true, id_externo: cuerpo.messages?.[0]?.id };
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : String(fallo) };
  }
}

export async function enviarEmail(
  config: ConfigCanal & { secreto: string }, para: string, asunto: string, texto: string
): Promise<Resultado> {
  const remitente = config.identificador ?? process.env.EMAIL_REMITENTE;
  if (!remitente) return { ok: false, error: 'Falta el remitente del correo (dst_canal.identificador o EMAIL_REMITENTE).' };
  const de = config.nombre_visible ? `${config.nombre_visible} <${remitente}>` : remitente;
  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.secreto}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: de, to: [para], subject: asunto, text: texto }),
    });
    const cuerpo = (await respuesta.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!respuesta.ok) return { ok: false, error: cuerpo.message ?? `HTTP ${respuesta.status}` };
    return { ok: true, id_externo: cuerpo.id };
  } catch (fallo) {
    return { ok: false, error: fallo instanceof Error ? fallo.message : String(fallo) };
  }
}

export type ViajeroContacto = {
  id: string;
  nombre: string | null;
  email: string | null;
  whatsapp: string | null;
  idioma: string | null;
  no_molestar?: boolean;
};

/** La conversación abierta de un viajero en un canal, o una nueva. */
export async function conversacionPara(destinoId: string, viajero: ViajeroContacto, canal: 'whatsapp' | 'email'): Promise<string> {
  const identificador = canal === 'whatsapp' ? viajero.whatsapp : viajero.email;
  if (!identificador) throw new Error(`El viajero no tiene ${canal}.`);

  const db = servicio();
  const { data: abierta } = await db
    .from('dst_conversacion')
    .select('id')
    .eq('destino_id', destinoId)
    .eq('canal', canal)
    .eq('identificador_externo', identificador)
    .neq('estado', 'cerrada')
    .limit(1)
    .maybeSingle();
  if (abierta) return abierta.id as string;

  const [{ data: agente }, { data: solicitud }] = await Promise.all([
    db.from('dst_agente').select('id').eq('destino_id', destinoId).eq('clave', 'concierge').eq('esta_activo', true).maybeSingle(),
    db.from('dst_solicitud').select('id').eq('viajero_id', viajero.id)
      .not('etapa', 'in', '("reservado","perdido")').order('creado_en', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const { data, error } = await db
    .from('dst_conversacion')
    .insert({
      destino_id: destinoId,
      viajero_id: viajero.id,
      canal,
      identificador_externo: identificador,
      idioma: viajero.idioma ?? 'es',
      agente_id: agente?.id ?? null,
      solicitud_id: solicitud?.id ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`No se pudo abrir la conversación: ${error.message}`);
  return data.id as string;
}

export type Saliente = {
  texto: string;
  asunto?: string | null;
  autor: 'ia' | 'equipo' | 'sistema';
  usuario_id?: string | null;
  agente_id?: string | null;
  ejecucion_id?: string | null;
  automatico?: boolean;
  plantilla?: string | null;
  metadatos?: Record<string, unknown>;
};

export type ResultadoEnvio = { mensaje_id: string | null; canal: Canal | null; enviado: boolean; error?: string };

/**
 * Manda un mensaje dentro de una conversación existente por su canal. En el
 * canal web no hay nada que "mandar": la respuesta la devuelve la API al chat.
 */
export async function enviarEnConversacion(conversacionId: string, saliente: Saliente): Promise<ResultadoEnvio> {
  const db = servicio();
  const { data: conv, error } = await db
    .from('dst_conversacion')
    .select('id, destino_id, canal, identificador_externo, idioma')
    .eq('id', conversacionId)
    .single();
  if (error || !conv) return { mensaje_id: null, canal: null, enviado: false, error: error?.message ?? 'No existe la conversación.' };

  const canal = conv.canal as Canal;
  let resultado: Resultado = { ok: true };

  if (canal === 'whatsapp' || canal === 'email') {
    const config = await canalListo(conv.destino_id, canal);
    if (!config) {
      resultado = { ok: false, error: `El canal ${canal} no está configurado: el mensaje queda pendiente de envío manual.` };
    } else if (canal === 'whatsapp') {
      resultado = await enviarWhatsapp(config, conv.identificador_externo as string, saliente.texto);
    } else {
      resultado = await enviarEmail(config, conv.identificador_externo as string, saliente.asunto ?? 'Sobre tu viaje', saliente.texto);
    }
  }

  const { data: mensajeId, error: fallo } = await db.rpc('registrar_mensaje_saliente', {
    p_conversacion_id: conversacionId,
    p_cuerpo: saliente.texto,
    p_autor: saliente.autor,
    p_usuario_id: saliente.usuario_id ?? null,
    p_agente_id: saliente.agente_id ?? null,
    p_ejecucion_id: saliente.ejecucion_id ?? null,
    p_automatico: saliente.automatico ?? false,
    p_plantilla: saliente.plantilla ?? null,
    p_id_externo: resultado.id_externo ?? null,
    p_estado_envio: resultado.ok ? 'enviado' : 'pendiente',
    p_asunto: saliente.asunto ?? null,
    p_metadatos: { ...(saliente.metadatos ?? {}), ...(resultado.error ? { error_envio: resultado.error } : {}) },
  });
  if (fallo) return { mensaje_id: null, canal, enviado: false, error: fallo.message };

  if (!resultado.ok && resultado.error) {
    await db.from('dst_mensaje').update({ error_envio: resultado.error }).eq('id', mensajeId as string);
  }

  return { mensaje_id: mensajeId as string, canal, enviado: resultado.ok, error: resultado.error };
}

/**
 * Manda un mensaje a un viajero eligiendo el canal: el pedido, o WhatsApp si
 * tiene, o correo. Abre la conversación si hace falta.
 */
export async function enviarAViajero(
  destinoId: string, viajero: ViajeroContacto, saliente: Saliente, canalPreferido?: 'whatsapp' | 'email' | null
): Promise<ResultadoEnvio> {
  if (viajero.no_molestar && saliente.automatico) {
    return { mensaje_id: null, canal: null, enviado: false, error: 'El viajero pidió que no le escriban.' };
  }

  const candidatos: ('whatsapp' | 'email')[] = [];
  if (canalPreferido && (canalPreferido === 'whatsapp' ? viajero.whatsapp : viajero.email)) candidatos.push(canalPreferido);
  if (viajero.whatsapp && !candidatos.includes('whatsapp')) candidatos.push('whatsapp');
  if (viajero.email && !candidatos.includes('email')) candidatos.push('email');
  if (!candidatos.length) return { mensaje_id: null, canal: null, enviado: false, error: 'El viajero no tiene WhatsApp ni correo.' };

  // Primero un canal que de verdad pueda enviar; si ninguno, el primero, y el
  // mensaje queda pendiente para envío manual.
  let elegido = candidatos[0];
  for (const canal of candidatos) {
    if (await canalListo(destinoId, canal)) { elegido = canal; break; }
  }

  const conversacionId = await conversacionPara(destinoId, viajero, elegido);
  return enviarEnConversacion(conversacionId, saliente);
}
