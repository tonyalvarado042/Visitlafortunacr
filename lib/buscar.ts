import type { Negocio } from './destino';

/*
 * La coincidencia del buscador, aparte y sin dependencias: ni base de datos ni
 * React, para poder probarla sola.
 *
 * No usa la columna `busqueda` de dst_negocio (tsvector con índice GIN) a
 * propósito. Esa columna se generó con la configuración `simple`, que exige la
 * palabra entera: "terma" no encontraría "termales". Con 29 negocios ya
 * traídos y traducidos por negocios_publicados, comparar texto normalizado da
 * mejor resultado y no cuesta nada. El día que sean miles, este archivo es el
 * único que hay que cambiar por una consulta al índice.
 */

/** Minúsculas y sin tildes: "Volcán" y "volcan" tienen que encontrarse igual.
 *  El rango ̀-ͯ son los signos diacríticos que NFD deja sueltos. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/* Dónde coincidió importa: quien busca "termales" espera primero el negocio
   que se llama así, no uno que las menciona de pasada en la descripción. */
const PESOS: { campo: keyof Negocio; peso: number }[] = [
  { campo: 'nombre', peso: 8 },
  { campo: 'categoria_nombre', peso: 4 },
  { campo: 'resumen', peso: 2 },
  { campo: 'descripcion', peso: 1 },
  { campo: 'direccion', peso: 1 },
];

function puntuar(negocio: Negocio, palabras: string[]): number {
  let total = 0;
  for (const palabra of palabras) {
    let mejor = 0;
    for (const { campo, peso } of PESOS) {
      const valor = negocio[campo];
      if (typeof valor === 'string' && normalizar(valor).includes(palabra)) {
        mejor = Math.max(mejor, peso);
      }
    }
    // Todas las palabras tienen que aparecer en algún campo. Con 29 negocios,
    // bastar con una sola devolvería casi el directorio entero.
    if (mejor === 0) return 0;
    total += mejor;
  }
  return total;
}

/* A igual relevancia manda lo mismo que en el resto del sitio: el destacado
   primero y después la calificación. */
function comparar(a: Negocio, b: Negocio): number {
  return (
    Number(b.es_destacado) - Number(a.es_destacado) ||
    (b.promedio_calificacion ?? 0) - (a.promedio_calificacion ?? 0)
  );
}

/**
 * Los negocios que coinciden, ordenados por relevancia. Una consulta vacía
 * devuelve todos: es lo que usa la vista de "ver todo".
 */
export function buscarNegocios(negocios: Negocio[], consulta: string): Negocio[] {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [...negocios].sort(comparar);

  return negocios
    .map((negocio) => ({ negocio, punto: puntuar(negocio, palabras) }))
    .filter((r) => r.punto > 0)
    .sort((a, b) => b.punto - a.punto || comparar(a.negocio, b.negocio))
    .map((r) => r.negocio);
}
