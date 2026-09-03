'use client';

import { useActionState } from 'react';
import { redactarGuiaIA, type Estado } from './acciones';

export function NuevaGuiaIA({ idiomas, principal }: { idiomas: string[]; principal: string }) {
  const [estado, accion, pendiente] = useActionState(redactarGuiaIA, {} as Estado);
  return (
    <form action={accion} className="campos" style={{ gridTemplateColumns: '1fr' }}>
      <div className="campo"><label>Tema</label><input name="tema" placeholder="Las mejores aguas termales para familias" required /></div>
      <div className="campos" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="campo"><label>Tipo</label><select name="tipo" defaultValue="guia"><option value="guia">Guía</option><option value="itinerario">Itinerario</option><option value="comparativa">Comparativa</option><option value="como_llegar">Cómo llegar</option><option value="lista">Lista</option></select></div>
        <div className="campo"><label>Idioma</label><select name="idioma" defaultValue={principal}>{idiomas.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
      </div>
      <div className="campo"><label>Público (opcional)</label><select name="publico" defaultValue=""><option value="">Todos</option>{['pareja', 'familia', 'amigos', 'solo', 'grupo', 'negocios'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
      <div className="campo"><label>Indicaciones (opcional)</label><textarea name="indicaciones" style={{ minHeight: 60 }} placeholder="Mencionar precios de entrada, evitar X, tono cercano…" /></div>
      <button type="submit" className="boton" disabled={pendiente}>{pendiente ? 'Redactando (1 a 2 minutos)…' : '✦ Redactar borrador con IA'}</button>
      {estado.error && <div className="aviso mal">{estado.error}</div>}
    </form>
  );
}
