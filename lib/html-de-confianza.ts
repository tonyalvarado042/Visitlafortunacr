/*
 * El HTML que escribe el equipo, antes de pintarlo.
 *
 * Quién puede escribirlo es el control de verdad: solo /admin, y ahí entra
 * gente invitada. Esto es lo mismo que hace cualquier gestor de contenido con
 * el cuerpo de un artículo.
 *
 * Esta pasada es un cinturón de más, por si una cuenta del equipo se pierde o
 * alguien pega HTML de otro lado sin mirarlo. No es un saneador completo —no
 * existe uno hecho a base de expresiones regulares— y no hay que tratarlo como
 * si lo fuera. Quita las tres cosas que convierten una página en un problema:
 *
 *   <script>…</script>     código que corre en la página
 *   onclick="…"            lo mismo, escondido en un atributo
 *   href="javascript:…"    lo mismo, escondido en un enlace
 *
 * Si algún día hace falta aceptar HTML de alguien de afuera —un comerciante,
 * por ejemplo— esto NO alcanza: ahí hay que meter un saneador de verdad.
 */
export function htmlDeConfianza(crudo: string | null | undefined): string {
  if (!crudo) return '';

  return crudo
    // <script> y <style> con todo y contenido: lo de adentro no es texto.
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    // Y una etiqueta de apertura suelta, por si vino sin cerrar.
    .replace(/<\s*\/?\s*(script|style)\b[^>]*>/gi, '')
    // Manejadores de evento: onclick, onerror, onload… con o sin comillas.
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // javascript: y data: en href/src. data: deja meter una página entera.
    .replace(/\s(href|src|xlink:href)\s*=\s*(?:"\s*(?:javascript|data)\s*:[^"]*"|'\s*(?:javascript|data)\s*:[^']*'|\s*(?:javascript|data)\s*:[^\s>]*)/gi, '');
}
