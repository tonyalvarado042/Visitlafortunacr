'use client';

import { useActionState } from 'react';
import { guardarNuevaClave, type EstadoNuevaClave } from './acciones';

const NADA: EstadoNuevaClave = { error: null };

export function FormularioNuevaClave() {
  const [estado, accion, pendiente] = useActionState(guardarNuevaClave, NADA);

  return (
    <form action={accion} className="campos" style={{ gridTemplateColumns: '1fr' }}>
      {estado.error && <div className="aviso mal">{estado.error}</div>}
      <div className="campo">
        <label>Contraseña nueva (mínimo 8)</label>
        <input type="password" name="clave" required minLength={8} autoComplete="new-password" autoFocus />
      </div>
      <div className="campo">
        <label>Repetila</label>
        <input type="password" name="repetida" required minLength={8} autoComplete="new-password" />
      </div>
      <button className="boton" type="submit" disabled={pendiente}>
        {pendiente ? '…' : 'Guardar y entrar'}
      </button>
    </form>
  );
}
