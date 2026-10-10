'use client';

import { useActionState, useRef } from 'react';
import { guardarLlave, type EstadoLlave } from './acciones';

const NADA: EstadoLlave = {};

export function FormularioLlave({
  nombre, titulo, paraQue, ejemplo,
}: {
  nombre: string;
  titulo: string;
  paraQue: string;
  ejemplo?: string;
}) {
  const [estado, accion, pendiente] = useActionState(guardarLlave, NADA);
  const campo = useRef<HTMLInputElement>(null);

  return (
    <form
      action={accion}
      /* Se vacía apenas sale. Una llave no se queda escrita en pantalla
         esperando a que alguien pase por detrás. */
      onSubmit={() => { setTimeout(() => { if (campo.current) campo.current.value = ''; }, 0); }}
      className="campos"
      style={{ gridTemplateColumns: '1fr' }}
    >
      <input type="hidden" name="nombre" value={nombre} />
      <input type="hidden" name="descripcion" value={paraQue} />

      {estado.error && <div className="aviso mal">{estado.error}</div>}
      {estado.ok && <div className="aviso ok">{estado.ok}</div>}

      <div className="campo">
        <label htmlFor={`llave-${nombre}`}>{titulo}</label>
        <input
          ref={campo}
          id={`llave-${nombre}`}
          name="valor"
          type="password"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder={ejemplo ?? 'Pegala acá'}
          /* Ni el navegador ni un gestor de contraseñas deberían guardarla:
             esto no es una contraseña de nadie, es una llave del sistema. */
          data-lpignore="true"
          data-1p-ignore="true"
        />
        <small>{paraQue}</small>
      </div>

      <button className="boton" type="submit" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar la llave'}
      </button>
    </form>
  );
}
