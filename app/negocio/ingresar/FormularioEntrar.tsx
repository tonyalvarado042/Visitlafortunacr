'use client';

import { useActionState, useState } from 'react';
import { entrarComercio, olvideMiClaveComercio, type EstadoComercio } from '../acciones';

const NADA: EstadoComercio = {};

export function FormularioEntrar() {
  const [modo, setModo] = useState<'clave' | 'olvide'>('clave');
  const [estado, accion, pendiente] = useActionState(entrarComercio, NADA);
  const [olvido, accionOlvido, pendienteOlvido] = useActionState(olvideMiClaveComercio, NADA);

  // Pedir el enlace: lo primero que busca quien no puede entrar.
  if (modo === 'olvide') {
    return (
      <form action={accionOlvido} className="forma">
        <p className="comercio-sub" style={{ marginTop: 0 }}>
          Poné tu correo y te mandamos un enlace para escribir una contraseña nueva.
        </p>
        <label>
          <span>Tu correo</span>
          <input name="email" type="email" autoComplete="email" required autoFocus />
        </label>

        {olvido.error && <p className="forma-error">{olvido.error}</p>}
        {olvido.ok && <p className="forma-ok">{olvido.ok}</p>}

        <button type="submit" className="boton" disabled={pendienteOlvido}>
          {pendienteOlvido ? 'Mandando…' : 'Mandarme el enlace'}
        </button>
        <button type="button" className="enlace-flojo" onClick={() => setModo('clave')}>
          ← Volver a entrar con contraseña
        </button>
      </form>
    );
  }

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
      <button type="button" className="enlace-flojo" onClick={() => setModo('olvide')}>
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  );
}
