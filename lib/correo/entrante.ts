import 'server-only';
import { servicio } from '@/lib/supabase-servidor';
import { conversacionPara, type ViajeroContacto } from '@/lib/ia/mensajeria';
import { sugerirRespuesta, responderConversacion } from '@/lib/ia/agente';
import { direccionSana, dominiosPosibles, soloDireccion, soloLoNuevo } from '@/lib/correo/direcciones';

/* Estaban acá antes de tener su propio archivo. Se re-exportan para que
   quien las busque donde estaban las encuentre. */
export { direccionSana, dominiosPosibles, soloDireccion, soloLoNuevo };

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

export async function recibirCorreo(entrante: CorreoEntrante): Promise<ResultadoEntrante> {
  const db = servicio();
  const de = soloDireccion(entrante.de);
  const para = soloDireccion(entrante.para).toLowerCase();

  if (!de.includes('@')) return { ok: false, motivo: 'Sin remitente.' };

  /* El destino se elige por la dirección a la que escribieron. Así el día que
     exista visitmonteverdecr.com, su correo entra solo donde corresponde. */
  if (!direccionSana(para)) {
    return { ok: false, motivo: `La dirección de destino no es usable: ${para}` };
  }

  /* El porque de aceptar subdominios y de no confiar en la direccion esta en
     `dominiosPosibles` y `direccionSana`, arriba. */
  const dominios = dominiosPosibles(para);

  const filtro = [
    dominios.length ? `dominio.in.(${dominios.join(',')})` : null,
    `email_noreply.eq.${para}`,
    `email_contacto.eq.${para}`,
  ].filter(Boolean).join(',');

  const { data: destino } = await db
    .from('dst_destino')
    .select('id, idioma_principal')
    .or(filtro)
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
  const r = await responderSegunElModo({
    destinoId: destino.id,
    viajeroId: viajero.id,
    conversacionId,
    solicitudId: conv?.solicitud_id ?? null,
  });
  return { ok: true, conversacion_id: conversacionId, mensaje_id: mensaje.id as string, ...r };
}

/*
 * Qué se hace con una conversación de correo que espera respuesta.
 *
 * ⚠️ ESTA FUNCIÓN LA LLAMAN DOS, Y POR ESO VIVE SOLA.
 *
 *   1. `recibirCorreo`, en el momento en que entra el correo.
 *   2. El barrido de cada 5 minutos (`/api/cron/correos`).
 *
 * El barrido existe por el `catch` de acá abajo: si la IA falla justo cuando
 * entra el correo —la API con hipo, un tiempo agotado—, el correo queda
 * guardado y la conversación abierta, pero **el borrador no lo pedía nadie
 * nunca más**. Quedaba esperando a que una persona se diera cuenta. El
 * barrido lo reintenta, y por eso la lógica no puede estar copiada en dos
 * lados: a la segunda semana una de las dos copias haría algo distinto.
 */
export async function responderSegunElModo(opciones: {
  destinoId: string;
  viajeroId: string;
  conversacionId: string;
  solicitudId: string | null;
}): Promise<{ motivo: string; modo: string; envio_id?: string }> {
  const db = servicio();
  const { destinoId, viajeroId, conversacionId, solicitudId } = opciones;

  const { data: automatizacion } = await db
    .from('dst_automatizacion')
    .select('id, condiciones, esta_activa, requiere_aprobacion')
    .eq('destino_id', destinoId).eq('clave', 'responder_correo')
    .maybeSingle();

  const modo = String((automatizacion?.condiciones as { modo?: string } | null)?.modo ?? 'solo_avisar');

  if (!automatizacion?.esta_activa || modo === 'solo_avisar') {
    return { modo, motivo: 'Guardado en la conversación; la IA no redacta.' };
  }

  try {
    if (modo === 'sola') {
      const r = await responderConversacion(conversacionId, { origen: 'email' });
      return { modo, motivo: r.texto ? 'La IA respondió.' : `La IA no respondió: ${r.motivo}` };
    }

    /* modo 'aprobar': redacta y espera el OK. El envío entra como
       `pendiente_aprobacion`, que es lo que el panel ya sabe mostrar. */
    const borrador = await sugerirRespuesta(conversacionId, { solicitado_por: null, indicaciones: null });
    const { data: envio, error: eEnvio } = await db
      .from('dst_automatizacion_envio')
      .insert({
        automatizacion_id: automatizacion.id,
        destino_id: destinoId,
        viajero_id: viajeroId,
        solicitud_id: solicitudId,
        conversacion_id: conversacionId,
        intento: 1,
        estado: 'pendiente_aprobacion',
        programado_para: new Date().toISOString(),
        borrador: borrador.texto,
        resultado: 'Respuesta a un correo del viajero, esperando aprobación.',
      })
      .select('id')
      .single();
    if (eEnvio) return { modo, motivo: `Redactado pero no se pudo encolar: ${eEnvio.message}` };
    return { modo, motivo: 'Redactado y esperando aprobación.', envio_id: envio.id as string };
  } catch (fallo) {
    /* La IA falló, pero el correo YA está guardado y la conversación abierta.
       Eso es lo que no se puede perder. Y el borrador ya no queda huérfano:
       el barrido de cada 5 minutos lo vuelve a intentar. */
    const porque = fallo instanceof Error ? fallo.message : String(fallo);
    console.error('responderSegunElModo: la IA no pudo redactar:', porque);
    return { modo, motivo: `Guardado; la IA no pudo redactar: ${porque}` };
  }
}
