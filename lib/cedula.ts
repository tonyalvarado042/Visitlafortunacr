/*
 * La cédula, con forma para leerla.
 *
 * Vive aparte de `lib/comercio.ts` porque eso es `server-only` y esto lo usa
 * también el formulario del portal, que corre en el navegador. Importar un
 * módulo `server-only` desde un componente de cliente revienta el build.
 *
 * Se guarda en dígitos y se le pone forma solo para mostrarla: la gente la
 * escribe de cinco maneras distintas y guardar el formato tal cual significa
 * que después no se puede ni buscar ni comparar.
 */
export function cedulaConForma(cedula: string | null, tipo: string | null): string {
  if (!cedula) return '';
  // Física: 1-0234-0567
  if (tipo === 'fisica' && cedula.length === 9) {
    return `${cedula.slice(0, 1)}-${cedula.slice(1, 5)}-${cedula.slice(5)}`;
  }
  // Jurídica y asociación: 3-101-118638
  if ((tipo === 'juridica' || tipo === 'asociacion') && cedula.length === 10) {
    return `${cedula.slice(0, 1)}-${cedula.slice(1, 4)}-${cedula.slice(4)}`;
  }
  // El DIMEX no lleva separadores.
  return cedula;
}
