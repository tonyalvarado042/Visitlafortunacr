'use client';

import { useActionState, useState } from 'react';
import { enlaceMagico, ingresar, olvideMiClave, registrarse, type EstadoIngreso } from './acciones';

const NADA: EstadoIngreso = { error: null, mensaje: null };

export function FormularioIngreso({ volver }: { volver: string }) {
  const [modo, setModo] = useState<'clave' | 'nueva' | 'enlace' | 'olvide'>('clave');
  const [estadoClave, accionClave, pendienteClave] = useActionState(ingresar, NADA);
  const [estadoNueva, accionNueva, pendienteNueva] = useActionState(registrarse, NADA);
  const [estadoEnlace, accionEnlace, pendienteEnlace] = useActionState(enlaceMagico, NADA);
  const [estadoOlvide, accionOlvide, pendienteOlvide] = useActionState(olvideMiClave, NADA);

  const estado = modo === 'clave' ? estadoClave
    : modo === 'nueva' ? estadoNueva
    : modo === 'enlace' ? estadoEnlace
    : estadoOlvide;
  const pendiente = pendienteClave || pendienteNueva || pendienteEnlace || pendienteOlvide;

  return (
    <>
      <div className="pestanas">
        {/* "olvide" es un paso DENTRO de contraseña, no una pestaña aparte: si no
            se resalta, las tres pestañas quedan apagadas y uno no sabe dónde está. */}
        <button type="button" className={modo === 'clave' || modo === 'olvide' ? 'activa' : ''} onClick={() => setModo('clave')}>Contraseña</button>
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
          {/* Lo primero que busca quien no puede entrar. Va DENTRO de la
              pestaña de contraseña, que es donde uno se da cuenta de que no
              se la acuerda. */}
          <button type="button" className="enlace-flojo" onClick={() => setModo('olvide')}>
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      )}

      {modo === 'olvide' && (
        <form action={accionOlvide} className="campos" style={{ gridTemplateColumns: '1fr' }}>
          <p className="gris" style={{ margin: 0, fontSize: 13.5 }}>
            Poné tu correo y te mandamos un enlace para escribir una contraseña nueva.
          </p>
          <div className="campo"><label>Correo</label><input type="email" name="email" required autoComplete="email" /></div>
          <button className="boton" type="submit" disabled={pendiente}>{pendiente ? '…' : 'Mandarme el enlace'}</button>
          <button type="button" className="enlace-flojo" onClick={() => setModo('clave')}>
            ← Volver a entrar con contraseña
          </button>
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
