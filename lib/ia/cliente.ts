import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { servicio } from '@/lib/supabase-servidor';
import { costoUsd, MODELO_POR_DEFECTO, type Esfuerzo } from './modelos';

/*
 * El punto de entrada a Claude para toda la plataforma. Dos cosas pasan aquí
 * y en ningún otro lado: (1) se crea el cliente con la clave del entorno y
 * (2) cada ejecución queda registrada en dst_agente_ejecucion con tokens,
 * costo, duración y herramientas usadas. Ningún módulo llama a Claude sin
 * pasar por ejecutar().
 */

export type ClaveAgente = 'concierge' | 'planificador' | 'seguimiento' | 'analista' | 'redactor';

export type Agente = {
  id: string | null;
  destino_id: string;
  clave: ClaveAgente;
  nombre: string;
  modelo: string;
  esfuerzo: Esfuerzo;
  max_tokens: number;
  instrucciones: string | null;
  tono: string | null;
  max_iteraciones: number;
  puede_escalar: boolean;
  escala_a: string | null;
  reglas: Record<string, unknown>;
  esta_activo: boolean;
};

const POR_DEFECTO: Record<ClaveAgente, { nombre: string; esfuerzo: Esfuerzo; max_tokens: number }> = {
  concierge:    { nombre: 'Concierge',    esfuerzo: 'medium', max_tokens: 1500 },
  planificador: { nombre: 'Planificador', esfuerzo: 'high',   max_tokens: 16000 },
  seguimiento:  { nombre: 'Seguimiento',  esfuerzo: 'medium', max_tokens: 2000 },
  analista:     { nombre: 'Analista',     esfuerzo: 'low',    max_tokens: 1500 },
  redactor:     { nombre: 'Redactor',     esfuerzo: 'high',   max_tokens: 16000 },
};

/** La configuración del agente tal como está en el panel; si no existe, la de fábrica. */
export async function agenteDe(destinoId: string, clave: ClaveAgente): Promise<Agente> {
  const { data } = await servicio()
    .from('dst_agente')
    .select('*')
    .eq('destino_id', destinoId)
    .eq('clave', clave)
    .maybeSingle();

  if (data) return data as Agente;

  return {
    id: null,
    destino_id: destinoId,
    clave,
    modelo: MODELO_POR_DEFECTO,
    instrucciones: null,
    tono: null,
    max_iteraciones: 8,
    puede_escalar: true,
    escala_a: null,
    reglas: {},
    esta_activo: true,
    ...POR_DEFECTO[clave],
  };
}

export function hayClaveDeIA(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

let cliente: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!hayClaveDeIA()) {
    throw new Error('Falta ANTHROPIC_API_KEY en el entorno: la IA no puede ejecutarse.');
  }
  cliente ??= new Anthropic({ maxRetries: 2, timeout: 10 * 60 * 1000 });
  return cliente;
}

/**
 * Parámetros comunes a toda llamada: modelo, tokens, pensamiento adaptativo y
 * esfuerzo. Haiku 4.5 es anterior al pensamiento adaptativo y no acepta
 * effort, así que a ese se le manda lo mínimo.
 */
export function parametrosBase(agente: Agente) {
  const moderno = !agente.modelo.includes('haiku');
  return {
    model: agente.modelo,
    max_tokens: agente.max_tokens,
    ...(moderno ? { thinking: { type: 'adaptive' as const } } : {}),
    ...(moderno ? { output_config: { effort: agente.esfuerzo } } : {}),
  };
}

export type Origen = 'web' | 'whatsapp' | 'email' | 'panel' | 'cron' | 'api';

export type Vinculos = {
  conversacion_id?: string | null;
  solicitud_id?: string | null;
  viajero_id?: string | null;
  itinerario_id?: string | null;
};

type UsoApi = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
} | null | undefined;

/** Acumula tokens, iteraciones y herramientas de una ejecución. */
export class Medidor {
  entrada = 0;
  salida = 0;
  cacheLectura = 0;
  cacheEscritura = 0;
  iteraciones = 0;
  herramientas: string[] = [];
  motivoParada: string | null = null;

  sumar(uso: UsoApi, motivoParada?: string | null) {
    if (uso) {
      this.entrada += uso.input_tokens ?? 0;
      this.salida += uso.output_tokens ?? 0;
      this.cacheLectura += uso.cache_read_input_tokens ?? 0;
      this.cacheEscritura += uso.cache_creation_input_tokens ?? 0;
    }
    this.iteraciones += 1;
    if (motivoParada) this.motivoParada = motivoParada;
  }

  herramienta(nombre: string) {
    this.herramientas.push(nombre);
  }

  get uso() {
    return {
      entrada: this.entrada,
      salida: this.salida,
      cacheLectura: this.cacheLectura,
      cacheEscritura: this.cacheEscritura,
    };
  }
}

export type Ejecucion<T> = { resultado: T; ejecucion_id: string | null; costo_usd: number };

type Opciones = {
  destino_id: string;
  agente: Agente;
  origen: Origen;
  solicitado_por?: string | null;
  vinculos?: Vinculos;
};

/**
 * Corre una tarea de IA y la deja registrada, salga bien o mal. La tarea
 * recibe el cliente y un medidor al que le suma el `usage` de cada respuesta.
 */
export async function ejecutar<T>(
  opciones: Opciones,
  tarea: (contexto: { client: Anthropic; agente: Agente; medidor: Medidor }) => Promise<T>,
  resumen?: (resultado: T) => unknown
): Promise<Ejecucion<T>> {
  const inicio = Date.now();
  const medidor = new Medidor();

  let resultado: T;
  try {
    resultado = await tarea({ client: anthropic(), agente: opciones.agente, medidor });
  } catch (fallo) {
    const mensaje =
      fallo instanceof Anthropic.APIError
        ? `${fallo.status ?? ''} ${fallo.message}`.trim()
        : fallo instanceof Error
          ? fallo.message
          : String(fallo);
    await registrar(opciones, medidor, Date.now() - inicio, mensaje, null);
    throw fallo;
  }

  const ejecucion_id = await registrar(
    opciones, medidor, Date.now() - inicio, null, resumen ? resumen(resultado) : null
  );
  return { resultado, ejecucion_id, costo_usd: costoUsd(opciones.agente.modelo, medidor.uso) };
}

async function registrar(
  opciones: Opciones, medidor: Medidor, duracion_ms: number, error: string | null, resultado: unknown
): Promise<string | null> {
  try {
    const { data, error: fallo } = await servicio()
      .from('dst_agente_ejecucion')
      .insert({
        destino_id: opciones.destino_id,
        agente_id: opciones.agente.id,
        clave_agente: opciones.agente.clave,
        conversacion_id: opciones.vinculos?.conversacion_id ?? null,
        solicitud_id: opciones.vinculos?.solicitud_id ?? null,
        viajero_id: opciones.vinculos?.viajero_id ?? null,
        itinerario_id: opciones.vinculos?.itinerario_id ?? null,
        origen: opciones.origen,
        solicitado_por: opciones.solicitado_por ?? null,
        modelo: opciones.agente.modelo,
        esfuerzo: opciones.agente.esfuerzo,
        entrada_tokens: medidor.entrada,
        salida_tokens: medidor.salida,
        cache_lectura_tokens: medidor.cacheLectura,
        cache_escritura_tokens: medidor.cacheEscritura,
        costo_usd: costoUsd(opciones.agente.modelo, medidor.uso),
        duracion_ms,
        iteraciones: Math.max(1, medidor.iteraciones),
        herramientas_usadas: medidor.herramientas,
        motivo_parada: medidor.motivoParada,
        resultado: resultado ?? null,
        error,
      })
      .select('id')
      .single();

    if (fallo) {
      console.error('No se pudo registrar la ejecución de IA:', fallo.message);
      return null;
    }
    return data.id as string;
  } catch (fallo) {
    console.error('No se pudo registrar la ejecución de IA:', fallo);
    return null;
  }
}

/** Junta los bloques de texto de una respuesta. */
export function textoDe(contenido: ReadonlyArray<{ type: string; text?: string }>): string {
  return contenido
    .filter((bloque) => bloque.type === 'text')
    .map((bloque) => bloque.text ?? '')
    .join('\n')
    .trim();
}

/** Un bloque de sistema que se cachea entre llamadas: el prefijo estable va primero. */
export function sistemaCacheado(texto: string): Anthropic.Messages.TextBlockParam[] {
  return [{ type: 'text', text: texto, cache_control: { type: 'ephemeral' } }];
}

/** Fecha y hora legibles en la zona del destino, para que la IA sepa "cuándo" es. */
export function ahoraEn(zonaHoraria: string, idioma = 'es'): string {
  try {
    return new Intl.DateTimeFormat(idioma, {
      dateStyle: 'full', timeStyle: 'short', timeZone: zonaHoraria,
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}
