import React from 'react';

/*
 * El cuerpo de un mensaje en el panel, con los enlaces clickeables.
 *
 * Tony, 10 de noviembre de 2026: *«el mensaje aquí no es clickeable»*. Estaba
 * pintado como `{m.cuerpo}`, texto crudo: el enlace del plan se veía pero no
 * se podía abrir, y la única forma de revisarlo era copiarlo a mano de una
 * línea de 90 caracteres.
 *
 * ⚠️ NO USA `dangerouslySetInnerHTML`, Y ESA ES LA DECISIÓN.
 *
 * Por acá pasan los mensajes ENTRANTES, escritos por el viajero. Pintar eso
 * como HTML es dejar que cualquiera que escriba al sitio meta etiquetas en el
 * panel del equipo. Se parte el texto y se arman nodos de React: lo que no es
 * un enlace sale como texto, siempre, sin que nadie tenga que acordarse de
 * escapar nada.
 *
 * Los saltos de línea los respeta el CSS (`white-space: pre-line`), no un
 * `<br>` por cada uno: así un cuerpo sin saltos tampoco gana espacios raros.
 */

/* Hasta el espacio o el fin de línea. El recorte de la puntuación final va
   aparte, abajo: una URL al final de una frase se lleva el punto puesto, y un
   enlace que termina en «.» no abre. */
const URL_SUELTA = /(https?:\/\/[^\s<]+)/g;

export function CuerpoDeMensaje({ texto }: { texto: string }) {
  if (!texto) return null;

  const partes = texto.split(URL_SUELTA);

  return (
    <div style={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
      {partes.map((parte, i) => {
        /* Las impares son las capturas de la expresión: los enlaces. */
        if (i % 2 === 0) return <React.Fragment key={i}>{parte}</React.Fragment>;

        /* «…plan/abc.» → el enlace es «…plan/abc» y el punto queda como texto.
           Sin esto el enlace se abre con el punto pegado y da 404. */
        const cola = parte.match(/[.,;:!?)\]]+$/)?.[0] ?? '';
        const limpio = cola ? parte.slice(0, -cola.length) : parte;

        return (
          <React.Fragment key={i}>
            <a href={limpio} target="_blank" rel="noreferrer"
               style={{ color: '#1B5FBF', textDecoration: 'underline', wordBreak: 'break-all' }}>
              {limpio}
            </a>
            {cola}
          </React.Fragment>
        );
      })}
    </div>
  );
}
