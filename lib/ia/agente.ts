import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { servicio } from '@/lib/supabase-servidor';
import { agenteDe, ahoraEn, ejecutar, parametrosBase, textoDe, type Agente, type Origen } from './cliente';
import { buscarConocimiento, bloqueConocimiento, conocimientoBase } from './conocimiento';
import { NOMBRE_IDIOMA } from './modelos';
import { enviarEnConversacion } from './mensajeria';

/*
 * El concierge: el agente que conversa con el viajero por el chat web, por
 * WhatsApp o por correo. Tiene herramientas para buscar en el conocimiento y
 * en el catálogo, guardar lo que el viajero cuenta, crear la solicitud cuando
 * quiere reservar y pasarle la conversación a una persona. Todo lo que hace
 * queda en dst_agente_ejecucion; cada respuesta, en dst_mensaje.
 */

type Autor = 'viajero' | 'ia' | 'equipo' | 'sistema';

type Contexto = {
  conversacion: {
    id: string; destino_id: string; viajero_id: string | null; solicitud_id: string | null;
    canal: 'web' | 'whatsapp' | 'email' | 'llamada' | 'nota_interna'; identificador_externo: string | null;
    idioma: string; estado: string; atendida_por: 'ia' | 'humano'; agente_id: string | null;
    metadatos: Record<string, unknown>;
  };
  viajero: {
    id: string; nombre: string | null; apellidos: string | null; email: string | null; whatsapp: string | null;
    pais_iso: string | null; idioma: string | null; llega_el: string | null; sale_el: string | null;
    personas: number | null; ninos: number | null; tipo_viajero: string | null; presupuesto: string | null;
    intereses: string[] | null; no_molestar: boolean; resumen_ia: string | null;
  } | null;
  solicitud: {
    id: string; tipo: string; etapa: string; mensaje: string | null; itinerario_id: string | null;
    valor_estimado_usd: number | null; siguiente_accion: string | null;
  } | null;
  mensajes: { id: string; autor: Autor; direccion: string; cuerpo: string; enviado_en: string; automatico: boolean }[];
  notas: { cuerpo: string; enviado_en: string }[];
};

export type RespuestaConcierge = {
  texto: string | null;
  mensaje_id: string | null;
  escalada: boolean;
  ejecucion_id: string | null;
  solicitud_creada: { id: string; tipo: string } | null;
  motivo?: string;
};

const TIPOS_VIAJERO = ['pareja', 'familia', 'amigos', 'solo', 'grupo', 'negocios'] as const;
const PRESUPUESTOS = ['economico', 'medio', 'alto', 'lujo'] as const;
const IDIOMAS = ['es', 'en', 'pt', 'fr', 'de'] as const;
const SECCIONES = ['que_hacer', 'tours', 'donde_dormir', 'comer_beber', 'explorar', 'transporte'] as const;

const ESPERA: Record<string, string> = {
  es: 'Dame un momento: una persona del equipo te escribe enseguida.',
  en: 'One moment: a member of our team will write to you shortly.',
  pt: 'Um momento: alguém da equipe vai te escrever em breve.',
  fr: 'Un instant : une personne de notre équipe vous écrit très vite.',
  de: 'Einen Moment: jemand aus unserem Team meldet sich gleich bei dir.',
};

function normalizarWhatsapp(valor: string | null | undefined): string | null {
  if (!valor) return null;
  let limpio = valor.replace(/[\s\-().]/g, '');
  if (limpio.startsWith('00')) limpio = `+${limpio.slice(2)}`;
  if (!limpio.startsWith('+') && /^\d{8,15}$/.test(limpio)) limpio = `+${limpio}`;
  return /^\+[1-9][0-9]{6,14}$/.test(limpio) ? limpio : null;
}

function normalizarEmail(valor: string | null | undefined): string | null {
  const limpio = valor?.trim().toLowerCase() ?? '';
  return /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(limpio) ? limpio : null;
}

function promptConcierge(
  agente: Agente,
  destino: { nombre: string; pais_nombre: string; marca_nombre: string; whatsapp: string | null; email_contacto: string | null; dominio: string },
  canal: string,
  categorias: string,
  conocimiento: string
): string {
  const forma = canal === 'whatsapp'
    ? 'Mensajes cortos: máximo 90 palabras, sin markdown, sin listas largas, una sola pregunta por mensaje.'
    : canal === 'email'
      ? 'Correos breves y claros: máximo 180 palabras, saludo y firma, sin markdown.'
      : 'Respuestas breves: máximo 150 palabras. Podés usar viñetas cortas. Una pregunta al final como mucho.';

  return [
    `Sos ${agente.nombre}, del equipo de ${destino.marca_nombre}, y ayudás a viajeros que quieren ir a ${destino.nombre}, ${destino.pais_nombre}. Hablás con ellos por ${canal}.`,
    '',
    'QUIÉN SOS',
    'Una persona del equipo local: conocés el destino, sos cálida, concreta y honesta. No decís que sos una IA salvo que te lo pregunten directamente; entonces lo decís sin drama y seguís ayudando.',
    '',
    'IDIOMA',
    'Respondé siempre en el idioma en que te escribe el viajero. Si cambia de idioma, cambiá con él.',
    '',
    'FORMA',
    forma,
    '',
    'QUÉ HACÉS, EN ORDEN',
    '1. Respondés dudas con el conocimiento y el catálogo. Si no estás segura, buscá con las herramientas ANTES de responder; no adivines.',
    '2. Recomendás negocios y tours del catálogo (buscar_lugares, buscar_tours) y das el enlace cuando lo tengas. Máximo tres opciones por mensaje.',
    '3. Guardás lo que el viajero cuenta de su viaje apenas aparezca (guardar_datos_viajero): nombre, contacto, fechas, personas, con quién viaja, presupuesto, intereses.',
    '4. Cuando quiere reservar o que le armen algo, pedís lo que falta (fechas, personas, y un WhatsApp o correo si no lo tenemos) y creás la solicitud (crear_solicitud). Explicás que una persona del equipo confirma disponibilidad y precio, normalmente en menos de 24 horas.',
    '5. Pasás la conversación a una persona (escalar_a_humano) ante quejas, temas de salud o seguridad, dinero o asuntos legales, si el viajero lo pide, o si no encontrás la respuesta.',
    '',
    'REGLAS QUE NO SE NEGOCIAN',
    '- No inventes precios, horarios ni disponibilidad. Si no está en el conocimiento ni en el catálogo, decí que el equipo lo confirma.',
    '- Nunca confirmás una reserva ni prometés cupo.',
    '- Nunca digas que un negocio es "nuestro" ni favorezcas a uno por razones comerciales: recomendá por lo que busca el viajero.',
    '- No muestres ids internos, notas internas ni datos de otros viajeros.',
    '- No des consejos médicos ni legales: escalá.',
    '- Si te insultan o te piden algo ajeno a viajes, respondé con calma, volvé al tema o escalá.',
    '- Si el viajero pide que no le escriban más, usá no_molestar y despedite con respeto.',
    agente.instrucciones ? `\nINSTRUCCIONES DEL EQUIPO\n${agente.instrucciones}` : '',
    agente.tono ? `\nTONO\n${agente.tono}` : '',
    '',
    'CONTACTO HUMANO DEL EQUIPO',
    [destino.whatsapp ? `WhatsApp ${destino.whatsapp}` : null, destino.email_contacto ? `correo ${destino.email_contacto}` : null]
      .filter(Boolean).join(' · ') || '(no configurado: no inventes un número ni un correo)',
    '',
    `CATEGORÍAS DEL DESTINO: ${categorias}`,
    '',
    '## LO QUE SABEMOS DEL DESTINO (siempre a mano)',
    conocimiento,
  ].join('\n');
}

function perfilViajero(ctx: Contexto, zona: string, urlPlan: string | null): string {
  const v = ctx.viajero;
  const s = ctx.solicitud;
  const lineas = [
    `FECHA Y HORA EN EL DESTINO: ${ahoraEn(zona, ctx.conversacion.idioma)}.`,
    `IDIOMA DE LA CONVERSACIÓN: ${NOMBRE_IDIOMA[ctx.conversacion.idioma] ?? ctx.conversacion.idioma}.`,
    v
      ? `SOBRE ESTE VIAJERO: ${[
          v.nombre ? `se llama ${v.nombre}` : 'no sabemos su nombre',
          v.whatsapp ? 'tenemos su WhatsApp' : v.email ? 'tenemos su correo' : 'NO tenemos contacto (pedilo antes de crear una solicitud)',
          v.llega_el ? `llega el ${v.llega_el}${v.sale_el ? ` y se va el ${v.sale_el}` : ''}` : 'sin fechas',
          v.personas ? `${v.personas} persona(s)${v.ninos ? `, ${v.ninos} niño(s)` : ''}` : null,
          v.tipo_viajero ? `viaja ${v.tipo_viajero}` : null,
          v.presupuesto ? `presupuesto ${v.presupuesto}` : null,
          v.intereses?.length ? `intereses: ${v.intereses.join(', ')}` : null,
          v.resumen_ia ? `resumen previo: ${v.resumen_ia}` : null,
        ].filter(Boolean).join('; ')}.`
      : 'SOBRE ESTE VIAJERO: todavía no sabemos nada; es un visitante anónimo del chat. Si quiere reservar, pedile nombre y WhatsApp o correo.',
    s ? `SOLICITUD ABIERTA: tipo ${s.tipo}, etapa ${s.etapa}${s.mensaje ? `, pidió: "${s.mensaje.slice(0, 300)}"` : ''}.` : 'No tiene ninguna solicitud abierta.',
    urlPlan ? `YA TIENE UN PLAN ARMADO: ${urlPlan} (compartilo si viene al caso).` : null,
    ctx.notas.length ? `NOTAS INTERNAS DEL EQUIPO (no las repitas al viajero): ${ctx.notas.map((n) => n.cuerpo).join(' | ').slice(0, 800)}` : null,
  ].filter(Boolean);
  return lineas.join('\n');
}

/** Convierte el hilo guardado en turnos para el modelo. */
function turnos(mensajes: Contexto['mensajes']): Anthropic.Beta.BetaMessageParam[] {
  const salida: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of mensajes) {
    const cuerpo = (m.cuerpo ?? '').trim().slice(0, 4000);
    if (!cuerpo) continue;
    const role = m.autor === 'viajero' ? 'user' : 'assistant';
    const texto = m.autor === 'equipo' ? `[respuesta escrita por una persona del equipo] ${cuerpo}` : cuerpo;
    const ultimo = salida.at(-1);
    if (ultimo && ultimo.role === role && typeof ultimo.content === 'string') {
      ultimo.content = `${ultimo.content}\n\n${texto}`;
    } else {
      salida.push({ role, content: texto });
    }
  }
  if (salida.length && salida[0].role !== 'user') {
    salida.unshift({ role: 'user', content: '[inicio de la conversación: el equipo escribió primero]' });
  }
  return salida;
}

/**
 * Un borrador de respuesta para que una persona del equipo lo revise y lo
 * mande: mismo prompt que el concierge, pero solo con herramientas de lectura
 * y sin guardar ni enviar nada. Sirve cuando la conversación la atiende un
 * humano y quiere ayuda.
 */
export async function sugerirRespuesta(
  conversacionId: string,
  opciones: { solicitado_por?: string | null; indicaciones?: string | null }
): Promise<{ texto: string; ejecucion_id: string | null }> {
  const db = servicio();
  const { data: crudo, error } = await db.rpc('contexto_conversacion', { p_conversacion_id: conversacionId, p_max_mensajes: 30 });
  if (error) throw new Error(`contexto_conversacion: ${error.message}`);
  const ctx = crudo as Contexto;
  if (!ctx?.conversacion) throw new Error('La conversación no existe.');
  if (!ctx.mensajes.length) throw new Error('La conversación no tiene mensajes.');
  const conv = ctx.conversacion;

  const agente = await agenteDe(conv.destino_id, 'concierge');
  const [{ data: destino }, base, { data: cats }] = await Promise.all([
    db.from('dst_destino').select('nombre, pais_nombre, marca_nombre, whatsapp, email_contacto, zona_horaria, dominio').eq('id', conv.destino_id).single(),
    conocimientoBase(conv.destino_id, 'concierge', 7),
    db.from('dst_destino_categoria').select('categoria:dst_categoria(babosa, nombre, seccion)').eq('destino_id', conv.destino_id).eq('es_visible', true),
  ]);
  if (!destino) throw new Error('El destino no existe.');
  const categorias = (cats ?? [])
    .map((f) => (Array.isArray(f.categoria) ? f.categoria[0] : f.categoria) as { babosa: string; nombre: string; seccion: string } | null)
    .filter((c): c is { babosa: string; nombre: string; seccion: string } => !!c)
    .map((c) => `${c.nombre} (${c.seccion})`).join(', ');

  const sistema = promptConcierge(agente, destino, conv.canal, categorias, bloqueConocimiento(base));
  const perfil = perfilViajero(ctx, destino.zona_horaria, null)
    + '\n\nMODO BORRADOR: una persona del equipo va a revisar y mandar tu respuesta. Escribí solo el mensaje para el viajero, listo para enviar.'
    + (opciones.indicaciones ? `\nINDICACIONES DE LA PERSONA: ${opciones.indicaciones}` : '');

  const lectura = [
    betaZodTool({
      name: 'buscar_conocimiento',
      description: 'Buscá en lo que el equipo sabe del destino. Consulta corta y en español.',
      inputSchema: z.object({ consulta: z.string() }),
      run: async ({ consulta }) => {
        const encontrado = await buscarConocimiento(conv.destino_id, consulta, 5, 'concierge');
        return encontrado.length ? encontrado.map((k) => `## ${k.titulo}\n${k.contenido}`).join('\n\n') : 'Nada sobre eso en el conocimiento.';
      },
    }),
  ];

  const turnosPrevios = turnos(ctx.mensajes);
  if (turnosPrevios.at(-1)?.role !== 'user') {
    turnosPrevios.push({ role: 'user', content: '[la persona del equipo pide un borrador de respuesta o de seguimiento para este viajero]' });
  }

  const { resultado, ejecucion_id } = await ejecutar(
    { destino_id: conv.destino_id, agente, origen: 'panel', solicitado_por: opciones.solicitado_por,
      vinculos: { conversacion_id: conv.id, solicitud_id: conv.solicitud_id, viajero_id: conv.viajero_id } },
    async ({ client, medidor }) => {
      const runner = client.beta.messages.toolRunner({
        ...parametrosBase(agente),
        system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }, { type: 'text', text: perfil }],
        messages: turnosPrevios,
        tools: lectura,
        max_iterations: 4,
      });
      let final: Anthropic.Beta.BetaMessage | undefined;
      for await (const mensaje of runner) {
        final = mensaje;
        medidor.sumar(mensaje.usage, mensaje.stop_reason);
        for (const bloque of mensaje.content) if (bloque.type === 'tool_use') medidor.herramienta(bloque.name);
      }
      return final ? textoDe(final.content) : '';
    },
    (texto) => ({ largo: texto.length, borrador: true })
  );
  if (!resultado) throw new Error('El modelo no devolvió un borrador.');
  return { texto: resultado, ejecucion_id };
}

/**
 * Responde al último mensaje del viajero en una conversación. Devuelve el
 * texto (ya guardado y enviado por el canal) o null con el motivo.
 */
export async function responderConversacion(
  conversacionId: string,
  opciones: { origen: Origen; forzar?: boolean }
): Promise<RespuestaConcierge> {
  const db = servicio();
  const vacio = (motivo: string): RespuestaConcierge =>
    ({ texto: null, mensaje_id: null, escalada: false, ejecucion_id: null, solicitud_creada: null, motivo });

  const { data: crudo, error } = await db.rpc('contexto_conversacion', { p_conversacion_id: conversacionId, p_max_mensajes: 30 });
  if (error) throw new Error(`contexto_conversacion: ${error.message}`);
  const ctx = crudo as Contexto;
  if (!ctx?.conversacion) return vacio('La conversación no existe.');

  const conv = ctx.conversacion;
  if (conv.atendida_por === 'humano' && !opciones.forzar) return vacio('La conversación la atiende una persona.');
  if (conv.estado === 'cerrada') return vacio('La conversación está cerrada.');

  const ultimo = ctx.mensajes.at(-1);
  if (!ultimo || ultimo.autor !== 'viajero') return vacio('No hay un mensaje nuevo del viajero.');

  const agente = await agenteDe(conv.destino_id, 'concierge');
  if (!agente.esta_activo) return vacio('El concierge está apagado en este destino.');

  const [{ data: destino }, base, { data: cats }, { data: plan }] = await Promise.all([
    db.from('dst_destino').select('nombre, pais_nombre, marca_nombre, whatsapp, email_contacto, zona_horaria, dominio').eq('id', conv.destino_id).single(),
    conocimientoBase(conv.destino_id, 'concierge', 7),
    db.from('dst_destino_categoria').select('categoria:dst_categoria(babosa, nombre, seccion)').eq('destino_id', conv.destino_id).eq('es_visible', true),
    ctx.solicitud?.itinerario_id
      ? db.from('dst_itinerario').select('babosa').eq('id', ctx.solicitud.itinerario_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!destino) return vacio('El destino no existe.');

  const categorias = (cats ?? [])
    .map((f) => (Array.isArray(f.categoria) ? f.categoria[0] : f.categoria) as { babosa: string; nombre: string; seccion: string } | null)
    .filter((c): c is { babosa: string; nombre: string; seccion: string } => !!c)
    .map((c) => `${c.nombre} (${c.seccion})`)
    .join(', ');

  const urlPlan = plan?.babosa ? `https://${destino.dominio}/${conv.idioma}/plan/${plan.babosa}` : null;
  const sistema = promptConcierge(agente, destino, conv.canal, categorias, bloqueConocimiento(base));
  const perfil = perfilViajero(ctx, destino.zona_horaria, urlPlan);

  // Lo que las herramientas van cambiando mientras el modelo trabaja.
  const estado = {
    viajero_id: conv.viajero_id,
    solicitud_id: conv.solicitud_id,
    idioma: conv.idioma,
    escalada: false,
    solicitud_creada: null as { id: string; tipo: string } | null,
  };

  const herramientas = [
    betaZodTool({
      name: 'buscar_conocimiento',
      description: 'Buscá en lo que el equipo sabe del destino: cómo llegar, clima, entradas, políticas, recomendaciones, avisos. Escribí la consulta corta y en español.',
      inputSchema: z.object({ consulta: z.string().describe('Palabras clave en español, por ejemplo "llegar desde san jose bus"') }),
      run: async ({ consulta }) => {
        const encontrado = await buscarConocimiento(conv.destino_id, consulta, 5, 'concierge');
        return encontrado.length
          ? encontrado.map((k) => `## ${k.titulo}\n${k.contenido}`).join('\n\n')
          : 'No hay nada sobre eso en el conocimiento. Si es importante para el viajero, decile que el equipo lo confirma o escalá.';
      },
    }),
    betaZodTool({
      name: 'buscar_lugares',
      description: 'Buscá hoteles, restaurantes, termales, parques, transporte y otros negocios publicados del destino. Devuelve nombre, categoría, rango de precio, calificación y enlace.',
      inputSchema: z.object({
        texto: z.string().nullable().describe('Palabra o nombre a buscar; null para listar la sección'),
        seccion: z.enum(SECCIONES).nullable().describe('Filtrar por sección; null para todas'),
      }),
      run: async ({ texto, seccion }) => {
        let consulta = db
          .from('dst_negocio')
          .select('id, nombre, resumen, rango_precio, precio_desde_usd, promedio_calificacion, total_resenas, telefono_whatsapp, sitio_web, direccion, babosa, es_destacado, estado_verificacion, categoria:dst_categoria!inner(babosa, nombre, seccion)')
          .eq('destino_id', conv.destino_id)
          .eq('estado_publicacion', 'publicado')
          .order('es_destacado', { ascending: false })
          .order('promedio_calificacion', { ascending: false, nullsFirst: false })
          .limit(8);
        if (seccion) consulta = consulta.eq('categoria.seccion', seccion);
        const limpio = texto?.replace(/[,()%*]/g, ' ').trim();
        if (limpio) consulta = consulta.or(`nombre.ilike.%${limpio}%,resumen.ilike.%${limpio}%,descripcion.ilike.%${limpio}%`);
        const { data, error: fallo } = await consulta;
        if (fallo) return `No se pudo buscar: ${fallo.message}`;
        if (!data?.length) return 'No hay negocios publicados que coincidan. Probá con otra palabra o sin filtro de sección.';
        return data.map((n) => {
          const c = (Array.isArray(n.categoria) ? n.categoria[0] : n.categoria) as { babosa: string; nombre: string; seccion: string };
          return [
            `- id=${n.id} "${n.nombre}" (${c.nombre})`,
            n.rango_precio ? `precio ${n.rango_precio}` : null,
            n.precio_desde_usd != null ? `desde ${n.precio_desde_usd} USD` : null,
            n.promedio_calificacion != null ? `nota ${n.promedio_calificacion} (${n.total_resenas})` : null,
            n.estado_verificacion === 'verificado' ? 'verificado' : null,
            n.es_destacado ? 'destacado' : null,
            n.resumen ? `· ${n.resumen}` : null,
            `→ https://${destino.dominio}/${estado.idioma}/${c.babosa}/${n.babosa}`,
          ].filter(Boolean).join(' ');
        }).join('\n');
      },
    }),
    betaZodTool({
      name: 'buscar_tours',
      description: 'Buscá los tours reservables del destino con precio, duración, dificultad y operador.',
      inputSchema: z.object({ texto: z.string().nullable().describe('Palabra a buscar en el nombre; null para listar todos') }),
      run: async ({ texto }) => {
        let consulta = db
          .from('dst_tour')
          .select('id, nombre, resumen, duracion_horas, hora_inicio, dificultad, edad_minima, precio_adulto_usd, precio_nino_usd, recoge_en_hotel, idiomas_guia, operador:dst_negocio(nombre)')
          .eq('destino_id', conv.destino_id)
          .eq('estado', 'publicado')
          .order('es_destacado', { ascending: false })
          .limit(10);
        const limpio = texto?.replace(/[,()%*]/g, ' ').trim();
        if (limpio) consulta = consulta.ilike('nombre', `%${limpio}%`);
        const { data, error: fallo } = await consulta;
        if (fallo) return `No se pudo buscar: ${fallo.message}`;
        if (!data?.length) return 'Todavía no hay tours cargados en el catálogo. Ofrecé crear una solicitud para que el equipo cotice.';
        return data.map((t) => {
          const op = (Array.isArray(t.operador) ? t.operador[0] : t.operador) as { nombre: string } | null;
          return [
            `- id=${t.id} "${t.nombre}"`,
            op?.nombre ? `operador ${op.nombre}` : null,
            t.duracion_horas != null ? `${t.duracion_horas} h` : null,
            t.hora_inicio ? `sale ${t.hora_inicio}` : null,
            t.precio_adulto_usd != null ? `adulto ${t.precio_adulto_usd} USD` : null,
            t.precio_nino_usd != null ? `niño ${t.precio_nino_usd} USD` : null,
            t.dificultad ? `dificultad ${t.dificultad}` : null,
            t.edad_minima != null ? `edad mínima ${t.edad_minima}` : null,
            t.recoge_en_hotel ? 'recoge en hotel' : null,
            t.resumen ? `· ${t.resumen}` : null,
          ].filter(Boolean).join(' ');
        }).join('\n');
      },
    }),
    betaZodTool({
      name: 'guardar_datos_viajero',
      description: 'Guardá lo que el viajero cuenta de su viaje apenas lo diga. Mandá solo los campos que aparecieron; el resto en null.',
      inputSchema: z.object({
        nombre: z.string().nullable(),
        email: z.string().nullable(),
        whatsapp: z.string().nullable().describe('Con código de país, por ejemplo +50688881234'),
        llega_el: z.string().nullable().describe('YYYY-MM-DD'),
        sale_el: z.string().nullable().describe('YYYY-MM-DD'),
        personas: z.number().int().nullable(),
        ninos: z.number().int().nullable(),
        tipo_viajero: z.enum(TIPOS_VIAJERO).nullable(),
        presupuesto: z.enum(PRESUPUESTOS).nullable(),
        intereses: z.array(z.string()).nullable().describe('Palabras clave cortas, en español'),
        idioma: z.enum(IDIOMAS).nullable().describe('Solo si el viajero escribe en otro idioma del que tiene la conversación'),
      }),
      run: async (d) => {
        const cambios: Record<string, unknown> = {};
        if (d.nombre?.trim()) cambios.nombre = d.nombre.trim().slice(0, 120);
        const email = normalizarEmail(d.email);
        const whatsapp = normalizarWhatsapp(d.whatsapp);
        if (email) cambios.email = email;
        if (whatsapp) cambios.whatsapp = whatsapp;
        if (d.llega_el && /^\d{4}-\d{2}-\d{2}$/.test(d.llega_el)) cambios.llega_el = d.llega_el;
        if (d.sale_el && /^\d{4}-\d{2}-\d{2}$/.test(d.sale_el)) cambios.sale_el = d.sale_el;
        if (d.personas && d.personas > 0) cambios.personas = Math.min(d.personas, 200);
        if (d.ninos != null && d.ninos >= 0) cambios.ninos = Math.min(d.ninos, 100);
        if (d.tipo_viajero) cambios.tipo_viajero = d.tipo_viajero;
        if (d.presupuesto) cambios.presupuesto = d.presupuesto;
        if (d.intereses?.length) cambios.intereses = d.intereses.slice(0, 12).map((i) => i.toLowerCase().slice(0, 40));
        if (d.idioma) cambios.idioma = d.idioma;

        if (d.email && !email) return 'El correo no parece válido: pedile que lo repita.';
        if (d.whatsapp && !whatsapp) return 'El WhatsApp no parece válido: pedile el número con código de país.';
        if (!Object.keys(cambios).length) return 'No había nada nuevo que guardar.';

        if (estado.viajero_id) {
          const { error: fallo } = await db.from('dst_viajero').update(cambios).eq('id', estado.viajero_id);
          if (fallo) return `No se pudo guardar: ${fallo.message}`;
        } else {
          if (!email && !whatsapp) {
            return 'Anotado en la conversación, pero para guardar su ficha necesito un correo o un WhatsApp. Pedíselo cuando toque.';
          }
          const { data: nuevo, error: fallo } = await db
            .from('dst_viajero')
            .insert({ destino_id: conv.destino_id, origen: `concierge-${conv.canal}`, idioma: d.idioma ?? conv.idioma, acepta_marketing: false, ...cambios })
            .select('id')
            .single();
          if (fallo) return `No se pudo crear la ficha: ${fallo.message}`;
          estado.viajero_id = nuevo.id as string;
          await db.from('dst_conversacion').update({ viajero_id: nuevo.id }).eq('id', conv.id);
        }
        if (d.idioma) {
          estado.idioma = d.idioma;
          await db.from('dst_conversacion').update({ idioma: d.idioma }).eq('id', conv.id);
        }
        return `Guardado: ${Object.keys(cambios).join(', ')}.`;
      },
    }),
    betaZodTool({
      name: 'crear_solicitud',
      description: 'Cuando el viajero quiere reservar o que el equipo le arme algo (itinerario, tour, hospedaje, transporte), creá la solicitud. Necesita que ya tengamos su correo o WhatsApp.',
      inputSchema: z.object({
        tipo: z.enum(['itinerario', 'tour', 'hospedaje', 'transporte', 'consulta_general']),
        mensaje: z.string().describe('Resumen de lo que quiere, con fechas, personas y preferencias'),
        negocio_id: z.string().nullable().describe('id del negocio si la solicitud es sobre uno concreto'),
        tour_id: z.string().nullable().describe('id del tour si es sobre uno concreto'),
        valor_estimado_usd: z.number().nullable().describe('Estimado de lo que vale la reserva; null si no se sabe'),
      }),
      run: async (d) => {
        if (!estado.viajero_id) return 'Todavía no tenemos contacto del viajero. Pedile un WhatsApp o correo y guardalo con guardar_datos_viajero primero.';
        const { data: v } = await db.from('dst_viajero').select('email, whatsapp').eq('id', estado.viajero_id).single();
        if (!v?.email && !v?.whatsapp) return 'La ficha del viajero no tiene contacto. Pedile un WhatsApp o correo y guardalo primero.';

        const esUuid = (x: string | null) => !!x && /^[0-9a-f-]{36}$/i.test(x);
        const { data: nueva, error: fallo } = await db
          .from('dst_solicitud')
          .insert({
            destino_id: conv.destino_id,
            viajero_id: estado.viajero_id,
            tipo: d.tipo,
            mensaje: d.mensaje.slice(0, 2000),
            negocio_id: esUuid(d.negocio_id) ? d.negocio_id : null,
            tour_id: esUuid(d.tour_id) ? d.tour_id : null,
            valor_estimado_usd: d.valor_estimado_usd,
            etapa: 'nuevo',
            origen_canal: conv.canal,
          })
          .select('id')
          .single();
        if (fallo) return `No se pudo crear la solicitud: ${fallo.message}`;
        estado.solicitud_id = nueva.id as string;
        estado.solicitud_creada = { id: nueva.id as string, tipo: d.tipo };
        await db.from('dst_conversacion').update({ solicitud_id: nueva.id }).eq('id', conv.id);
        return `Solicitud creada. Decile al viajero que una persona del equipo la confirma, normalmente en menos de 24 horas${d.tipo === 'itinerario' ? ', y que el plan le llega por su canal de contacto' : ''}.`;
      },
    }),
    ...(agente.puede_escalar
      ? [
          betaZodTool({
            name: 'escalar_a_humano',
            description: 'Pasá la conversación a una persona del equipo: quejas, salud o seguridad, dinero o asuntos legales, si el viajero lo pide o si no encontrás la respuesta. Después decile al viajero que alguien del equipo le escribe.',
            inputSchema: z.object({ motivo: z.string().describe('Por qué se escala, en una frase, para el equipo') }),
            run: async ({ motivo }) => {
              estado.escalada = true;
              await db.from('dst_conversacion').update({
                estado: 'escalada', atendida_por: 'humano', requiere_revision: true,
                motivo_revision: motivo.slice(0, 500), responsable_id: agente.escala_a,
              }).eq('id', conv.id);
              await db.from('dst_tarea').insert({
                destino_id: conv.destino_id,
                titulo: `Conversación escalada: ${motivo.slice(0, 90)}`,
                detalle: `Canal ${conv.canal}. Conversación ${conv.id}. ${motivo}`,
                viajero_id: estado.viajero_id,
                solicitud_id: estado.solicitud_id,
                responsable_id: agente.escala_a,
                prioridad: 'alta',
                vence_el: new Date().toISOString().slice(0, 10),
              });
              return 'Listo: el equipo fue avisado y una persona sigue la conversación. Despedite con calma.';
            },
          }),
        ]
      : []),
    betaZodTool({
      name: 'no_molestar',
      description: 'Si el viajero pide que no le escriban más, marcalo para que ninguna automatización le mande mensajes.',
      inputSchema: z.object({ confirmado: z.boolean().describe('true si el viajero lo pidió claramente') }),
      run: async ({ confirmado }) => {
        if (!confirmado || !estado.viajero_id) return 'Sin cambios.';
        await db.from('dst_viajero').update({ no_molestar: true }).eq('id', estado.viajero_id);
        return 'Marcado: no recibirá más mensajes automáticos.';
      },
    }),
  ];

  const { resultado, ejecucion_id } = await ejecutar(
    {
      destino_id: conv.destino_id,
      agente,
      origen: opciones.origen,
      vinculos: { conversacion_id: conv.id, solicitud_id: conv.solicitud_id, viajero_id: conv.viajero_id },
    },
    async ({ client, medidor }) => {
      const runner = client.beta.messages.toolRunner({
        ...parametrosBase(agente),
        system: [
          { type: 'text', text: sistema, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: perfil },
        ],
        messages: turnos(ctx.mensajes),
        tools: herramientas,
        max_iterations: agente.max_iteraciones,
      });

      let final: Anthropic.Beta.BetaMessage | undefined;
      for await (const mensaje of runner) {
        final = mensaje;
        medidor.sumar(mensaje.usage, mensaje.stop_reason);
        for (const bloque of mensaje.content) {
          if (bloque.type === 'tool_use') medidor.herramienta(bloque.name);
        }
      }

      const texto = final ? textoDe(final.content) : '';
      return { texto, stop_reason: final?.stop_reason ?? null };
    },
    (r) => ({ largo: r.texto.length, stop_reason: r.stop_reason, escalada: estado.escalada })
  );

  let texto = resultado.texto;
  const rechazo = resultado.stop_reason === 'refusal';
  if (rechazo || !texto) {
    // Sin texto útil (rechazo, corte por iteraciones o por tokens): no se
    // deja al viajero colgado y una persona toma el hilo.
    texto = ESPERA[estado.idioma] ?? ESPERA.es;
    if (!estado.escalada) {
      estado.escalada = true;
      await db.from('dst_conversacion').update({
        estado: 'escalada', atendida_por: 'humano', requiere_revision: true,
        motivo_revision: rechazo ? 'El modelo rechazó responder.' : `Sin respuesta útil (${resultado.stop_reason ?? 'vacío'}).`,
        responsable_id: agente.escala_a,
      }).eq('id', conv.id);
    }
  }

  const envio = await enviarEnConversacion(conv.id, {
    texto,
    autor: 'ia',
    agente_id: agente.id,
    ejecucion_id,
    metadatos: { escalada: estado.escalada, stop_reason: resultado.stop_reason },
  });

  return {
    texto,
    mensaje_id: envio.mensaje_id,
    escalada: estado.escalada,
    ejecucion_id,
    solicitud_creada: estado.solicitud_creada,
    motivo: envio.error,
  };
}
