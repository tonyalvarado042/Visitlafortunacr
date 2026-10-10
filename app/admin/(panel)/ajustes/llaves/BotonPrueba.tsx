'use client';

import { useActionState } from 'react';
import { mandarCorreoDePrueba, type EstadoLlave } from './acciones';

const NADA: EstadoLlave = {};

/** Mandarse un correo a uno mismo, por el camino de verdad. */
export function BotonPrueba({ correo }: { correo: string }) {
  const [estado, accion, pendiente] = useActionState(mandarCorreoDePrueba, NADA);

  return (
    <form action={accion}>
      {estado.error && <div className="aviso mal">{estado.error}</div>}
      {estado.ok && <div className="aviso ok">{estado.ok}</div>}

      <p className="gris" style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 12px' }}>
        Se manda a <strong>{correo}</strong> y a nadie más. Va por el mismo camino
        que las confirmaciones: si esta llega, llegan todas.
      </p>

      <button className="boton" type="submit" disabled={pendiente}>
        {pendiente ? 'Mandando…' : 'Mandarme un correo de prueba'}
      </button>
    </form>
  );
}
