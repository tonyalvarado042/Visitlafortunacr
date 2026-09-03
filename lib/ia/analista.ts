import 'server-only';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { servicio } from '@/lib/supabase-servidor';
import { agenteDe, ejecutar, parametrosBase, sistemaCacheado, type Origen } from './cliente';

/*
 * El analista: lee una conversación entera y deja resumen, sentimiento,
 * intención, si hace falta que una persona la revise, y una nota de calidad
 * sobre cómo respondió el agente. Es lo que hace posible revisar cientos de
 * conversaciones sin leerlas una por una, y mejorar el concierge con datos.
 */

export const EsquemaAnalisis = z.object({
  resumen: z.string().describe('Qué quería el viajero y en qué quedó la conversación, en 2 frases, en español'),
  sentimiento: z.enum(['positivo', 'neutral', 'negativo']),
  intencion: z.enum(['reservar', 'cotizar', 'informacion', 'queja', 'soporte', 'otro']),
  requiere_revision: z.boolean().describe('true si una persona debería leerla: queja, promesa dudosa, respuesta incorrecta, viajero frustrado, oportunidad grande'),
  motivo_revision: z.string().nullable().describe('Por qué, en una frase; null si no requiere'),
  calidad_respuestas: z.number().int().describe('1 a 5: qué tan bien respondió el agente (exactitud, tono, brevedad, avance hacia la reserva)'),
  mejoras: z.array(z.string()).describe('Hasta 3 mejoras concretas para el agente o para el conocimiento (por ejemplo "falta el precio de X en el conocimiento")'),
  datos_viaje: z.object({
    llega_el: z.string().nullable().describe('YYYY-MM-DD si se mencionó'),
    sale_el: z.string().nullable(),
    personas: z.number().int().nullable(),
    intereses: z.array(z.string()).describe('Palabras clave cortas en español'),
  }),
});

export type Analisis = z.infer<typeof EsquemaAnalisis>;

type Contexto = {
  conversacion: { id: string; destino_id: string; viajero_id: string | null; solicitud_id: string | null; canal: string; idioma: string; estado: string; atendida_por: string; requiere_revision: boolean; metadatos: Record<string, unknown> };
  viajero: { id: string; nombre: string | null; llega_el: string | null; sale_el: string | null; personas: number | null; intereses: string[] | null } | null;
  solicitud: { id: string; tipo: string; etapa: string } | null;
  mensajes: { autor: string; direccion: string; cuerpo: string; enviado_en: string }[];
};

/** Analiza una conversación y guarda el resultado en la propia conversación. */
export async function analizarConversacion(
  conversacionId: string,
  opciones: { origen: Origen; solicitado_por?: string | null }
): Promise<Analisis> {
  const db = servicio();
  const { data: crudo, error } = await db.rpc('contexto_conversacion', { p_conversacion_id: conversacionId, p_max_mensajes: 60 });
  if (error) throw new Error(`contexto_conversacion: ${error.message}`);
  const ctx = crudo as Contexto;
  if (!ctx?.conversacion) throw new Error('La conversación no existe.');
  if (!ctx.mensajes.length) throw new Error('La conversación no tiene mensajes.');

  const agente = await agenteDe(ctx.conversacion.destino_id, 'analista');
  const hilo = ctx.mensajes
    .map((m) => `[${m.enviado_en}] ${m.direccion === 'entrante' ? 'VIAJERO' : m.autor.toUpperCase()}: ${m.cuerpo.slice(0, 1200)}`)
    .join('\n');

  const { resultado } = await ejecutar(
    {
      destino_id: ctx.conversacion.destino_id,
      agente,
      origen: opciones.origen,
      solicitado_por: opciones.solicitado_por,
      vinculos: { conversacion_id: ctx.conversacion.id, solicitud_id: ctx.conversacion.solicitud_id, viajero_id: ctx.conversacion.viajero_id },
    },
    async ({ client, medidor }) => {
      const base = parametrosBase(agente);
      const respuesta = await client.messages.parse({
        ...base,
        output_config: { ...(base.output_config ?? {}), format: zodOutputFormat(EsquemaAnalisis) },
        system: sistemaCacheado([
          'Sos el supervisor de calidad de un equipo de turismo. Leés conversaciones entre viajeros y nuestro agente (IA o personas) y las evaluás con ojo de dueño del negocio: ¿se atendió bien?, ¿se avanzó hacia la reserva?, ¿hay algo que una persona deba ver?',
          'Marcá requiere_revision=true ante: queja o frustración, promesa de precio o disponibilidad que no debió hacerse, respuesta incorrecta o inventada, pedido de hablar con una persona sin atender, oportunidad grande (grupo, varios días, lujo) sin seguimiento.',
          'Sé estricto con calidad_respuestas: 5 solo si fue exacta, breve, cálida y movió la conversación.',
          agente.instrucciones ? `INSTRUCCIONES DEL EQUIPO: ${agente.instrucciones}` : '',
        ].filter(Boolean).join('\n')),
        messages: [{
          role: 'user',
          content: `Conversación por ${ctx.conversacion.canal}, idioma ${ctx.conversacion.idioma}, atendida por ${ctx.conversacion.atendida_por}${ctx.solicitud ? `, con solicitud ${ctx.solicitud.tipo} en etapa ${ctx.solicitud.etapa}` : ''}.\n\n${hilo}`,
        }],
      });
      medidor.sumar(respuesta.usage, respuesta.stop_reason);
      if (respuesta.stop_reason === 'refusal' || !respuesta.parsed_output) throw new Error('El modelo no devolvió el análisis.');
      return respuesta.parsed_output;
    },
    (r) => ({ sentimiento: r.sentimiento, intencion: r.intencion, calidad: r.calidad_respuestas, requiere_revision: r.requiere_revision })
  );

  await db.from('dst_conversacion').update({
    resumen_ia: resultado.resumen,
    sentimiento: resultado.sentimiento,
    intencion: resultado.intencion,
    requiere_revision: ctx.conversacion.requiere_revision || resultado.requiere_revision,
    motivo_revision: resultado.requiere_revision ? resultado.motivo_revision : undefined,
    metadatos: {
      ...(ctx.conversacion.metadatos ?? {}),
      analisis: {
        calidad: resultado.calidad_respuestas,
        mejoras: resultado.mejoras,
        analizada_en: new Date().toISOString(),
        mensajes: ctx.mensajes.length,
      },
    },
  }).eq('id', ctx.conversacion.id);

  // Lo que el viajero contó y todavía no estaba en su ficha.
  if (ctx.viajero) {
    const d = resultado.datos_viaje;
    const cambios: Record<string, unknown> = {};
    const fecha = (x: string | null) => (x && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
    if (!ctx.viajero.llega_el && fecha(d.llega_el)) cambios.llega_el = d.llega_el;
    if (!ctx.viajero.sale_el && fecha(d.sale_el)) cambios.sale_el = d.sale_el;
    if (!ctx.viajero.personas && d.personas && d.personas > 0) cambios.personas = Math.min(d.personas, 200);
    if (!(ctx.viajero.intereses?.length) && d.intereses.length) cambios.intereses = d.intereses.slice(0, 12);
    if (Object.keys(cambios).length) await db.from('dst_viajero').update(cambios).eq('id', ctx.viajero.id);
  }

  return resultado;
}
