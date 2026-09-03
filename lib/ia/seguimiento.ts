import 'server-only';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { servicio } from '@/lib/supabase-servidor';
import { agenteDe, ahoraEn, ejecutar, parametrosBase, sistemaCacheado, type Origen } from './cliente';
import { NOMBRE_IDIOMA } from './modelos';

/*
 * El agente de seguimiento: puntúa cada prospecto (0-100, frío/tibio/caliente)
 * con una siguiente acción concreta, y redacta los mensajes de seguimiento en
 * el idioma del viajero. No envía nada por sí mismo: eso lo hacen las
 * automatizaciones o una persona desde el panel.
 */

type Ficha = {
  viajero: Record<string, unknown> & { id: string; nombre: string | null; idioma: string | null; email: string | null; whatsapp: string | null; llega_el: string | null; sale_el: string | null };
  solicitudes: (Record<string, unknown> & { id: string; tipo: string; etapa: string; creado_en: string; mensaje: string | null; itinerario_id: string | null })[];
  reservas: unknown[];
  conversaciones: { id: string; canal: string; estado: string; resumen_ia: string | null; sentimiento: string | null; intencion: string | null; total_mensajes: number }[];
  itinerarios: { id: string; titulo: string; babosa: string; dias: number; idioma: string }[];
  tareas: unknown[];
  mensajes: { canal: string; direccion: string; autor: string; cuerpo: string; automatico: boolean; enviado_en: string; plantilla: string | null }[];
};

async function fichaDeSolicitud(solicitudId: string) {
  const db = servicio();
  const { data: s, error } = await db
    .from('dst_solicitud')
    .select('id, destino_id, viajero_id, tipo, etapa, mensaje, valor_estimado_usd, itinerario_id, creado_en')
    .eq('id', solicitudId)
    .single();
  if (error || !s) throw new Error(`No existe la solicitud ${solicitudId}.`);

  const [{ data: ficha, error: fallo }, { data: destino }] = await Promise.all([
    db.rpc('contexto_viajero', { p_viajero_id: s.viajero_id, p_max_mensajes: 30 }),
    db.from('dst_destino').select('nombre, marca_nombre, dominio, zona_horaria, whatsapp, email_contacto').eq('id', s.destino_id).single(),
  ]);
  if (fallo) throw new Error(`contexto_viajero: ${fallo.message}`);
  if (!destino) throw new Error('El destino no existe.');
  return { solicitud: s, ficha: ficha as Ficha, destino };
}

function fichaComoTexto(ficha: Ficha, solicitudId: string, zona: string): string {
  const v = ficha.viajero;
  const solicitudes = ficha.solicitudes.map((s) =>
    `- ${s.id === solicitudId ? '[ESTA] ' : ''}${s.tipo} · etapa ${s.etapa} · creada ${s.creado_en}${s.mensaje ? ` · "${String(s.mensaje).slice(0, 300)}"` : ''}${s.itinerario_id ? ' · tiene plan' : ''}`
  );
  const mensajes = ficha.mensajes.slice(-25).map((m) =>
    `- [${m.enviado_en}] ${m.direccion === 'entrante' ? 'VIAJERO' : m.autor.toUpperCase()}${m.automatico ? ' (automático)' : ''} por ${m.canal}: ${m.cuerpo.slice(0, 400)}`
  );
  return [
    `AHORA EN EL DESTINO: ${ahoraEn(zona)}`,
    '',
    'VIAJERO',
    JSON.stringify({
      nombre: v.nombre, idioma: v.idioma, pais: v.pais_iso, email: v.email ? 'sí' : 'no', whatsapp: v.whatsapp ? 'sí' : 'no',
      llega_el: v.llega_el, sale_el: v.sale_el, personas: v.personas, ninos: v.ninos, tipo_viajero: v.tipo_viajero,
      presupuesto: v.presupuesto, intereses: v.intereses, origen: v.origen, utm_fuente: v.utm_fuente, creado_en: v.creado_en,
      notas_del_equipo: v.notas, no_molestar: v.no_molestar,
    }),
    '',
    `SOLICITUDES (${ficha.solicitudes.length})`,
    solicitudes.join('\n') || '(ninguna)',
    '',
    `RESERVAS PREVIAS: ${ficha.reservas.length}`,
    `CONVERSACIONES: ${ficha.conversaciones.map((c) => `${c.canal}/${c.estado}${c.resumen_ia ? ` "${c.resumen_ia}"` : ''}${c.sentimiento ? ` (${c.sentimiento})` : ''}`).join('; ') || 'ninguna'}`,
    `PLANES ARMADOS: ${ficha.itinerarios.map((i) => `"${i.titulo}" (${i.dias} días)`).join('; ') || 'ninguno'}`,
    '',
    `ÚLTIMOS MENSAJES (${ficha.mensajes.length})`,
    mensajes.join('\n') || '(sin mensajes todavía)',
  ].join('\n');
}

export const EsquemaPuntaje = z.object({
  puntaje: z.number().int().describe('0 a 100: probabilidad de que termine reservando con nosotros'),
  temperatura: z.enum(['frio', 'tibio', 'caliente']),
  motivo: z.string().describe('Por qué ese puntaje, en 1 o 2 frases, para el equipo'),
  siguiente_accion: z.string().describe('Qué hacer ahora con este prospecto: concreto, una frase, empieza con un verbo'),
  siguiente_accion_en_horas: z.number().describe('Cuándo hacerla, en horas desde ahora (0 = ya)'),
  resumen: z.string().describe('Quién es y qué quiere, en 2 frases'),
  valor_estimado_usd: z.number().nullable().describe('Cuánto podría valer esta oportunidad en ventas (USD); null si no hay base'),
});

export type Puntaje = z.infer<typeof EsquemaPuntaje>;

const CRITERIOS = [
  'Sos el analista comercial de un equipo de turismo receptivo. Puntuás prospectos con criterio de vendedor experimentado, no con optimismo.',
  '',
  'SUBE EL PUNTAJE: fechas de viaje definidas y dentro de los próximos 90 días; WhatsApp disponible; respondió mensajes nuestros; pidió algo concreto (tour, hotel, plan); presupuesto medio o alto; grupo grande; ya tiene plan armado y lo abrió o comentó; viene de referido o de una guía específica.',
  'BAJA EL PUNTAJE: sin fechas; solo correo y nunca respondió; pregunta genérica; lleva más de 2 semanas sin responder; pidió que no le escriban; presupuesto económico con expectativas de lujo; ya reservó por otro lado.',
  'TEMPERATURA: caliente >= 70, tibio 40-69, frío < 40.',
  'SIGUIENTE ACCIÓN: una sola, la más útil ahora (llamar, mandar propuesta de X, esperar respuesta hasta tal día, cerrar como perdido, pedir fechas, mandar el plan, ofrecer alternativa más barata). En horas: 0 si es ya; 24 si es mañana; 72 para dar tiempo.',
  'VALOR: estimá con precios típicos de la región (tour 60-150 USD por persona, noche de hotel 80-300 USD, traslado 50-200 USD) por la cantidad de personas y días; null si no hay nada que estimar.',
  'Escribí motivo, siguiente_accion y resumen en español, para el equipo.',
].join('\n');

/** Puntúa una solicitud y guarda puntaje, temperatura, siguiente acción y resumen. */
export async function puntuarLead(
  solicitudId: string,
  opciones: { origen: Origen; solicitado_por?: string | null }
): Promise<Puntaje> {
  const { solicitud, ficha, destino } = await fichaDeSolicitud(solicitudId);
  const agente = await agenteDe(solicitud.destino_id, 'seguimiento');

  const { resultado } = await ejecutar(
    {
      destino_id: solicitud.destino_id,
      agente: { ...agente, clave: 'seguimiento' },
      origen: opciones.origen,
      solicitado_por: opciones.solicitado_por,
      vinculos: { solicitud_id: solicitud.id, viajero_id: solicitud.viajero_id },
    },
    async ({ client, medidor }) => {
      const base = parametrosBase(agente);
      const respuesta = await client.messages.parse({
        ...base,
        max_tokens: Math.min(agente.max_tokens, 2000),
        output_config: { ...(base.output_config ?? {}), format: zodOutputFormat(EsquemaPuntaje) },
        system: sistemaCacheado(`${CRITERIOS}\n\nDESTINO: ${destino.nombre} (${destino.marca_nombre}).${agente.instrucciones ? `\nINSTRUCCIONES DEL EQUIPO: ${agente.instrucciones}` : ''}`),
        messages: [{ role: 'user', content: `Puntuá la solicitud marcada [ESTA].\n\n${fichaComoTexto(ficha, solicitud.id, destino.zona_horaria)}` }],
      });
      medidor.sumar(respuesta.usage, respuesta.stop_reason);
      if (respuesta.stop_reason === 'refusal' || !respuesta.parsed_output) throw new Error('El modelo no devolvió un puntaje.');
      return respuesta.parsed_output;
    },
    (r) => ({ puntaje: r.puntaje, temperatura: r.temperatura, siguiente_accion: r.siguiente_accion })
  );

  const db = servicio();
  const puntaje = Math.min(Math.max(Math.round(resultado.puntaje), 0), 100);
  const cuando = new Date(Date.now() + Math.max(0, resultado.siguiente_accion_en_horas) * 3_600_000).toISOString();

  await db.from('dst_solicitud').update({
    puntaje_ia: puntaje,
    temperatura: resultado.temperatura,
    motivo_puntaje: resultado.motivo,
    siguiente_accion: resultado.siguiente_accion,
    siguiente_accion_el: cuando,
    resumen_ia: resultado.resumen,
    puntuada_en: new Date().toISOString(),
    ...(solicitud.valor_estimado_usd == null && resultado.valor_estimado_usd != null
      ? { valor_estimado_usd: Math.round(resultado.valor_estimado_usd) }
      : {}),
  }).eq('id', solicitud.id);

  await db.from('dst_viajero').update({ resumen_ia: resultado.resumen }).eq('id', solicitud.viajero_id);

  return { ...resultado, puntaje };
}

export const EsquemaMensaje = z.object({
  mensaje: z.string().describe('El mensaje listo para enviar, en el idioma del viajero'),
  asunto: z.string().nullable().describe('Asunto si el canal es correo; null si es WhatsApp'),
  razon: z.string().describe('Por qué este enfoque, en una frase, para el equipo'),
});

export type Borrador = z.infer<typeof EsquemaMensaje>;

/**
 * Redacta el seguimiento número N para una solicitud. Devuelve el borrador;
 * enviarlo es decisión de la automatización o de la persona que lo aprueba.
 */
export async function redactarSeguimiento(
  solicitudId: string,
  opciones: { intento: number; canal: 'whatsapp' | 'email'; origen: Origen; solicitado_por?: string | null; indicaciones?: string | null }
): Promise<Borrador> {
  const { solicitud, ficha, destino } = await fichaDeSolicitud(solicitudId);
  const [agente, concierge] = await Promise.all([
    agenteDe(solicitud.destino_id, 'seguimiento'),
    agenteDe(solicitud.destino_id, 'concierge'),
  ]);
  const idioma = ficha.viajero.idioma ?? 'es';
  const plan = ficha.itinerarios[0];
  const urlPlan = plan ? `https://${destino.dominio}/${plan.idioma ?? idioma}/plan/${plan.babosa}` : null;

  const sistema = [
    `Sos ${concierge.nombre}, del equipo de ${destino.marca_nombre} en ${destino.nombre}. Escribís mensajes de seguimiento a prospectos que pidieron algo y no han respondido.`,
    '',
    'CÓMO SE ESCRIBE',
    `- En ${NOMBRE_IDIOMA[idioma] ?? idioma}, tuteando con calidez y sin exagerar.`,
    opciones.canal === 'whatsapp'
      ? '- WhatsApp: máximo 80 palabras, sin markdown, sin asunto, sin listas. Un solo mensaje.'
      : '- Correo: máximo 150 palabras, con asunto corto y concreto, saludo y firma con tu nombre y la marca.',
    '- Referí algo concreto de lo que pidió (fechas, termales, rafting, el plan que le mandamos). Nada genérico.',
    '- Una sola pregunta o propuesta concreta que sea fácil de contestar.',
    '- No repitas lo que ya le dijimos en mensajes anteriores. No inventes precios ni disponibilidad.',
    '- Nunca digas que sos una IA. Nunca presiones ni uses urgencia falsa.',
    '- Intento 1: retomar con una pregunta útil. Intento 2: una propuesta concreta o una alternativa. Intento 3 o más: cierre suave, dejar la puerta abierta y despedirse bien.',
    urlPlan ? `- Ya tiene un plan armado: ${urlPlan}. Si viene al caso, mencionalo (podés pegar el enlace).` : '- No tiene plan armado todavía.',
    agente.instrucciones ? `\nINSTRUCCIONES DEL EQUIPO\n${agente.instrucciones}` : '',
    opciones.indicaciones ? `\nINDICACIONES PARA ESTE MENSAJE\n${opciones.indicaciones}` : '',
  ].join('\n');

  const { resultado } = await ejecutar(
    {
      destino_id: solicitud.destino_id,
      agente,
      origen: opciones.origen,
      solicitado_por: opciones.solicitado_por,
      vinculos: { solicitud_id: solicitud.id, viajero_id: solicitud.viajero_id },
    },
    async ({ client, medidor }) => {
      const base = parametrosBase(agente);
      const respuesta = await client.messages.parse({
        ...base,
        output_config: { ...(base.output_config ?? {}), format: zodOutputFormat(EsquemaMensaje) },
        system: sistemaCacheado(sistema),
        messages: [{
          role: 'user',
          content: `Escribí el seguimiento número ${opciones.intento} por ${opciones.canal} para la solicitud marcada [ESTA].\n\n${fichaComoTexto(ficha, solicitud.id, destino.zona_horaria)}`,
        }],
      });
      medidor.sumar(respuesta.usage, respuesta.stop_reason);
      if (respuesta.stop_reason === 'refusal' || !respuesta.parsed_output) throw new Error('El modelo no devolvió un mensaje.');
      return respuesta.parsed_output;
    },
    (r) => ({ largo: r.mensaje.length, razon: r.razon })
  );

  return resultado;
}
