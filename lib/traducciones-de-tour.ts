/*
 * Qué campos de una tour se traducen. UNA sola fuente.
 *
 * ⚠️ POR QUÉ ESTE ARCHIVO EXISTE, Y POR QUÉ NO BASTA CON ÉL.
 *
 * Esta lista tiene que decir lo mismo en CUATRO lugares, y tres de ellos la
 * importan de acá:
 *
 *   1. `lib/destino.ts` → `tourPorBabosa`, que las LEE para la ficha pública.
 *   2. `lib/comercio.ts` → `traduccionesDeMiTour`, que las lee para el panel
 *      del operador.
 *   3. `FormularioTour.tsx`, que las PREGUNTA. Por esto el archivo no puede
 *      importar nada del servidor: lo carga un componente de cliente.
 *   4. ⚠️ `destinos.guardar_traducciones_de_mi_tour`, en la base, que tiene su
 *      propia lista blanca y NO puede importar este archivo.
 *
 * El cuarto es el que duele. Si acá sobrara un campo, el operador escribiría
 * algo que la base descarta en silencio — trabajo suyo a la basura. Si allá
 * sobrara, habría un campo escribible que la ficha nunca muestra. Misma
 * familia de problema que la migración 32, donde `mediodia` estaba en el
 * `z.enum` y no en el CHECK y costó un itinerario entero.
 *
 * `precio_nota` NO está en ninguna de las cuatro: ese campo lo pone el equipo
 * desde `/admin`, no el operador. Dejarlo traducir acá sería dejarlo escribir
 * por la ventana algo que por la puerta no puede.
 */

export const CAMPOS_TRADUCIBLES_DE_TOUR = [
  { campo: 'nombre',      etiqueta: 'El nombre',            filas: 1 },
  { campo: 'resumen',     etiqueta: 'La línea que resume',  filas: 2 },
  { campo: 'descripcion', etiqueta: 'La descripción',       filas: 6 },
  { campo: 'incluye',     etiqueta: 'Qué incluye',          filas: 4 },
  { campo: 'no_incluye',  etiqueta: 'Qué NO incluye',       filas: 3 },
  { campo: 'que_llevar',  etiqueta: 'Qué llevar',           filas: 2 },
] as const;

export type CampoTraducibleDeTour = (typeof CAMPOS_TRADUCIBLES_DE_TOUR)[number]['campo'];

export const NOMBRES_DE_CAMPOS_TRADUCIBLES: readonly string[] =
  CAMPOS_TRADUCIBLES_DE_TOUR.map((c) => c.campo);

/**
 * El nombre del campo del formulario que lleva la traducción de `campo` a
 * `idioma`. Un solo lugar que lo arma, porque lo tienen que escribir igual el
 * que pinta el formulario y el que lo lee al guardar.
 */
export function campoDeTraduccion(idioma: string, campo: string): string {
  return `trad_${idioma}_${campo}`;
}
