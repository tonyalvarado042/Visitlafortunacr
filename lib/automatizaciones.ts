import 'server-only';
import { servicio } from '@/lib/supabase-servidor';
import { hayClaveDeIA } from '@/lib/ia/cliente';
import { analizarConversacion } from '@/lib/ia/analista';
import { enviarAViajero, type ViajeroContacto } from '@/lib/ia/mensajeria';
import { puntuarLead, redactarSeguimiento } from '@/lib/ia/seguimiento';

/*
 * El motor de seguimiento. La base decide QUÉ toca (programar_automatizaciones
 * deja filas en dst_automatizacion_envio); aquí se decide CÓMO: mandar una
 * plantilla, pedirle un mensaje a la IA, crear una tarea, puntuar un lead.
 * Lo llama el cron de Vercel y también el botón "Correr ahora" del panel.
 */

type Automatizacion = {
  clave: string; nombre: string; accion: string; parametros: Record<string, unknown>;
  requiere_aprobacion: boolean; condiciones: Record<string, unknown>;
};

type Envio = {
  id: string; automatizacion_id: string; destino_id: string; solicitud_id: string | null; viajero_id: string | null;
  conversacion_id: string | null; intento: number; estado: string; programado_para: string; borrador: string | null;
  automatizacion: Automatizacion | Automatizacion[] | null;
};

export type Resumen = {
  destinos: number; programados: number; ejecutados: number; por_aprobar: number;
  omitidos: number; fallidos: number; pospuestos: number; analizadas: number; detalles: string[];
};

function horaLocal(zona: string): number {
  try {
    const partes = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: zona }).formatToParts(new Date());
    return Number(partes.find((p) => p.type === 'hour')?.value ?? 12) % 24;
  } catch {
    return 12;
  }
}

/** Entre las 21:00 y las 8:00 del destino no se molesta a nadie: se pospone a las 8:00. */
function proximaVentana(zona: string): string | null {
  const hora = horaLocal(zona);
  if (hora >= 8 && hora < 21) return null;
  const horasHasta8 = hora >= 21 ? 24 - hora + 8 : 8 - hora;
  return new Date(Date.now() + horasHasta8 * 3_600_000).toISOString();
}

function rellenar(texto: string, variables: Record<string, string | null | undefined>): string {
  return texto.replace(/\{\{([a-z_]+)\}\}/g, (_, clave: string) => variables[clave] ?? '');
}

export async function correrAutomatizaciones(opciones: { limite?: number; destino_id?: string | null } = {}): Promise<Resumen> {
  const db = servicio();
  const limite = opciones.limite ?? 40;
  const resumen: Resumen = { destinos: 0, programados: 0, ejecutados: 0, por_aprobar: 0, omitidos: 0, fallidos: 0, pospuestos: 0, analizadas: 0, detalles: [] };

  // 1. La base programa lo que toca.
  const { data: destinos } = await db.from('dst_destino').select('id, nombre, zona_horaria').eq('esta_activo', true);
  const zonas = new Map<string, string>();
  for (const d of destinos ?? []) {
    if (opciones.destino_id && d.id !== opciones.destino_id) continue;
    zonas.set(d.id, d.zona_horaria);
    const { data: n, error } = await db.rpc('programar_automatizaciones', { p_destino_id: d.id });
    if (error) resumen.detalles.push(`programar ${d.nombre}: ${error.message}`);
    resumen.programados += (n as number | null) ?? 0;
    resumen.destinos += 1;
  }

  // 2. Se ejecuta lo vencido.
  let consulta = db
    .from('dst_automatizacion_envio')
    .select('*, automatizacion:dst_automatizacion(clave, nombre, accion, parametros, requiere_aprobacion, condiciones)')
    .eq('estado', 'programado')
    .lte('programado_para', new Date().toISOString())
    .order('programado_para')
    .limit(limite);
  if (opciones.destino_id) consulta = consulta.eq('destino_id', opciones.destino_id);
  const { data: envios, error: fallo } = await consulta;
  if (fallo) resumen.detalles.push(`leer envíos: ${fallo.message}`);

  for (const envio of (envios ?? []) as Envio[]) {
    try {
      const estado = await ejecutarEnvio(envio, zonas.get(envio.destino_id) ?? 'America/Costa_Rica');
      if (estado === 'hecho') resumen.ejecutados += 1;
      else if (estado === 'pendiente_aprobacion') resumen.por_aprobar += 1;
      else if (estado === 'omitido') resumen.omitidos += 1;
      else if (estado === 'pospuesto') resumen.pospuestos += 1;
    } catch (error) {
      resumen.fallidos += 1;
      const mensaje = error instanceof Error ? error.message : String(error);
      resumen.detalles.push(`envío ${envio.id}: ${mensaje}`);
      await db.from('dst_automatizacion_envio').update({ estado: 'fallido', ejecutado_en: new Date().toISOString(), resultado: mensaje.slice(0, 500) }).eq('id', envio.id);
    }
  }

  // 3. Se analizan conversaciones con movimiento que nadie ha resumido.
  if (hayClaveDeIA()) {
    const hace30 = new Date(Date.now() - 30 * 60_000).toISOString();
    let pendientes = db
      .from('dst_conversacion')
      .select('id, metadatos, ultimo_mensaje_en')
      .gte('total_mensajes', 4)
      .lte('ultimo_mensaje_en', hace30)
      .order('ultimo_mensaje_en', { ascending: false })
      .limit(30);
    if (opciones.destino_id) pendientes = pendientes.eq('destino_id', opciones.destino_id);
    const { data: conversaciones } = await pendientes;
    let analizadas = 0;
    for (const c of conversaciones ?? []) {
      const analisis = (c.metadatos as { analisis?: { analizada_en?: string } } | null)?.analisis;
      if (analisis?.analizada_en && c.ultimo_mensaje_en && analisis.analizada_en >= c.ultimo_mensaje_en) continue;
      if (analizadas >= 10) break;
      try {
        await analizarConversacion(c.id as string, { origen: 'cron' });
        analizadas += 1;
      } catch (error) {
        resumen.detalles.push(`análisis ${c.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    resumen.analizadas = analizadas;
  }

  return resumen;
}

type Estado = 'hecho' | 'pendiente_aprobacion' | 'omitido' | 'pospuesto';

type SolicitudMinima = { id: string; etapa: string; tipo: string; responsable_id: string | null; itinerario_id: string | null };
type ViajeroMinimo = ViajeroContacto & { llega_el: string | null };

async function ejecutarEnvio(envio: Envio, zona: string): Promise<Estado> {
  const db = servicio();
  const a = (Array.isArray(envio.automatizacion) ? envio.automatizacion[0] : envio.automatizacion) as Automatizacion | null;
  if (!a) throw new Error('La automatización ya no existe.');
  const p = a.parametros ?? {};
  const ahora = new Date().toISOString();
  const cerrar = async (estado: Estado, resultado: string, extra: Record<string, unknown> = {}) => {
    await db.from('dst_automatizacion_envio').update({ estado, ejecutado_en: ahora, resultado: resultado.slice(0, 500), ...extra }).eq('id', envio.id);
    return estado;
  };

  // Lo que hay que saber de la solicitud y del viajero antes de actuar.
  let solicitud: SolicitudMinima | null = null;
  let viajero: ViajeroMinimo | null = null;
  if (envio.solicitud_id) {
    const { data } = await db.from('dst_solicitud').select('id, etapa, tipo, responsable_id, itinerario_id').eq('id', envio.solicitud_id).maybeSingle();
    solicitud = (data as SolicitudMinima | null) ?? null;
    if (!solicitud) return cerrar('omitido', 'La solicitud ya no existe.');
  }
  if (envio.viajero_id) {
    const { data } = await db.from('dst_viajero').select('id, nombre, email, whatsapp, idioma, no_molestar, llega_el').eq('id', envio.viajero_id).maybeSingle();
    viajero = (data as ViajeroMinimo | null) ?? null;
  }

  const esMensaje = a.accion === 'enviar_plantilla' || a.accion === 'mensaje_ia';
  if (esMensaje) {
    if (!viajero) return cerrar('omitido', 'Sin viajero al que escribir.');
    if (viajero.no_molestar) return cerrar('omitido', 'El viajero pidió que no le escriban.');
    if (solicitud && ['reservado', 'perdido'].includes(solicitud.etapa) && !(p.aunque_cerrada as boolean)) {
      return cerrar('omitido', `La solicitud ya está en ${solicitud.etapa}.`);
    }
    const ventana = proximaVentana(zona);
    if (ventana) {
      await db.from('dst_automatizacion_envio').update({ programado_para: ventana }).eq('id', envio.id);
      return 'pospuesto';
    }
  }

  const { data: destino } = await db.from('dst_destino').select('nombre, marca_nombre, dominio, whatsapp').eq('id', envio.destino_id).single();
  const canal: 'whatsapp' | 'email' = viajero?.whatsapp ? 'whatsapp' : 'email';

  switch (a.accion) {
    case 'puntuar': {
      if (!envio.solicitud_id) return cerrar('omitido', 'Sin solicitud que puntuar.');
      if (!hayClaveDeIA()) return cerrar('omitido', 'Falta ANTHROPIC_API_KEY.');
      const puntaje = await puntuarLead(envio.solicitud_id, { origen: 'cron' });
      return cerrar('hecho', `Puntaje ${puntaje.puntaje} (${puntaje.temperatura}): ${puntaje.siguiente_accion}`);
    }

    case 'enviar_plantilla': {
      const clave = String(p.plantilla ?? a.clave);
      const { data: plantilla } = await db.rpc('plantilla_para', {
        p_destino_id: envio.destino_id, p_clave: clave, p_canal: canal, p_idioma: viajero!.idioma ?? 'es',
      });
      const fila = (Array.isArray(plantilla) ? plantilla[0] : plantilla) as { asunto: string | null; cuerpo: string } | undefined;
      if (!fila) return cerrar('omitido', `No hay plantilla "${clave}" para ${canal}.`);

      let enlace = '';
      if (solicitud?.itinerario_id) {
        const { data: plan } = await db.from('dst_itinerario').select('babosa, idioma').eq('id', solicitud.itinerario_id).maybeSingle();
        if (plan) enlace = `https://${destino?.dominio}/${plan.idioma ?? viajero!.idioma ?? 'es'}/plan/${plan.babosa}`;
      }
      const variables = {
        nombre: viajero!.nombre ?? '',
        destino: destino?.nombre ?? '',
        marca: destino?.marca_nombre ?? '',
        llega_el: viajero!.llega_el ?? '',
        whatsapp_destino: destino?.whatsapp ?? '',
        enlace_itinerario: enlace ? (canal === 'whatsapp' ? `Tu plan: ${enlace} ` : enlace) : '',
      };
      const envioHecho = await enviarAViajero(envio.destino_id, viajero!, {
        texto: rellenar(fila.cuerpo, variables).replace(/[ \t]+\n/g, '\n').trim(),
        asunto: fila.asunto ? rellenar(fila.asunto, variables) : null,
        autor: 'sistema', automatico: true, plantilla: clave,
        metadatos: { automatizacion: a.clave, intento: envio.intento },
      }, canal);
      if (!envioHecho.mensaje_id) throw new Error(envioHecho.error ?? 'No se pudo enviar.');
      return cerrar('hecho', envioHecho.enviado ? `Enviado por ${envioHecho.canal}.` : `Guardado como pendiente de envío manual: ${envioHecho.error ?? ''}`, { mensaje_id: envioHecho.mensaje_id });
    }

    case 'mensaje_ia': {
      if (!envio.solicitud_id) return cerrar('omitido', 'Sin solicitud para redactar.');
      if (!hayClaveDeIA()) return cerrar('omitido', 'Falta ANTHROPIC_API_KEY.');
      const borrador = await redactarSeguimiento(envio.solicitud_id, {
        intento: Number(p.intento ?? envio.intento), canal, origen: 'cron',
      });
      if (a.requiere_aprobacion) {
        await db.from('dst_automatizacion_envio').update({
          estado: 'pendiente_aprobacion',
          borrador: borrador.asunto ? `${borrador.asunto}\n\n${borrador.mensaje}` : borrador.mensaje,
          resultado: borrador.razon.slice(0, 500),
        }).eq('id', envio.id);
        return 'pendiente_aprobacion';
      }
      const envioHecho = await enviarAViajero(envio.destino_id, viajero!, {
        texto: borrador.mensaje, asunto: borrador.asunto, autor: 'ia', automatico: true,
        plantilla: a.clave, metadatos: { automatizacion: a.clave, intento: envio.intento, razon: borrador.razon },
      }, canal);
      if (!envioHecho.mensaje_id) throw new Error(envioHecho.error ?? 'No se pudo enviar.');
      return cerrar('hecho', envioHecho.enviado ? `Enviado por ${envioHecho.canal}.` : `Pendiente de envío manual: ${envioHecho.error ?? ''}`, { mensaje_id: envioHecho.mensaje_id, borrador: borrador.mensaje });
    }

    case 'crear_tarea':
    case 'avisar_equipo': {
      const { data: tarea, error } = await db.from('dst_tarea').insert({
        destino_id: envio.destino_id,
        titulo: String(p.titulo ?? a.nombre).slice(0, 160),
        detalle: `Automatización "${a.nombre}"${viajero?.nombre ? ` · ${viajero.nombre}` : ''}${envio.conversacion_id ? ` · conversación ${envio.conversacion_id}` : ''}`,
        viajero_id: envio.viajero_id,
        solicitud_id: envio.solicitud_id,
        responsable_id: solicitud?.responsable_id ?? null,
        prioridad: ['baja', 'media', 'alta', 'urgente'].includes(String(p.prioridad)) ? String(p.prioridad) : a.accion === 'avisar_equipo' ? 'alta' : 'media',
        vence_el: new Date().toISOString().slice(0, 10),
      }).select('id').single();
      if (error) throw new Error(error.message);
      return cerrar('hecho', 'Tarea creada.', { tarea_id: tarea.id });
    }

    case 'cambiar_etapa': {
      const etapa = String(p.etapa ?? '');
      if (!envio.solicitud_id || !['nuevo', 'contactado', 'propuesta_enviada', 'negociacion', 'reservado', 'perdido'].includes(etapa)) {
        return cerrar('omitido', 'Etapa inválida o sin solicitud.');
      }
      const { error } = await db.from('dst_solicitud').update({
        etapa, ...(etapa === 'perdido' ? { motivo_perdida: String(p.motivo ?? 'sin respuesta') } : {}),
      }).eq('id', envio.solicitud_id);
      if (error) throw new Error(error.message);
      return cerrar('hecho', `Etapa → ${etapa}.`);
    }

    default:
      return cerrar('omitido', `Acción desconocida: ${a.accion}.`);
  }
}

/** Una persona aprueba (y opcionalmente corrige) un borrador de la IA. */
export async function aprobarEnvio(envioId: string, usuarioId: string, textoFinal?: string | null): Promise<{ ok: boolean; error?: string }> {
  const db = servicio();
  const { data: envio } = await db
    .from('dst_automatizacion_envio')
    .select('*, automatizacion:dst_automatizacion(clave, nombre, accion, parametros, requiere_aprobacion, condiciones)')
    .eq('id', envioId)
    .maybeSingle();
  if (!envio || envio.estado !== 'pendiente_aprobacion') return { ok: false, error: 'El envío no está pendiente de aprobación.' };
  if (!envio.viajero_id) return { ok: false, error: 'Sin viajero.' };

  const { data: viajero } = await db.from('dst_viajero').select('id, nombre, email, whatsapp, idioma, no_molestar').eq('id', envio.viajero_id).single();
  if (!viajero) return { ok: false, error: 'El viajero no existe.' };

  const crudo = (textoFinal?.trim() || envio.borrador || '').trim();
  if (!crudo) return { ok: false, error: 'No hay texto que enviar.' };
  const [primera, ...resto] = crudo.split('\n\n');
  const esCorreo = !viajero.whatsapp && !!viajero.email;
  const asunto = esCorreo && resto.length ? primera : null;
  const texto = esCorreo && resto.length ? resto.join('\n\n') : crudo;

  const a = (Array.isArray(envio.automatizacion) ? envio.automatizacion[0] : envio.automatizacion) as Automatizacion | null;
  const enviado = await enviarAViajero(envio.destino_id, viajero, {
    texto, asunto, autor: 'ia', usuario_id: usuarioId, automatico: true,
    plantilla: a?.clave ?? null, metadatos: { aprobado_por: usuarioId, automatizacion: a?.clave },
  });
  if (!enviado.mensaje_id) return { ok: false, error: enviado.error ?? 'No se pudo enviar.' };

  await db.from('dst_automatizacion_envio').update({
    estado: 'hecho', ejecutado_en: new Date().toISOString(), aprobado_por: usuarioId, mensaje_id: enviado.mensaje_id,
    resultado: enviado.enviado ? `Aprobado y enviado por ${enviado.canal}.` : `Aprobado; pendiente de envío manual: ${enviado.error ?? ''}`,
  }).eq('id', envioId);
  return { ok: true };
}

export async function descartarEnvio(envioId: string, usuarioId: string): Promise<void> {
  await servicio().from('dst_automatizacion_envio').update({
    estado: 'cancelado', ejecutado_en: new Date().toISOString(), aprobado_por: usuarioId, resultado: 'Descartado desde el panel.',
  }).eq('id', envioId).eq('estado', 'pendiente_aprobacion');
}
