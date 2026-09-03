'use client';

import { useActionState } from 'react';
import { lanzarDestino, type Estado } from './acciones';

export function LanzarDestino() {
  const [estado, accion, pendiente] = useActionState(lanzarDestino, {} as Estado);
  return (
    <form action={accion} className="campos">
      <div className="campo"><label>Nombre</label><input name="nombre" placeholder="Monteverde" required /></div>
      <div className="campo"><label>Babosa</label><input name="babosa" placeholder="monteverde" required /></div>
      <div className="campo"><label>Dominio</label><input name="dominio" placeholder="visitmonteverdecr.com" required /></div>
      <div className="campo"><label>Marca</label><input name="marca_nombre" placeholder="Visit Monteverde CR" /></div>
      <div className="campo"><label>Sigla</label><input name="marca_sigla" placeholder="VMV" /></div>
      <div className="campo"><label>País (ISO)</label><input name="pais_iso" defaultValue="CR" maxLength={2} /></div>
      <div className="campo"><label>País</label><input name="pais_nombre" defaultValue="Costa Rica" /></div>
      <div className="campo"><label>Zona horaria</label><input name="zona_horaria" defaultValue="America/Costa_Rica" /></div>
      <div className="campo"><label>Moneda</label><input name="moneda_iso" defaultValue="CRC" maxLength={3} /></div>
      <div className="campo"><label>Región</label><input name="region" placeholder="Puntarenas" /></div>
      <div className="campo"><label>Lema (es)</label><input name="lema_es" /></div>
      <div className="campo"><label>Lema (en)</label><input name="lema_en" /></div>
      <div className="campo ancho"><label>Idiomas</label><div className="acciones-fila">{['es', 'en', 'pt', 'fr', 'de'].map((i) => <label key={i}><input type="checkbox" name="idiomas" value={i} defaultChecked={i === 'es' || i === 'en'} /> {i}</label>)}</div></div>
      <div className="campo ancho">
        <button type="submit" className="boton" disabled={pendiente}>{pendiente ? 'Lanzando…' : '🚀 Lanzar destino'}</button>
        {estado.error && <div className="aviso mal" style={{ marginTop: 10 }}>{estado.error}</div>}
        {estado.ok && <div className="aviso ok" style={{ marginTop: 10 }}>{estado.ok}</div>}
      </div>
    </form>
  );
}
