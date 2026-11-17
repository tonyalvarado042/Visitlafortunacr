'use client';

import { useActionState, useEffect, useRef } from 'react';

/*
 * El formulario grande de una ficha: la barra de guardar, sus errores, y LO
 * QUE SE ESCRIBIO DE VUELTA EN SU LUGAR.
 *
 * ⚠️ POR QUE NO ES UN <form action={accion}> PELADO.
 *
 * Tony, 10 de noviembre de 2026: lleno la ficha de Bike & Bed entera, le dio
 * «Guardar todo», la base la rechazo por un campo, y **lo que habia escrito se
 * perdio**. Lo perdio el arreglo de esa misma mannana: al fallar, la accion
 * hacia `redirect(...?fallo=)`, el navegador iba a buscar la pagina de nuevo y
 * el servidor la armaba CON LO QUE HAY EN LA BASE — que era lo viejo, porque
 * el guardado acababa de fallar.
 *
 *     exito  -> redirect, para que los campos nazcan de lo guardado
 *               (sin el, la pantalla miente: muestra lo viejo y el siguiente
 *               «Guardar» revierte el cambio anterior — ya paso)
 *     fallo  -> NO navegar, y ademas reponer lo tecleado (ver abajo)
 *
 * ⚠️ Y NO ALCANZA CON NO NAVEGAR. Eso se probo en produccion: el error salia
 * bien y los campos se vaciaban IGUAL. Medido en el navegador, con el nodo
 * marcado antes y despues:
 *
 *     mismoNodo: true    facebook: (VACIO)    resumen: (VACIO)
 *
 * O sea React NO recrea el input — lo conserva y le borra el valor, porque al
 * re-renderizar vuelve a aplicarle su `defaultValue`, que sale de la base.
 * Pasa con todo campo no controlado del panel, que son todos.
 *
 * Por eso lo tecleado se guarda ANTES de mandarlo y se repone despues. Es
 * explicito a proposito: no depende de que React reconcilie de cierta manera,
 * repone exactamente lo que viajo en el envio.
 */

export type Guardado = { errores?: string[] };
const NADA: Guardado = {};

export function FormularioGuardar({
  accion, nota, children,
}: {
  accion: (previo: Guardado, datos: FormData) => Promise<Guardado>;
  nota: string;
  children: React.ReactNode;
}) {
  const [estado, enviar, guardando] = useActionState(accion, NADA);
  const forma = useRef<HTMLFormElement>(null);
  /* Lo que viajo en el ultimo envio. Es la copia de seguridad de lo tecleado. */
  const tecleado = useRef<FormData | null>(null);

  useEffect(() => {
    const datos = tecleado.current;
    if (!estado.errores?.length || !datos || !forma.current) return;

    for (const campo of Array.from(forma.current.elements)) {
      const el = campo as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (!el.name) continue;
      /* Un archivo no se repone (el navegador no deja escribir .files), y un
         boton con `name` —los de mover foto, destacar— no lleva nada que
         reponer: su valor solo existe en el momento del clic. */
      const tipo = (el as HTMLInputElement).type;
      if (tipo === 'file' || tipo === 'submit' || tipo === 'button') continue;

      if (tipo === 'checkbox' || tipo === 'radio') {
        (el as HTMLInputElement).checked = datos.getAll(el.name).includes((el as HTMLInputElement).value);
        continue;
      }
      const valor = datos.get(el.name);
      if (typeof valor === 'string') el.value = valor;
    }
  }, [estado]);

  const malos = estado.errores ?? [];

  return (
    <form
      ref={forma}
      /* ⚠️ `enviar` DIRECTO, no una flecha que lo envuelva.
         Con una funcion anonima aca, React arma el envio SIN el par
         nombre/valor del boton que lo disparo. Y los botones de fila de esta
         pantalla —subir, bajar, borrar una razon— mandan su id justo ahi, asi
         que llegaban vacios y la accion se cortaba sin hacer nada ni decirlo.
         Se vio el 10 de noviembre de 2026: «Agregar razon» (sin nombre ni
         valor) funcionaba y «×» (con los dos) no.
         Lo tecleado se copia en onSubmit, que corre ANTES y no estorba. */
      action={enviar}
      onSubmit={(e) => { tecleado.current = new FormData(e.currentTarget); }}
      autoComplete="off"
    >
      {children}

      {/* La barra pegada abajo: es donde esta el boton, asi que es donde hay
          que decir por que no se guardo. Un aviso arriba de una pagina de 500
          lineas no lo ve quien le acaba de dar Guardar. */}
      <div className="barra-guardar">
        {malos.length ? (
          <span style={{ color: '#B42318', lineHeight: 1.5 }}>
            {/* Lo primero y en negrita, porque es justo lo que Tony necesitaba
                saber y nadie le dijo: que no perdio lo que escribio. */}
            <strong>No se guardó nada — lo que escribiste sigue acá.</strong>{' '}
            {malos.length === 1 ? malos[0] : (
              <>Arreglá esto y volvé a darle:
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {malos.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </>
            )}
          </span>
        ) : (
          <span>{nota}</span>
        )}
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? '…' : 'Guardar todo'}
        </button>
      </div>
    </form>
  );
}
