/*
 * Los intereses de una persona. UNA sola fuente.
 *
 * ⚠️ POR QUÉ ESTE ARCHIVO EXISTE.
 *
 * Esta lista vivía dentro de `componentes/Planificador.tsx`, que es el único
 * lugar del sitio que la preguntaba. El 7 de noviembre de 2026 el sorteo
 * también empezó a preguntarla, y dos listas sueltas con las mismas babosas
 * es exactamente cómo se pierde gente de un segmento: el día que una diga
 * `vida-silvestre` y la otra `fauna`, los que entraron por la puerta vieja
 * desaparecen del boletín y nadie se entera.
 *
 * Mismo patrón que `lib/itinerario-modo.ts`, y por la misma razón: la lección
 * de la migración 32, donde un valor que estaba en el código y no en la base
 * costó un itinerario completo.
 *
 * La babosa es lo que se guarda y con lo que se segmenta. El texto es una
 * clave de `lib/idiomas.ts`, nunca una palabra escrita acá: estas etiquetas se
 * le muestran al visitante en su idioma.
 *
 * Las babosas tienen que coincidir EXACTAMENTE con las filas del grupo
 * `interes` de `destinos.dst_etiqueta` — ver
 * `supabase/plataforma/33_etiquetas_de_personas.sql`.
 */

export const INTERESES = [
  { babosa: 'aguas-termales', texto: 'int_termales'   },
  { babosa: 'rafting',        texto: 'int_rafting'    },
  { babosa: 'naturaleza',     texto: 'int_naturaleza' },
  { babosa: 'bienestar',      texto: 'int_bienestar'  },
  { babosa: 'ciclismo',       texto: 'int_ciclismo'   },
  { babosa: 'comida',         texto: 'int_comida'     },
  { babosa: 'aventura',       texto: 'int_aventura'   },
  { babosa: 'vida-silvestre', texto: 'int_fauna'      },
] as const;

export type BabosaInteres = (typeof INTERESES)[number]['babosa'];

export const BABOSAS_INTERES: readonly string[] = INTERESES.map((i) => i.babosa);

/**
 * Deja solo los intereses que de verdad existen, sin repetidos.
 *
 * Se usa en el borde —la ruta que recibe el formulario— y NO reemplaza al
 * guardia de la base: `etiquetar_viajero` vuelve a filtrar contra
 * `dst_etiqueta`. Son dos capas a propósito. Esta da el filtro temprano; la de
 * la base es la que no se puede saltar llamando a la función desde otro lado.
 */
export function soloInteresesValidos(crudos: unknown): string[] {
  if (!Array.isArray(crudos)) return [];
  const limpios = crudos
    .filter((i): i is string => typeof i === 'string')
    .map((i) => i.trim().toLowerCase())
    .filter((i) => BABOSAS_INTERES.includes(i));
  return [...new Set(limpios)];
}
