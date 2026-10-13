/*
 * Texto con formato, escrito por cualquiera — también por un comerciante.
 *
 * LA DECISIÓN DE FONDO: acá NO entra HTML. Ni se acepta, ni se limpia, ni se
 * parsea. Lo que se guarda son marcas (`**negrita**`, `- lista`, `[x](url)`) y
 * este archivo GENERA cada etiqueta. Es la diferencia entre "quitarle lo malo a
 * algo ajeno" y "escribirlo uno mismo": lo primero se puede hacer mal de mil
 * maneras y lo segundo no.
 *
 * Por qué importa: `lib/html-de-confianza.ts` limpia con expresiones regulares
 * y lo dice en su propio comentario — sirve para el equipo en /admin, no para
 * alguien de afuera. Una cuenta de comerciante perdida escribiendo HTML crudo
 * en una página pública es robo de sesiones. Con este camino esa puerta no
 * existe: por más que alguien escriba `<script>`, sale escrito en pantalla.
 *
 * Lo que sabe hacer, y nada más:
 *   párrafos · negrita · cursiva · listas · enlaces
 *
 * El orden importa y no es casual: PRIMERO se escapa todo, DESPUÉS se aplican
 * las marcas. Al revés, un `<b>` del usuario sobreviviría al escape.
 */

/** Nada que escriba una persona llega al HTML sin pasar por acá. */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Una dirección que se puede poner en un href.
 *
 * Solo http, https y mailto. `javascript:` y `data:` quedan fuera, y también
 * cualquier cosa rara: si no pasa, el enlace se pinta como texto y no como
 * enlace — nunca como un href a medias.
 */
function urlSegura(url: string): string | null {
  const limpia = url.trim();
  if (!/^(https?:\/\/|mailto:)/i.test(limpia)) return null;
  // Ni espacios ni saltos: un href partido es un href que se puede completar.
  if (/[\s<>"']/.test(limpia)) return null;
  return limpia;
}

/* Las marcas de dentro de una línea. Se aplican sobre texto YA escapado. */
function enLinea(escapado: string): string {
  return escapado
    /* Enlaces primero: si fueran después, un `**` dentro del rótulo ya
       habría metido etiquetas y el rótulo dejaría de ser texto plano. */
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (todo, rotulo: string, url: string) => {
      const casa = urlSegura(url.replace(/&amp;/g, '&'));
      if (!casa) return rotulo;
      return `<a href="${escapar(casa)}" target="_blank" rel="noopener noreferrer nofollow">${rotulo}</a>`;
    })
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\n]+)_(?=[^_\w]|$)/g, '$1<em>$2</em>');
}

const VINETA = /^\s*[-*]\s+(.*)$/;
const NUMERO = /^\s*\d+[.)]\s+(.*)$/;

/**
 * El texto con marcas, convertido en HTML.
 *
 * Devuelve cadena vacía si no hay nada, para que quien lo pinte pueda decidir
 * no poner el bloque en lugar de poner un bloque vacío.
 */
export function textoRicoAHtml(crudo: string | null | undefined): string {
  if (!crudo || !crudo.trim()) return '';

  const lineas = escapar(crudo).replace(/\r\n?/g, '\n').split('\n');
  const partes: string[] = [];
  let lista: { tipo: 'ul' | 'ol'; filas: string[] } | null = null;
  let parrafo: string[] = [];

  const cerrarLista = () => {
    if (!lista) return;
    partes.push(`<${lista.tipo}>${lista.filas.map((f) => `<li>${f}</li>`).join('')}</${lista.tipo}>`);
    lista = null;
  };
  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    partes.push(`<p>${parrafo.join('<br>')}</p>`);
    parrafo = [];
  };

  for (const linea of lineas) {
    const vineta = linea.match(VINETA);
    const numero = linea.match(NUMERO);

    if (vineta || numero) {
      cerrarParrafo();
      const tipo = vineta ? 'ul' : 'ol';
      /* Una lista que cambia de tipo a media altura son DOS listas. Meter un
         <li> numerado dentro de un <ul> lo pinta con viñeta y la numeración
         que escribió la persona desaparece sin aviso. */
      if (lista && lista.tipo !== tipo) cerrarLista();
      if (!lista) lista = { tipo, filas: [] };
      lista.filas.push(enLinea((vineta ?? numero)![1]));
      continue;
    }

    cerrarLista();
    if (!linea.trim()) { cerrarParrafo(); continue; }
    parrafo.push(enLinea(linea.trim()));
  }

  cerrarLista();
  cerrarParrafo();
  return partes.join('');
}

/**
 * Una línea suelta, sin párrafos — para resúmenes y rótulos.
 *
 * Misma seguridad, sin bloques: sirve donde un `<p>` rompería la maqueta.
 */
export function textoRicoEnLinea(crudo: string | null | undefined): string {
  if (!crudo || !crudo.trim()) return '';
  return enLinea(escapar(crudo.replace(/\s+/g, ' ').trim()));
}
