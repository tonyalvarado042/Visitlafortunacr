import 'server-only';
import { servicio } from '@/lib/supabase-servidor';
import { conversacionPara, type ViajeroContacto } from '@/lib/ia/mensajeria';
import { sugerirRespuesta, responderConversacion } from '@/lib/ia/agente';

/*
 * Un correo que ENTRA: la respuesta de un viajero.
 *
 * Hasta hoy el sitio mandaba y no recibía. Si alguien contestaba el correo del
 * plan, esa respuesta no llegaba a ninguna parte. Era el agujero más caro del
 * sistema: la respuesta de quien ya mostró interés es justo la que no se puede
 * perder.
 *
 * ⚠️ ESTE ARCHIVO ES CHICO A PROPÓSITO: CASI TODO YA EXISTÍA.
 *
 *   `conversacionPara(destino, viajero, 'email')`  encuentra o abre la
 *       conversación de correo. El canal 'email' ya estaba contemplado.
 *   `sugerirRespuesta(conversacion)`  redacta en MODO BORRADOR, sin mandar.
 *   `aprobarEnvio` / `descartarEnvio`  ya mandan o descartan desde el panel,
 *       y ya los usan los seguimientos de 72 h y 7 días.
 *
 * Lo único que faltaba era la puerta. Ver `47_correo_entrante.sql`.
 */

export type CorreoEntrante = {
  /** La dirección de quien escribe. */
  de: string;
  /** A qué dirección nuestra llegó (hola@…). Sirve para elegir el destino. */
  para: string;
  asunto: string | null;
  texto: string;
  /** El Message-Id, para no procesar dos veces el mismo correo. */
  id_externo?: string | null;
};

export type ResultadoEntrante = {
  ok: boolean;
  motivo: string;
  conversacion_id?: string;
  mensaje_id?: string;
  /** 'aprobar' si quedó un borrador esperando, 'sola' si ya salió. */
  modo?: string;
  envio_id?: string;
};

/** La dirección pelada: «Hannah <a@b.com>» → «a@b.com». */
export function soloDireccion(crudo: string): string {
  const entre = crudo.match(/<([^>]+)>/);
  return (entre ? entre[1] : crudo).trim().toLowerCase();
}

/*
 * Lo que el viajero escribió, sin la conversación anterior pegada abajo.
 *
 * Cuando alguien da «Responder», el cliente de correo cita TODO el hilo. Sin
 * esto, cada respuesta guardaría el historial completo otra vez, el panel se
 * vuelve ilegible y la IA lee el correo viejo como si fuera nuevo —y contesta
 * lo que ya contestó—.
 *
 * Se corta en la primera marca de cita. No es perfecto: ningún recorte de
 * citas lo es, cada cliente inventa la suya. Por eso el cuerpo COMPLETO se
 * guarda igual en los metadatos del mensaje: si algún día un recorte se come
 * algo que importaba, está ahí para recuperarlo.
 */
const MARCAS_DE_CITA = [
  /^\s*On .+ wrote:\s*$/im,
  /^\s*El .+ escribió:\s*$/im,
  /^\s*-----\s*Original Message\s*-----\s*$/im,
  /^\s*_{10,}\s*$/m,
  /^\s*De:\s.+$/im,
  /^\s*From:\s.+$/im,
];

export function soloLoNuevo(cuerpo: string): string {
  let corte = cuerpo.length;
  for (const marca of MARCAS_DE_CITA) {
    const encontrado = cuerpo.match(marca);
    if (encontrado?.index !== undefined && encontrado.index < corte) corte = encontrado.index;
  }
  const limpio = cuerpo.slice(0, corte)
    /* Las líneas que empiezan con «>» son cita en cualquier cliente. */
    .split('\n').filter((l) => !/^\s*>/.test(l)).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  /* Si el recorte dejó vacío, vale más el cuerpo entero que nada. */
  return limpio || cuerpo.trim();
}

/**
 * Recibe un correo y lo mete en la conversación del viajero.
 *
 * No lanza nunca: un correo que no se puede procesar no puede tumbar al
 * Worker ni hacer que el proveedor lo reintente en bucle. Devuelve el motivo.
 */
export async function recibirCorreo(entrante: CorreoEntrante): Promise<ResultadoEntrante> {
  const db = servicio();
  const de = soloDireccion(entrante.de);
  const para = soloDireccion(entrante.para);

  if (!de.includes('@')) return { ok: false, motivo: 'Sin remitente.' };

  /* El destino se elige por la dirección a la que escribieron. Así el día que
     exista visitmonteverdecr.com, su correo entra solo donde corresponde. */
  const dominio = para.split('@')[1] ?? '';
  const { data: destino } = await db
    .from('dst_destino')
    .select('id, idioma_principal')
    .or(`dominio.eq.${dominio},email_noreply.eq.${para},email_contacto.eq.${para}`)
    .limit(1)
    .maybeSingle();
  if (!destino) return { ok: false, motivo: `Ningún destino contesta a ${para}.` };

  /* Mismo correo dos veces: los proveedores reintentan. Sin esto, un reintento
     mete el mensaje de nuevo Y dispara otra respuesta. */
  if (entrante.id_externo) {
    const { data: yaEsta } = await db
      .from('dst_mensaje').select('id')
      .eq('destino_id', destino.id).eq('id_externo', entrante.id_externo)
      .limit(1).maybeSingle();
    if (yaEsta) return { ok: true, motivo: 'Ya estaba procesado.', mensaje_id: yaEsta.id as string };
  }

  /* El viajero. Si escribe alguien que no está, se crea: una respuesta de un
     desconocido sigue siendo un lead. */
  let { data: viajero } = await db
    .from('dst_viajero').select('id, nombre, email, whatsapp, idioma, no_molestar, baja')
    .eq('destino_id', destino.id).eq('email', de).limit(1).maybeSingle();

  if (!viajero) {
    const { data: nuevo, error } = await db
      .from('dst_viajero')
      .insert({ destino_id: destino.id, email: de, idioma: destino.idioma_principal, origen: 'email' })
      .select('id, nombre, email, whatsapp, idioma, no_molestar, baja')
      .single();
    if (error || !nuevo) return { ok: false, motivo: `No se pudo crear el viajero: ${error?.message}` };
    viajero = nuevo;
  }

  const conversacionId = await conversacionPara(destino.id, viajero as ViajeroContacto, 'email');

  const cuerpo = soloLoNuevo(entrante.texto);
  const { data: mensaje, error: eMensaje } = await db
    .from('dst_mensaje')
    .insert({
      destino_id: destino.id,
      viajero_id: viajero.id,
      conversacion_id: conversacionId,
      canal: 'email',
      direccion: 'entrante',
      autor: 'viajero',
      asunto: entrante.asunto,
      cuerpo,
      id_externo: entrante.id_externo ?? null,
      automatico: false,
      /* El cuerpo COMPLETO, con la cita: el recorte es heurístico y esto es
         la red por si un día se come algo. */
      metadatos: { crudo: entrante.texto.slice(0, 20000), para },
    })
    .select('id')
    .single();
  if (eMensaje) return { ok: false, motivo: `No se pudo guardar: ${eMensaje.message}` };

  /* ⚠️ ESTO APAGA EL ACOSO AUTOMÁTICO, y es la parte que más importa.
     `programar_automatizaciones` no programa seguimientos cuando
     `ultimo_contacto_de = 'viajero'`. Sin esta línea, alguien que ACABA de
     contestar seguiría recibiendo el «¿seguís ahí?» de las 24 horas. */
  const { data: conv } = await db
    .from('dst_conversacion').select('solicitud_id').eq('id', conversacionId).maybeSingle();
  if (conv?.solicitud_id) {
    await db.from('dst_solicitud').update({
      ultimo_contacto_en: new Date().toISOString(),
      ultimo_contacto_de: 'viajero',
    }).eq('id', conv.solicitud_id);
  }

  /* Qué hace la IA: lo decide `condiciones.modo` de `responder_correo`, no
     este código. Ver `47_correo_entrante.sql`. */
  const { data: automatizacion } = await db
    .from('dst_automatizacion')
    .select('id, condiciones, esta_activa, requiere_aprobacion')
    .eq('destino_id', destino.id).eq('clave', 'responder_correo')
    .maybeSingle();

  const modo = String((automatizacion?.condiciones as { modo?: string } | null)?.modo ?? 'solo_avisar');
  const base = { ok: true, conversacion_id: conversacionId, mensaje_id: mensaje.id as string, modo };

  if (!automatizacion?.esta_activa || modo === 'solo_avisar') {
    return { ...base, motivo: 'Guardado en la conversación; la IA no redacta.' };
  }

  try {
    if (modo === 'sola') {
      const r = await responderConversacion(conversacionId, { origen: 'email' });
      return { ...base, motivo: r.texto ? 'La IA respondió.' : `La IA no respondió: ${r.motivo}` };
    }

    /* modo 'aprobar': redacta y espera el OK. El envío entra como
       `pendiente_aprobacion`, que es lo que el panel ya sabe mostrar. */
    const borrador = await sugerirRespuesta(conversacionId, { solicitado_por: null, indicaciones: null });
    const { data: envio, error: eEnvio } = await db
      .from('dst_automatizacion_envio')
      .insert({
        automatizacion_id: automatizacion.id,
        destino_id: destino.id,
        viajero_id: viajero.id,
        solicitud_id: conv?.solicitud_id ?? null,
        conversacion_id: conversacionId,
        intento: 1,
        estado: 'pendiente_aprobacion',
        programado_para: new Date().toISOString(),
        borrador: borrador.texto,
        resultado: 'Respuesta a un correo del viajero, esperando aprobación.',
      })
      .select('id')
      .single();
    if (eEnvio) return { ...base, motivo: `Redactado pero no se pudo encolar: ${eEnvio.message}` };
    return { ...base, motivo: 'Redactado y esperando aprobación.', envio_id: envio.id as string };
  } catch (fallo) {
    /* La IA falló, pero el correo YA está guardado y la conversación abierta.
       Eso es lo que no se puede perder; el borrador se puede pedir a mano. */
    const porque = fallo instanceof Error ? fallo.message : String(fallo);
    console.error('recibirCorreo: la IA no pudo redactar:', porque);
    return { ...base, motivo: `Guardado; la IA no pudo redactar: ${porque}` };
  }
}
