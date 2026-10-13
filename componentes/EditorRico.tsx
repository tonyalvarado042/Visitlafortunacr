'use client';

import { useRef, useState } from 'react';
import { textoRicoAHtml } from '@/lib/texto-rico';

/*
 * El editor acotado: negrita, cursiva, listas, enlaces y párrafos. Nada más.
 *
 * Por qué no es un editor de HTML. Esto lo va a usar también el dueño de un
 * negocio desde su portal, y el HTML que escribe alguien de afuera hay que
 * sanearlo — un saneador a base de expresiones regulares no alcanza, y el
 * propio `lib/html-de-confianza.ts` lo dice en su comentario. Acá no hay nada
 * que sanear: lo que se guarda son MARCAS y el servidor genera cada etiqueta.
 * Por más que alguien pegue un `<script>`, sale escrito en pantalla.
 *
 * La vista previa usa EL MISMO `textoRicoAHtml` que la página pública, así que
 * lo que se ve acá es exactamente lo que se va a publicar — no una
 * aproximación que después no coincide.
 *
 * Lo que viaja al formulario de afuera es el `<textarea>`, con su `name`. Eso
 * lo vuelve usable dentro de cualquier `<form action={...}>` sin tocar nada.
 */

type Marca = { rotulo: string; titulo: string; abre: string; cierra: string; linea?: boolean };

const MARCAS: Marca[] = [
  { rotulo: 'B',  titulo: 'Negrita',       abre: '**', cierra: '**' },
  { rotulo: 'I',  titulo: 'Cursiva',       abre: '*',  cierra: '*' },
  { rotulo: '•',  titulo: 'Lista',         abre: '- ', cierra: '', linea: true },
  { rotulo: '1.', titulo: 'Lista numerada', abre: '1. ', cierra: '', linea: true },
  { rotulo: '🔗', titulo: 'Enlace',         abre: '[',  cierra: '](https://)' },
];

export function EditorRico({
  nombre, etiqueta, valor, ayuda, filas = 8, requerido,
}: {
  nombre: string;
  etiqueta: string;
  valor: string | null;
  ayuda?: string;
  filas?: number;
  requerido?: boolean;
}) {
  const [texto, setTexto] = useState(valor ?? '');
  const [verPrevia, setVerPrevia] = useState(false);
  const caja = useRef<HTMLTextAreaElement>(null);

  /*
   * Envolver lo seleccionado. Si no hay nada seleccionado, deja las marcas
   * puestas y el cursor en medio, que es lo que hace cualquier editor: si no,
   * hay que escribir primero y marcar después, y nadie trabaja así.
   */
  function marcar(m: Marca) {
    const el = caja.current;
    if (!el) return;
    const ini = el.selectionStart;
    const fin = el.selectionEnd;
    const antes = texto.slice(0, ini);
    const medio = texto.slice(ini, fin);
    const despues = texto.slice(fin);

    let nuevo: string;
    let cursor: number;

    if (m.linea) {
      /* Las listas marcan LÍNEAS, no trozos: poner "- " en medio de una frase
         no hace una lista, hace un guión suelto. */
      const desdeRenglon = antes.lastIndexOf('\n') + 1;
      const bloque = texto.slice(desdeRenglon, fin) || '';
      const marcadas = (bloque || ' ').split('\n')
        .map((l, i) => (m.abre === '1. ' ? `${i + 1}. ` : m.abre) + l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ''))
        .join('\n');
      nuevo = texto.slice(0, desdeRenglon) + marcadas + despues;
      cursor = desdeRenglon + marcadas.length;
    } else {
      nuevo = antes + m.abre + medio + m.cierra + despues;
      cursor = medio ? ini + m.abre.length + medio.length + m.cierra.length
                     : ini + m.abre.length;
    }

    setTexto(nuevo);
    /* El foco vuelve a la caja en el siguiente cuadro: si se pide ahora,
       React todavía no repintó y la posición del cursor se pierde. */
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="editor-rico">
      <div className="editor-cabeza">
        <label htmlFor={`er-${nombre}`}>{etiqueta}</label>
        <div className="editor-botones">
          {MARCAS.map((m) => (
            <button key={m.titulo} type="button" title={m.titulo} aria-label={m.titulo}
                    onClick={() => marcar(m)}
                    className={m.rotulo === 'B' ? 'negrita' : m.rotulo === 'I' ? 'cursiva' : undefined}>
              {m.rotulo}
            </button>
          ))}
          <button type="button" onClick={() => setVerPrevia((v) => !v)}
                  aria-pressed={verPrevia} className="editor-previa-boton">
            {verPrevia ? 'Escribir' : 'Vista previa'}
          </button>
        </div>
      </div>

      {verPrevia ? (
        /* El HTML que se pinta acá lo generó `textoRicoAHtml` a partir de
           marcas, no del navegador: no hay HTML ajeno de por medio. */
        <div className="editor-previa blog-prosa"
             dangerouslySetInnerHTML={{ __html: textoRicoAHtml(texto) || '<p class="gris">Nada escrito todavía.</p>' }} />
      ) : (
        <textarea
          id={`er-${nombre}`}
          name={nombre}
          ref={caja}
          rows={filas}
          required={requerido}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      )}

      {/* Cuando la vista previa está abierta el textarea no existe, y un campo
          que no existe no viaja en el formulario. Este espejo lo mantiene. */}
      {verPrevia && <input type="hidden" name={nombre} value={texto} />}

      <small className="editor-ayuda">
        {ayuda ? `${ayuda} · ` : ''}
        <strong>**negrita**</strong>, <em>*cursiva*</em>, <code>- lista</code>,
        {' '}<code>[texto](https://…)</code>. Una línea en blanco separa párrafos.
      </small>
    </div>
  );
}
