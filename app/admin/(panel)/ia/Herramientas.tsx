'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { correrAhora, probarConcierge, type Estado } from './acciones';

export function ProbarConcierge({ idiomas, principal, nombre }: { idiomas: string[]; principal: string; nombre: string }) {
  const [estado, accion, pendiente] = useActionState(probarConcierge, {} as Estado);
  return (
    <form action={accion}>
      <div className="campos" style={{ gridTemplateColumns: '1fr auto' }}>
        <div className="campo"><input name="pregunta" placeholder={`Preguntale algo a ${nombre} como si fueras un viajero…`} required /></div>
        <div className="campo"><select name="idioma" defaultValue={principal}>{idiomas.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
      </div>
      <div className="pie-formulario">
        <button type="submit" className="boton" disabled={pendiente}>{pendiente ? 'Pensando…' : '✦ Probar'}</button>
        <span className="gris" style={{ color: '#8B8B87', fontSize: 12.5 }}>Corre el agente real con sus herramientas; queda como conversación de prueba y cuenta como costo.</span>
      </div>
      {estado.error && <div className="aviso mal" style={{ marginTop: 10 }}>{estado.error}</div>}
      {estado.respuesta && (
        <div className="chat" style={{ marginTop: 12 }}>
          <div className="msg ia"><div className="quien">{nombre}</div>{estado.respuesta}</div>
          {estado.ok && <div className="aviso info">{estado.ok}</div>}
          {estado.conversacion_id && <Link href={`/admin/conversaciones/${estado.conversacion_id}`} style={{ fontSize: 12.5 }}>Ver la conversación y las herramientas que usó →</Link>}
        </div>
      )}
    </form>
  );
}

export function CorrerAhora() {
  const [estado, accion, pendiente] = useActionState(correrAhora, {} as Estado);
  return (
    <form action={accion}>
      <button type="submit" className="boton secundario" disabled={pendiente}>{pendiente ? 'Corriendo…' : '▶ Correr automatizaciones ahora'}</button>
      {estado.error && <div className="aviso mal" style={{ marginTop: 10 }}>{estado.error}</div>}
      {estado.ok && <div className="aviso ok" style={{ marginTop: 10 }}>{estado.ok}</div>}
    </form>
  );
}
