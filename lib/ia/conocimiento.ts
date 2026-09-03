import 'server-only';
import { servicio } from '@/lib/supabase-servidor';

/*
 * Cómo se alimenta a la IA: nada de archivos ni de prompts gigantes. El
 * conocimiento vive en dst_conocimiento, el equipo lo edita desde el panel, y
 * de aquí salen dos cosas: lo que va SIEMPRE en el prompt (prioridad alta) y
 * lo que el agente busca cuando le hace falta (búsqueda de texto completo).
 */

export type Conocimiento = {
  id: string;
  tipo: string;
  titulo: string;
  contenido: string;
  prioridad: number;
  etiquetas?: string[];
  relevancia?: number;
};

export type Uso = 'concierge' | 'planificador';

export async function conocimientoBase(destinoId: string, uso: Uso = 'concierge', minimo = 7): Promise<Conocimiento[]> {
  const { data, error } = await servicio().rpc('conocimiento_base', {
    p_destino_id: destinoId, p_uso: uso, p_minimo: minimo,
  });
  if (error) throw new Error(`conocimiento_base: ${error.message}`);
  return (data ?? []) as Conocimiento[];
}

export async function buscarConocimiento(destinoId: string, consulta: string, limite = 6, uso: Uso = 'concierge'): Promise<Conocimiento[]> {
  const limpia = consulta.trim().slice(0, 300);
  if (!limpia) return [];
  const { data, error } = await servicio().rpc('buscar_conocimiento', {
    p_destino_id: destinoId, p_consulta: limpia, p_limite: limite, p_uso: uso,
  });
  if (error) throw new Error(`buscar_conocimiento: ${error.message}`);
  return (data ?? []) as Conocimiento[];
}

export type NegocioContexto = {
  id: string; nombre: string; categoria: string; seccion: string; resumen: string | null;
  rango_precio: string | null; precio_desde_usd: number | null; calificacion: number | null;
  resenas: number; verificado: boolean; destacado: boolean; direccion: string | null;
  latitud: number | null; longitud: number | null; whatsapp: string | null; telefono: string | null;
  sitio_web: string | null; url: string;
};

export type TourContexto = {
  id: string; nombre: string; resumen: string | null; duracion_horas: number | null; hora_inicio: string | null;
  dificultad: string | null; edad_minima: number | null; precio_adulto_usd: number | null; precio_nino_usd: number | null;
  recoge_en_hotel: boolean | null; idiomas_guia: string[] | null; incluye: string | null; operador: string | null;
  negocio_id: string | null; destacado: boolean;
};

export type ContextoDestino = {
  destino: {
    id: string; nombre: string; nombre_largo: string | null; pais: string; region: string | null;
    zona_horaria: string; moneda: string; moneda_visitante: string | null; idioma_principal: string;
    idiomas: string[]; whatsapp: string | null; email: string | null; lema: string | null;
    dominio: string; marca: string; latitud: number | null; longitud: number | null;
  };
  categorias: { id: string; babosa: string; seccion: string; nombre: string }[];
  negocios: NegocioContexto[];
  tours: TourContexto[];
  conocimiento: { tipo: string; titulo: string; contenido: string }[];
};

export async function contextoDestino(destinoId: string, idioma = 'es'): Promise<ContextoDestino> {
  const { data, error } = await servicio().rpc('contexto_destino', {
    p_destino_id: destinoId, p_idioma: idioma,
  });
  if (error) throw new Error(`contexto_destino: ${error.message}`);
  if (!data?.destino) throw new Error(`El destino ${destinoId} no existe.`);
  return data as ContextoDestino;
}

/** El conocimiento como texto para el prompt, con el tipo entre paréntesis. */
export function bloqueConocimiento(items: Pick<Conocimiento, 'tipo' | 'titulo' | 'contenido'>[]): string {
  if (!items.length) return '(todavía no hay conocimiento cargado para este destino)';
  return items.map((k) => `### ${k.titulo} [${k.tipo}]\n${k.contenido}`).join('\n\n');
}

/** El catálogo como texto compacto: una línea por negocio y por tour, con su id. */
export function bloqueCatalogo(contexto: ContextoDestino, maxNegocios = 200): string {
  const negocios = contexto.negocios.slice(0, maxNegocios).map((n) => {
    const partes = [
      `id=${n.id}`, `"${n.nombre}"`, `categoria=${n.categoria}`,
      n.rango_precio ? `precio=${n.rango_precio}` : null,
      n.precio_desde_usd != null ? `desde=${n.precio_desde_usd}USD` : null,
      n.calificacion != null ? `nota=${n.calificacion}(${n.resenas})` : null,
      n.verificado ? 'verificado' : null,
      n.destacado ? 'destacado' : null,
      n.resumen ? `· ${n.resumen}` : null,
    ].filter(Boolean);
    return `- ${partes.join(' ')}`;
  });

  const tours = contexto.tours.map((t) => {
    const partes = [
      `id=${t.id}`, `"${t.nombre}"`,
      t.operador ? `operador=${t.operador}` : null,
      t.duracion_horas != null ? `${t.duracion_horas}h` : null,
      t.precio_adulto_usd != null ? `adulto=${t.precio_adulto_usd}USD` : null,
      t.precio_nino_usd != null ? `nino=${t.precio_nino_usd}USD` : null,
      t.dificultad ? `dificultad=${t.dificultad}` : null,
      t.edad_minima != null ? `edad_min=${t.edad_minima}` : null,
      t.recoge_en_hotel ? 'recoge_en_hotel' : null,
      t.resumen ? `· ${t.resumen}` : null,
    ].filter(Boolean);
    return `- ${partes.join(' ')}`;
  });

  return [
    `## NEGOCIOS PUBLICADOS (${negocios.length})`,
    negocios.length ? negocios.join('\n') : '(ninguno)',
    '',
    `## TOURS RESERVABLES (${tours.length})`,
    tours.length ? tours.join('\n') : '(todavía no hay tours cargados: proponé actividades como paradas libres)',
  ].join('\n');
}
