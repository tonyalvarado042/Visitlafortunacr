import 'server-only';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { servicio } from '@/lib/supabase-servidor';
import { agenteDe, ejecutar, parametrosBase, sistemaCacheado, type Origen } from './cliente';
import { bloqueCatalogo, bloqueConocimiento, contextoDestino } from './conocimiento';
import { NOMBRE_IDIOMA } from './modelos';

/*
 * El redactor: escribe borradores de guías SEO con el catálogo real del
 * destino (negocios con id, para enlazarlos) y el conocimiento cargado. Todo
 * nace como borrador en dst_guia: nada se publica sin que una persona lo lea.
 */

export const EsquemaGuia = z.object({
  titulo: z.string().describe('Título de la guía, claro y con la palabra clave'),
  entradilla: z.string().describe('2 frases que enganchan, para el listado'),
  cuerpo: z.string().describe('La guía completa en Markdown: títulos con ##, párrafos cortos, datos concretos. Entre 900 y 1500 palabras.'),
  meta_titulo: z.string().describe('Para el buscador, máximo 60 caracteres'),
  meta_desc: z.string().describe('Para el buscador, máximo 155 caracteres'),
  negocios_ids: z.array(z.string()).describe('ids EXACTOS del catálogo de los negocios mencionados, en orden de aparición'),
  dias: z.number().int().nullable().describe('Si la guía es un itinerario, cuántos días cubre; si no, null'),
});

export type GuiaGenerada = z.infer<typeof EsquemaGuia>;

export type PeticionGuia = {
  destino_id: string;
  tema: string;
  tipo: 'guia' | 'itinerario' | 'comparativa' | 'como_llegar' | 'lista';
  idioma: string;
  publico?: string | null;
  indicaciones?: string | null;
};

const PUBLICOS = ['pareja', 'familia', 'amigos', 'solo', 'grupo', 'negocios'];

const FORMATO: Record<PeticionGuia['tipo'], string> = {
  guia: 'Guía completa del tema: qué es, por qué vale la pena, cómo hacerlo, cuánto cuesta, cuándo ir, errores comunes.',
  itinerario: 'Itinerario día por día con mañana, tarde y noche, tiempos de traslado y una alternativa si llueve.',
  comparativa: 'Comparativa honesta de opciones del catálogo: para quién es cada una, precio, pros y contras, veredicto por perfil.',
  como_llegar: 'Todas las formas de llegar con tiempos, precios aproximados y consejos, de la más cómoda a la más económica.',
  lista: 'Lista numerada de 8 a 12 opciones con un párrafo cada una y para quién es.',
};

function babosaDe(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}

export async function redactarGuia(
  peticion: PeticionGuia,
  opciones: { origen: Origen; solicitado_por?: string | null }
): Promise<{ id: string; babosa: string; guia: GuiaGenerada; ejecucion_id: string | null }> {
  const idioma = peticion.idioma || 'es';
  const contexto = await contextoDestino(peticion.destino_id, idioma);
  const agente = await agenteDe(peticion.destino_id, 'redactor');
  const d = contexto.destino;

  const sistema = [
    `Sos el redactor de ${d.marca} y escribís guías para viajeros que planean ir a ${d.nombre}, ${d.pais}.`,
    '',
    'REGLAS',
    `- Escribí en ${NOMBRE_IDIOMA[idioma] ?? idioma}, en primera persona del plural ("recomendamos", "nos gusta"), con datos concretos y sin adjetivos vacíos.`,
    '- Usá el catálogo: mencioná negocios por su nombre exacto cuando corresponda y devolvé sus ids en negocios_ids. No inventes negocios ni lugares que no estén en el catálogo o en el conocimiento.',
    '- Precios: solo los del catálogo o del conocimiento, como rango aproximado. Si no hay dato, no pongas cifra.',
    '- Neutralidad: no digas que un negocio es nuestro ni favorezcas a uno por comisión. Si un negocio es "destacado", igual se elige por mérito.',
    '- Estructura: intro corta que responde la pregunta del título, secciones con ##, una sección "Consejos prácticos" al final y un cierre que invita a pedirnos un plan a medida (sin URL).',
    '- SEO sin relleno: la palabra clave en el título, el primer párrafo y un ## ; nada de repetirla a la fuerza.',
    agente.instrucciones ? `\nINSTRUCCIONES DEL EQUIPO\n${agente.instrucciones}` : '',
    '',
    '## LO QUE SABEMOS DEL DESTINO',
    bloqueConocimiento(contexto.conocimiento),
    '',
    bloqueCatalogo(contexto),
  ].join('\n');

  const pedido = [
    `Escribí una pieza de tipo "${peticion.tipo}": ${FORMATO[peticion.tipo]}`,
    `Tema: ${peticion.tema}`,
    peticion.publico ? `Público: ${peticion.publico}.` : null,
    peticion.indicaciones ? `Indicaciones: ${peticion.indicaciones}` : null,
  ].filter(Boolean).join('\n');

  const { resultado: guia, ejecucion_id } = await ejecutar(
    { destino_id: peticion.destino_id, agente, origen: opciones.origen, solicitado_por: opciones.solicitado_por },
    async ({ client, medidor }) => {
      const base = parametrosBase(agente);
      const respuesta = await client.messages.parse({
        ...base,
        output_config: { ...(base.output_config ?? {}), format: zodOutputFormat(EsquemaGuia) },
        system: sistemaCacheado(sistema),
        messages: [{ role: 'user', content: pedido }],
      });
      medidor.sumar(respuesta.usage, respuesta.stop_reason);
      if (respuesta.stop_reason === 'refusal' || !respuesta.parsed_output) throw new Error('El modelo no devolvió la guía.');
      return respuesta.parsed_output;
    },
    (r) => ({ titulo: r.titulo, palabras: r.cuerpo.split(/\s+/).length, negocios: r.negocios_ids.length })
  );

  const db = servicio();
  const validos = new Set(contexto.negocios.map((n) => n.id));
  const babosa = `${babosaDe(guia.titulo) || 'guia'}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: fila, error } = await db
    .from('dst_guia')
    .insert({
      destino_id: peticion.destino_id,
      autor_id: opciones.solicitado_por ?? null,
      babosa,
      titulo: guia.titulo.slice(0, 180),
      entradilla: guia.entradilla,
      cuerpo: guia.cuerpo,
      tipo: peticion.tipo,
      dias: guia.dias && guia.dias >= 1 && guia.dias <= 30 ? guia.dias : null,
      publico: peticion.publico && PUBLICOS.includes(peticion.publico) ? peticion.publico : null,
      meta_titulo: guia.meta_titulo.slice(0, 70),
      meta_desc: guia.meta_desc.slice(0, 170),
      estado: 'borrador',
    })
    .select('id')
    .single();
  if (error) throw new Error(`No se pudo guardar la guía: ${error.message}`);

  const enlaces = guia.negocios_ids.filter((id) => validos.has(id)).map((negocio_id, i) => ({ guia_id: fila.id, negocio_id, orden: i + 1 }));
  if (enlaces.length) await db.from('dst_guia_negocio').insert(enlaces);

  return { id: fila.id as string, babosa, guia, ejecucion_id };
}
