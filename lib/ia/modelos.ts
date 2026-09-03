/*
 * Qué modelos se usan y cuánto cuestan. El costo por ejecución se calcula con
 * esta tabla y se guarda en dst_agente_ejecucion, para que el panel muestre
 * cuánto gasta la IA por destino y por mes. Precios en USD por millón de
 * tokens; si Anthropic los cambia, se corrigen aquí y nada más.
 */
export const MODELO_POR_DEFECTO = 'claude-opus-5';

export type Esfuerzo = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

type Precio = { entrada: number; salida: number; cacheLectura: number; cacheEscritura: number };

const PRECIOS: Record<string, Precio> = {
  'claude-opus-5':    { entrada: 5,  salida: 25, cacheLectura: 0.5,  cacheEscritura: 6.25 },
  'claude-sonnet-5':  { entrada: 3,  salida: 15, cacheLectura: 0.3,  cacheEscritura: 3.75 },
  'claude-haiku-4-5': { entrada: 1,  salida: 5,  cacheLectura: 0.1,  cacheEscritura: 1.25 },
  'claude-fable-5-1': { entrada: 10, salida: 50, cacheLectura: 0.25, cacheEscritura: 12.5 },
};

export const MODELOS_DISPONIBLES = Object.keys(PRECIOS);

export type Uso = {
  entrada: number;
  salida: number;
  cacheLectura: number;
  cacheEscritura: number;
};

export function costoUsd(modelo: string, uso: Uso): number {
  const p = PRECIOS[modelo] ?? PRECIOS[MODELO_POR_DEFECTO];
  const costo =
    (uso.entrada * p.entrada +
      uso.salida * p.salida +
      uso.cacheLectura * p.cacheLectura +
      uso.cacheEscritura * p.cacheEscritura) /
    1_000_000;
  return Math.round(costo * 1_000_000) / 1_000_000;
}

/** Los idiomas en los que la IA habla, con su nombre para el prompt. */
export const NOMBRE_IDIOMA: Record<string, string> = {
  es: 'español',
  en: 'English',
  pt: 'português',
  fr: 'français',
  de: 'Deutsch',
};
