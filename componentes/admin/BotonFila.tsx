'use client';

import { useTransition } from 'react';

/*
 * Un boton de fila —subir, bajar, borrar, destacar— que llama a su accion
 * DIRECTAMENTE, sin pasar por el formulario donde vive.
 *
 * ⚠️ POR QUE EXISTE. Estos botones estaban asi:
 *
 *     <button type="submit" name="razon_id" value={r.id} formAction={borrarRazon}>
 *
 * y el dato iba en el par nombre/valor del boton. Eso funciona en HTML puro y
 * funcionaba cuando el <form> mandaba su accion de servidor directo. **Dejo de
 * funcionar el 10 de noviembre de 2026**, cuando el formulario paso a
 * `useActionState` para poder mostrar los errores sin perder lo escrito: con
 * ese manejo, React arma el envio SIN el par del boton que lo disparo.
 *
 * El sintoma era de los caros: el POST salia, el servidor contestaba 200, y no
 * pasaba NADA. La accion recibia el id vacio y cortaba por su guarda de
 * entrada —`if (!esUuid(razonId)) return`— sin escribir ni un registro.
 * Se vio comparando dos botones del mismo bloque: «Agregar razon», que no
 * lleva nombre ni valor, seguia andando; «×», que lleva los dos, no.
 *
 * Asi ya no depende de como React trate el boton que envia: los campos se
 * arman aca, a mano, y se le pasan a la accion. Y como es `type="button"`, ni
 * siquiera envia el formulario que lo rodea.
 */
export function BotonFila({
  accion, campos, children, clase = 'boton chico secundario', titulo, desactivado,
}: {
  accion: (datos: FormData) => Promise<unknown> | unknown;
  campos: Record<string, string>;
  children: React.ReactNode;
  clase?: string;
  titulo?: string;
  desactivado?: boolean;
}) {
  const [pendiente, iniciar] = useTransition();

  return (
    <button
      type="button"
      className={clase}
      aria-label={titulo}
      disabled={pendiente || desactivado}
      onClick={() => iniciar(async () => {
        const datos = new FormData();
        for (const [clave, valor] of Object.entries(campos)) datos.set(clave, valor);
        await accion(datos);
      })}
    >
      {pendiente ? '…' : children}
    </button>
  );
}
