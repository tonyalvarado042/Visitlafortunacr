'use client';

import { useActionState, useState } from 'react';
import { enlaceMagico, ingresar, registrarse, type EstadoIngreso } from './acciones';

const NADA: EstadoIngreso = { error: null, mensaje: null };

export function FormularioIngreso({ volver }: { volver: string }) {
  const [modo, setModo] = useState<'clave' | 'nueva' | 'enlace'>('clave');
  const [estadoClave, accionClave, pendienteClave] = useActionState(ingresar, NADA);
  const [estadoNueva, accionNueva, pendienteNueva] = useActionState(registrarse, NADA);
  const [estadoEnlace, accionEnlace, pendienteEnlace] = useActionState(enlaceMagico, NADA);

  const estado = modo === 'clave' ? estadoClave : modo === 'nueva' ? estadoNueva : estadoEnlace;
  const pendiente = pendienteClave || pendienteNueva || pendienteEnlace;

  return (
    <>
      <div className="pestanas">
        <button type="button" className={modo === 'clave' ? 'activa' : ''} onClick={() => setModo('clave')}>Contraseña</button>
        <button type="button" className={modo === 'enlace' ? 'activa' : ''} onClick={() => setModo('enlace')}>Enlace por correo</button>
        <button type="button" className={modo === 'nueva' ? 'activa' : ''} onClick={() => setModo('nueva')}>Crear cuenta</button>
      </div>

      {estado.error && <div className="aviso mal">{estado.error}</div>}
      {estado.mensaje && <div className="aviso ok">{estado.mensaje}</div>}

      {modo === 'clave' && (
        <form action={accionClave} className="campos" style={{ gridTemplateColumns: '1fr' }}>
          <input type="hidden" name="volver" value={volver} />
          <div className="campo"><label>Correo</label><input type="email" name="email" required autoComplete="email" /></div>
          <div className="campo"><label>Contraseña</label><input type="password" name="clave" required autoComplete="current-password" /></div>
          <button className="boton" type="submit" disabled={pendiente}>{pendiente ? '…' : 'Entrar'}</button>
        </form>
      )}

      {modo === 'enlace' && (
        <form action={accionEnlace} className="campos" style={{ gridTemplateColumns: '1fr' }}>
          <div className="campo"><label>Correo</label><input type="email" name="email" required autoComplete="email" /></div>
          <button className="boton" type="submit" disabled={pendiente}>{pendiente ? '…' : 'Mandarme el enlace'}</button>
        </form>
      )}

      {modo === 'nueva' && (
        <form action={accionNueva} className="campos" style={{ gridTemplateColumns: '1fr' }}>
          <div className="campo"><label>Nombre</label><input type="text" name="nombre" required autoComplete="name" /></div>
          <div className="campo"><label>Correo (el de la invitación)</label><input type="email" name="email" required autoComplete="email" /></div>
          <div className="campo"><label>Contraseña (mínimo 8)</label><input type="password" name="clave" required minLength={8} autoComplete="new-password" /></div>
          <button className="boton" type="submit" disabled={pendiente}>{pendiente ? '…' : 'Crear cuenta'}</button>
        </form>
      )}
    </>
  );
}
