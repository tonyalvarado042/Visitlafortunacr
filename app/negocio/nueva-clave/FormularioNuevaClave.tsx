'use client';

import { useActionState } from 'react';
import { guardarNuevaClaveComercio, type EstadoComercio } from '../acciones';

const NADA: EstadoComercio = {};

export function FormularioNuevaClave() {
  const [estado, accion, pendiente] = useActionState(guardarNuevaClaveComercio, NADA);

  return (
    <form action={accion} className="forma">
      <label>
        <span>Contraseña nueva (mínimo 8)</span>
        <input name="clave" type="password" minLength={8} autoComplete="new-password" required autoFocus />
      </label>
      <label>
        <span>Repetila</span>
        <input name="repetida" type="password" minLength={8} autoComplete="new-password" required />
      </label>

      {estado.error && <p className="forma-error">{estado.error}</p>}

      <button type="submit" className="boton" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar y entrar'}
      </button>
    </form>
  );
}
