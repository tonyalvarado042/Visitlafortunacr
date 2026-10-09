'use client';

import { useActionState } from 'react';
import { entrarComercio, type EstadoComercio } from '../acciones';

const NADA: EstadoComercio = {};

export function FormularioEntrar() {
  const [estado, accion, pendiente] = useActionState(entrarComercio, NADA);

  return (
    <form action={accion} className="forma">
      <label>
        <span>Tu correo</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        <span>Tu contraseña</span>
        <input name="clave" type="password" autoComplete="current-password" required />
      </label>

      {estado.error && <p className="forma-error">{estado.error}</p>}

      <button type="submit" className="boton" disabled={pendiente}>
        {pendiente ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
