import 'server-only';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { servicio } from '@/lib/supabase-servidor';
import { agenteDe, ahoraEn, ejecutar, parametrosBase, sistemaCacheado, type Origen } from './cliente';
import { bloqueCatalogo, bloqueConocimiento, contextoDestino, type ContextoDestino } from './conocimiento';
import { NOMBRE_IDIOMA } from './modelos';
import { enviarAViajero, type ViajeroContacto } from './mensajeria';

/*
 * Cómo se generan los planes. El modelo recibe el catálogo real del destino
 * (negocios publicados y tours con sus ids) y devuelve un itinerario con
 * estructura fija (salida estructurada, no texto libre). Cada parada apunta a
 * un id del catálogo, que se valida antes de guardar: nada inventado llega a
 * la base. El resultado es una fila en dst_itinerario con sus paradas, con
 * URL pública para mandarle al viajero.
 */

const Parada = z.object({
  momento: z.enum(['manana', 'mediodia', 'tarde', 'noche']),
  titulo: z.string().describe('Nombre corto de la parada, en el idioma del viajero'),
  tipo: z.enum(['negocio', 'tour', 'libre']),
  negocio_id: z.string().nullable().describe('id EXACTO del catálogo cuando tipo=negocio; si no, null'),
  tour_id: z.string().nullable().describe('id EXACTO del catálogo cuando tipo=tour; si no, null'),
  nota: z.string().describe('Qué hacer ahí y cómo: horario aproximado, qué llevar. 1 a 3 frases.'),
  porque: z.string().describe('Por qué encaja con este viajero. 1 frase.'),
  duracion_horas: z.number().describe('Duración aproximada en horas'),
  costo_estimado_usd: z.number().nullable().describe('Estimado por persona en USD; null si no se sabe'),
});

const Dia = z.object({
  dia: z.number().int().describe('1 para el primer día'),
  titulo: z.string().describe('Título corto del día'),
  paradas: z.array(Parada).describe('Entre 2 y 5 paradas; el día de llegada y el de salida, menos'),
});

export const EsquemaItinerario = z.object({
  titulo: z.string().describe('Título del viaje, en el idioma del viajero'),
  resumen: z.string().describe('2 a 3 frases que resumen el plan y por qué es para este viajero'),
  dias: z.array(Dia),
  consejos: z.array(z.string()).describe('Hasta 6 consejos prácticos: clima, dinero, transporte, reservas'),
  total_estimado_usd: z.number().nullable().describe('Estimado por persona para todo el viaje, sin hotel; null si no se puede'),
});

export type ItinerarioGenerado = z.infer<typeof EsquemaItinerario>;

export type PeticionPlan = {
  destino_id: string;
  idioma: string;
  dias: number;
  llega_el?: string | null;
  sale_el?: string | null;
  personas?: number | null;
  ninos?: number | null;
  tipo_viajero?: string | null;
  presupuesto?: string | null;
  intereses?: string[] | null;
  mensaje?: string | null;
  nombre?: string | null;
  viajero_id?: string | null;
  solicitud_id?: string | null;
};

export type PlanGuardado = {
  id: string;
  babosa: string;
  url: string;
  itinerario: ItinerarioGenerado;
  ejecucion_id: string | null;
  costo_usd: number;
};

const TIPOS_VIAJERO = ['pareja', 'familia', 'amigos', 'solo', 'grupo', 'negocios'];
const PRESUPUESTOS = ['economico', 'medio', 'alto', 'lujo'];

function promptPlanificador(contexto: ContextoDestino, instrucciones: string | null, idioma: string): string {
  const d = contexto.destino;
  return [
    `Sos el planificador de viajes de ${d.marca} para ${d.nombre}, ${d.pais}. Armás itinerarios reales con los negocios y tours del catálogo de abajo.`,
    '',
    'REGLAS',
    `- Escribí TODO (títulos, notas, consejos) en ${NOMBRE_IDIOMA[idioma] ?? idioma}.`,
    '- Usá negocio_id y tour_id EXACTOS del catálogo. Si una actividad no está en el catálogo (una caminata, un mirador, tiempo libre), va como tipo "libre" con los dos ids en null. Nunca inventes un id.',
    '- El día de llegada y el de salida van livianos. Máximo una actividad de esfuerzo alto por día. Termales la primera tarde si el viajero las pidió o si llega de viaje largo.',
    '- Respetá con quién viaja y el presupuesto: familia con niños → nada con edad mínima mayor a la de los niños; pareja → algo íntimo; económico → sin lujo; lujo → lo mejor del catálogo.',
    '- Precios: usá los del catálogo o del conocimiento como estimado por persona. Si no hay dato, null. Nunca inventes una cifra exacta.',
    '- Neutralidad: nunca digas que un negocio es "nuestro". Preferí verificados y bien calificados, pero elegí por encaje con el viajero, no por comisión.',
    '- Sé concreto: horarios aproximados, tiempos de traslado, qué llevar. Una parada de comida por día como mínimo, en un negocio del catálogo si lo hay.',
    '- Si el viajero pidió intereses que el catálogo no cubre, decilo en los consejos y proponé la alternativa más cercana.',
    instrucciones ? `\nINSTRUCCIONES DEL EQUIPO\n${instrucciones}` : '',
    '',
    '## LO QUE SABEMOS DEL DESTINO',
    bloqueConocimiento(contexto.conocimiento),
    '',
    bloqueCatalogo(contexto),
  ].join('\n');
}

function describirPeticion(p: PeticionPlan, contexto: ContextoDestino): string {
  const lineas = [
    `Armá un itinerario de ${p.dias} día(s) en ${contexto.destino.nombre}.`,
    p.nombre ? `Viajero: ${p.nombre}.` : null,
    p.llega_el ? `Llega el ${p.llega_el}${p.sale_el ? ` y se va el ${p.sale_el}` : ''}.` : null,
    p.personas ? `Personas: ${p.personas}${p.ninos ? ` (${p.ninos} niños)` : ''}.` : null,
    p.tipo_viajero ? `Viaja: ${p.tipo_viajero}.` : null,
    p.presupuesto ? `Presupuesto: ${p.presupuesto}.` : null,
    p.intereses?.length ? `Intereses: ${p.intereses.join(', ')}.` : null,
    p.mensaje ? `Lo que escribió el viajero: "${p.mensaje.slice(0, 1500)}"` : null,
    `Fecha y hora en el destino ahora: ${ahoraEn(contexto.destino.zona_horaria, p.idioma)}.`,
  ].filter(Boolean);
  return lineas.join('\n');
}

function babosaDe(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function codigo(largo = 6): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789';
  let salida = '';
  for (let i = 0; i < largo; i++) salida += letras[Math.floor(Math.random() * letras.length)];
  return salida;
}

/** Genera y guarda un itinerario. Devuelve la fila creada y la URL pública. */
export async function generarItinerario(
  peticion: PeticionPlan,
  opciones: { origen: Origen; solicitado_por?: string | null }
): Promise<PlanGuardado> {
  const idioma = peticion.idioma || 'es';
  const dias = Math.min(Math.max(Math.round(peticion.dias || 3), 1), 14);
  const contexto = await contextoDestino(peticion.destino_id, idioma);
  const agente = await agenteDe(peticion.destino_id, 'planificador');
  const sistema = promptPlanificador(contexto, agente.instrucciones, idioma);
  const pedido = describirPeticion({ ...peticion, dias }, contexto);

  const { resultado: itinerario, ejecucion_id, costo_usd } = await ejecutar(
    {
      destino_id: peticion.destino_id,
      agente,
      origen: opciones.origen,
      solicitado_por: opciones.solicitado_por,
      vinculos: { solicitud_id: peticion.solicitud_id, viajero_id: peticion.viajero_id },
    },
    async ({ client, medidor }) => {
      const base = parametrosBase(agente);
      const respuesta = await client.messages.parse({
        ...base,
        output_config: { ...(base.output_config ?? {}), format: zodOutputFormat(EsquemaItinerario) },
        system: sistemaCacheado(sistema),
        messages: [{ role: 'user', content: pedido }],
      });
      medidor.sumar(respuesta.usage, respuesta.stop_reason);
      if (respuesta.stop_reason === 'refusal') {
        throw new Error('El modelo no quiso generar este itinerario (refusal).');
      }
      if (!respuesta.parsed_output) {
        throw new Error('El modelo no devolvió un itinerario con la estructura esperada.');
      }
      return respuesta.parsed_output;
    },
    (r) => ({ titulo: r.titulo, dias: r.dias.length, total_estimado_usd: r.total_estimado_usd })
  );

  // Solo entran ids que existen en el catálogo: lo demás pasa a "libre".
  const negocios = new Set(contexto.negocios.map((n) => n.id));
  const tours = new Set(contexto.tours.map((t) => t.id));
  const db = servicio();

  const babosa = `${babosaDe(itinerario.titulo) || 'plan'}-${codigo()}`;
  const { data: fila, error } = await db
    .from('dst_itinerario')
    .insert({
      destino_id: peticion.destino_id,
      viajero_id: peticion.viajero_id ?? null,
      solicitud_id: peticion.solicitud_id ?? null,
      titulo: itinerario.titulo.slice(0, 160),
      babosa,
      dias: Math.min(Math.max(itinerario.dias.length, 1), 30),
      empieza_el: peticion.llega_el ?? null,
      personas: peticion.personas ?? null,
      tipo_viajero: peticion.tipo_viajero && TIPOS_VIAJERO.includes(peticion.tipo_viajero) ? peticion.tipo_viajero : null,
      presupuesto: peticion.presupuesto && PRESUPUESTOS.includes(peticion.presupuesto) ? peticion.presupuesto : null,
      intereses: peticion.intereses ?? [],
      generado_por: 'planificador',
      es_publico: true,
      total_usd: itinerario.total_estimado_usd,
      idioma,
      resumen: itinerario.resumen,
      consejos: itinerario.consejos.join('\n'),
      ejecucion_id,
    })
    .select('id')
    .single();
  if (error) throw new Error(`No se pudo guardar el itinerario: ${error.message}`);

  const paradas = itinerario.dias.flatMap((dia, i) =>
    dia.paradas.map((p, j) => {
      const negocioValido = p.negocio_id && negocios.has(p.negocio_id) ? p.negocio_id : null;
      const tourValido = p.tour_id && tours.has(p.tour_id) ? p.tour_id : null;
      return {
        itinerario_id: fila.id,
        dia: dia.dia || i + 1,
        orden: j + 1,
        momento: p.momento,
        negocio_id: negocioValido,
        tour_id: tourValido,
        titulo_libre: p.titulo.slice(0, 160),
        nota: p.nota,
        porque: p.porque,
        duracion_horas: p.duracion_horas,
        costo_estimado_usd: p.costo_estimado_usd,
      };
    })
  );
  if (paradas.length) {
    const { error: fallo } = await db.from('dst_itinerario_parada').insert(paradas);
    if (fallo) throw new Error(`No se pudieron guardar las paradas: ${fallo.message}`);
  }

  if (peticion.solicitud_id) {
    await db.from('dst_solicitud').update({ itinerario_id: fila.id }).eq('id', peticion.solicitud_id);
  }

  const url = `https://${contexto.destino.dominio}/${idioma}/plan/${babosa}`;
  return { id: fila.id as string, babosa, url, itinerario, ejecucion_id, costo_usd };
}

function diasEntre(llega: string | null, sale: string | null): number {
  if (!llega || !sale) return 3;
  const a = new Date(llega).getTime();
  const b = new Date(sale).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 3;
  return Math.min(Math.max(Math.round((b - a) / 86_400_000) + 1, 1), 14);
}

/**
 * El camino normal: llega una solicitud de itinerario desde el planificador
 * del sitio, se genera el plan y se le avisa al viajero por su canal.
 */
export async function generarItinerarioParaSolicitud(solicitudId: string, origen: Origen = 'web'): Promise<PlanGuardado> {
  const db = servicio();
  const { data: s, error } = await db
    .from('dst_solicitud')
    .select('id, destino_id, tipo, mensaje, itinerario_id, viajero:dst_viajero(id, nombre, email, whatsapp, idioma, llega_el, sale_el, personas, ninos, tipo_viajero, presupuesto, intereses, no_molestar)')
    .eq('id', solicitudId)
    .single();
  if (error || !s) throw new Error(`No existe la solicitud ${solicitudId}.`);

  const v = (Array.isArray(s.viajero) ? s.viajero[0] : s.viajero) as {
    id: string; nombre: string | null; email: string | null; whatsapp: string | null; idioma: string | null;
    llega_el: string | null; sale_el: string | null; personas: number | null; ninos: number | null;
    tipo_viajero: string | null; presupuesto: string | null; intereses: string[] | null; no_molestar: boolean;
  } | null;

  const plan = await generarItinerario(
    {
      destino_id: s.destino_id,
      idioma: v?.idioma ?? 'es',
      dias: diasEntre(v?.llega_el ?? null, v?.sale_el ?? null),
      llega_el: v?.llega_el,
      sale_el: v?.sale_el,
      personas: v?.personas,
      ninos: v?.ninos,
      tipo_viajero: v?.tipo_viajero,
      presupuesto: v?.presupuesto,
      intereses: v?.intereses ?? [],
      mensaje: s.mensaje,
      nombre: v?.nombre,
      viajero_id: v?.id,
      solicitud_id: s.id,
    },
    { origen }
  );

  if (v) await avisarPlanListo(s.destino_id, v, plan);
  return plan;
}

/** Le manda al viajero el enlace del plan con la plantilla itinerario_listo. */
async function avisarPlanListo(destinoId: string, viajero: ViajeroContacto & { nombre: string | null }, plan: PlanGuardado) {
  const db = servicio();
  const canal = viajero.whatsapp ? 'whatsapp' : 'email';
  const { data: plantilla } = await db.rpc('plantilla_para', {
    p_destino_id: destinoId, p_clave: 'itinerario_listo', p_canal: canal, p_idioma: viajero.idioma ?? 'es',
  });
  const fila = (Array.isArray(plantilla) ? plantilla[0] : plantilla) as { asunto: string | null; cuerpo: string } | undefined;
  const { data: destino } = await db.from('dst_destino').select('nombre, marca_nombre').eq('id', destinoId).single();

  const variables: Record<string, string> = {
    nombre: viajero.nombre ?? '',
    destino: destino?.nombre ?? '',
    marca: destino?.marca_nombre ?? '',
    enlace_itinerario: plan.url,
  };
  const rellenar = (t: string) => t.replace(/\{\{([a-z_]+)\}\}/g, (_, k: string) => variables[k] ?? '');

  const texto = fila ? rellenar(fila.cuerpo) : `${variables.nombre ? variables.nombre + ', ' : ''}tu plan para ${variables.destino}: ${plan.url}`;
  const asunto = fila?.asunto ? rellenar(fila.asunto) : `Tu plan para ${variables.destino}`;

  try {
    await enviarAViajero(destinoId, viajero, {
      texto, asunto, autor: 'sistema', automatico: true, plantilla: 'itinerario_listo',
      ejecucion_id: plan.ejecucion_id, metadatos: { itinerario_id: plan.id },
    }, canal);
  } catch (fallo) {
    console.error('No se pudo avisar del plan:', fallo);
  }
}
