'use client';

import { useActionState } from 'react';
import { cambiarMiClave, type EstadoClave } from './acciones';

export function MiCuenta({ email }: { email: string }) {
  const [estado, accion, pendiente] = useActionState(cambiarMiClave, {} as EstadoClave);
  return (
    <form action={accion} className="campos" style={{ gridTemplateColumns: '1fr' }}>
      <p className="gris" style={{ color: '#8B8B87', fontSize: 12.5, margin: 0 }}>
        Entrás como <strong style={{ color: '#0B0B0B' }}>{email}</strong>. Cambiá tu contraseña cuando quieras; no hace falta ningún correo.
      </p>
      <div className="campo"><label>Contraseña nueva (mínimo 8)</label><input type="password" name="clave" minLength={8} required autoComplete="new-password" /></div>
      <div className="campo"><label>Repetila</label><input type="password" name="repetida" minLength={8} required autoComplete="new-password" /></div>
      <button type="submit" className="boton" disabled={pendiente}>{pendiente ? 'Cambiando…' : 'Cambiar mi contraseña'}</button>
      {estado.error && <div className="aviso mal">{estado.error}</div>}
      {estado.ok && <div className="aviso ok">{estado.ok}</div>}
    </form>
  );
}
