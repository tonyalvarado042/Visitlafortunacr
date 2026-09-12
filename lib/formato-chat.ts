/*
 * Convierte lo que escribe el concierge en algo que se pueda pintar en una
 * burbuja de chat.
 *
 * Por qué existe: el modelo escribe markdown por costumbre —negritas, viñetas,
 * enlaces— y la burbuja pintaba `{texto}` crudo, así que salían los asteriscos,
 * los guiones y las URLs enteras a la vista. Se veía como un archivo .md.
 *
 * Devuelve una ESTRUCTURA, no HTML. El componente la recorre y arma nodos de
 * React, así que no hay `dangerouslySetInnerHTML` en ningún lado: lo que
 * escriba el modelo —o lo que le hayan pedido escribir— no puede inyectar
 * etiquetas. Es la razón de no usar una librería de markdown, además del peso.
 *
 * Los enlaces al propio sitio NO se dejan dentro del texto: se sacan como
 * pastillas debajo del mensaje y en la frase queda solo el nombre. Un enlace
 * dentro de un párrafo de chat se lee mal y se toca peor con el dedo, y las
 * fichas son lo que el chat tiene que hacer visitar.
 */

export type Trozo =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'fuerte'; texto: string }
  | { tipo: 'enlace'; texto: string; href: string };

export type Bloque =
  | { tipo: 'parrafo'; trozos: Trozo[] }
  | { tipo: 'lista'; puntos: Trozo[][] };

export type Pastilla = { texto: string; href: string };

export type MensajeFormateado = { bloques: Bloque[]; pastillas: Pastilla[] };

const VINETA = /^\s*(?:[-*•]|\d+[.)])\s+/;
const TITULO = /^\s*#{1,6}\s+/;
/* El orden importa: [texto](url) antes que la URL suelta, o la segunda se
   comería la primera. */
const INLINE = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|(https?:\/\/[^\s)<>"']+)/g;

/** Quita el punto final y los paréntesis que suelen pegarse a una URL suelta. */
function limpiarUrl(url: string): string {
  let limpia = url;
  while (/[.,;:!?)]$/.test(limpia)) limpia = limpia.slice(0, -1);
  return limpia;
}

/**
 * ¿Este enlace es a una ficha de nuestro propio sitio? Devuelve la ruta
 * relativa si lo es, y null si apunta afuera.
 *
 * Se devuelve relativa a propósito: así el enlace funciona igual en
 * localhost, en el despliegue de Vercel y en el dominio de verdad, sin que el
 * viajero salte de un host a otro a media conversación.
 */
export function rutaPropia(href: string, dominio: string): string | null {
  if (href.startsWith('/')) return href;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  const anfitrion = u.hostname.replace(/^www\./, '');
  if (anfitrion !== dominio.replace(/^www\./, '')) return null;
  return `${u.pathname}${u.search}` || '/';
}

/** El nombre que se muestra cuando el modelo pegó la URL pelada, sin texto. */
function nombreDesdeRuta(ruta: string): string {
  const ultima = ruta.split('?')[0].split('/').filter(Boolean).pop() ?? '';
  if (!ultima) return 'Ver en el sitio';
  return ultima
    .split('-')
    .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' ');
}

/** Parte una línea en trozos, apartando las pastillas que encuentre. */
function trozosDe(linea: string, dominio: string, pastillas: Pastilla[]): Trozo[] {
  const trozos: Trozo[] = [];
  let desde = 0;

  const plano = (texto: string) => {
    if (texto) trozos.push({ tipo: 'texto', texto });
  };

  for (const m of linea.matchAll(INLINE)) {
    const inicio = m.index ?? 0;
    plano(linea.slice(desde, inicio));
    desde = inicio + m[0].length;

    const [, textoEnlace, urlEnlace, fuerteAst, fuerteBajo, urlSuelta] = m;

    if (textoEnlace && urlEnlace) {
      const ruta = rutaPropia(urlEnlace, dominio);
      if (ruta) {
        // Nuestro: el nombre se queda en la frase y el enlace baja a pastilla.
        plano(textoEnlace);
        pastillas.push({ texto: textoEnlace, href: ruta });
      } else {
        trozos.push({ tipo: 'enlace', texto: textoEnlace, href: urlEnlace });
      }
    } else if (fuerteAst || fuerteBajo) {
      trozos.push({ tipo: 'fuerte', texto: (fuerteAst || fuerteBajo)! });
    } else if (urlSuelta) {
      const url = limpiarUrl(urlSuelta);
      const ruta = rutaPropia(url, dominio);
      if (ruta) {
        // URL pelada al propio sitio: no se enseña nunca, se vuelve pastilla.
        pastillas.push({ texto: nombreDesdeRuta(ruta), href: ruta });
      } else {
        trozos.push({ tipo: 'enlace', texto: url.replace(/^https?:\/\/(www\.)?/, ''), href: url });
      }
      // Lo que sobró del recorte (el punto final) vuelve al texto.
      plano(urlSuelta.slice(url.length));
    }
  }
  plano(linea.slice(desde));

  /* Al sacarle a la línea una URL nuestra queda colgando lo que la
     introducía: "Mirá →", "Ficha:", un guion suelto. Se recorta del final.
     Los dos puntos NO entran en la lista: "yo armaría así:" termina así a
     propósito y es la línea que presenta la lista de abajo. */
  const ultimo = trozos[trozos.length - 1];
  if (ultimo?.tipo === 'texto') {
    const podado = ultimo.texto.replace(/[\s·–—→>-]+$/, '');
    if (podado) ultimo.texto = podado;
    else trozos.pop();
  }
  return trozos;
}

export function formatearMensaje(texto: string, dominio: string): MensajeFormateado {
  const bloques: Bloque[] = [];
  const pastillas: Pastilla[] = [];
  const lineas = (texto ?? '').replace(/\r\n?/g, '\n').split('\n');

  let parrafo: string[] = [];
  let lista: Trozo[][] | null = null;

  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    const trozos = trozosDe(parrafo.join(' ').trim(), dominio, pastillas);
    if (trozos.length) bloques.push({ tipo: 'parrafo', trozos });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista?.length) bloques.push({ tipo: 'lista', puntos: lista });
    lista = null;
  };

  for (const cruda of lineas) {
    const linea = cruda.trimEnd();

    if (!linea.trim()) {
      cerrarParrafo();
      cerrarLista();
      continue;
    }

    if (VINETA.test(linea)) {
      cerrarParrafo();
      lista ??= [];
      const trozos = trozosDe(linea.replace(VINETA, ''), dominio, pastillas);
      if (trozos.length) lista.push(trozos);
      continue;
    }

    cerrarLista();

    /* El prompt le pide que no use títulos, pero si se le escapa uno no se
       pinta el `###`: se trata como una línea en negrita y ya. */
    if (TITULO.test(linea)) {
      cerrarParrafo();
      const trozos = trozosDe(linea.replace(TITULO, ''), dominio, pastillas);
      if (trozos.length) {
        bloques.push({
          tipo: 'parrafo',
          trozos: trozos.map((t) => (t.tipo === 'texto' ? { tipo: 'fuerte', texto: t.texto } : t)),
        });
      }
      continue;
    }

    parrafo.push(linea.trim());
  }
  cerrarParrafo();
  cerrarLista();

  /* Sin repetidas y como mucho cuatro: el chat recomienda tres opciones por
     mensaje, así que más pastillas que eso significa que algo salió raro. */
  const vistas = new Set<string>();
  const unicas = pastillas.filter((p) => !vistas.has(p.href) && vistas.add(p.href)).slice(0, 4);

  return { bloques, pastillas: unicas };
}
