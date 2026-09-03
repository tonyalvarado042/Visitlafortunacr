'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { analizar, responder, sugerir, type Estado } from '../acciones';

const NADA: Estado = {};

export function Responder({ id, canal }: { id: string; canal: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [eResponder, aResponder, pResponder] = useActionState(responder, NADA);
  const [eSugerir, aSugerir, pSugerir] = useActionState(sugerir, NADA);
  const [eAnalizar, aAnalizar, pAnalizar] = useActionState(analizar, NADA);

  useEffect(() => { if (eSugerir.borrador) setTexto(eSugerir.borrador); }, [eSugerir]);
  useEffect(() => { if (eResponder.ok) { setTexto(''); router.refresh(); } }, [eResponder, router]);
  useEffect(() => { if (eAnalizar.ok) router.refresh(); }, [eAnalizar, router]);

  return (
    <div className="tarjeta">
      <h2>Responder como equipo <small>por {canal}</small></h2>
      <form action={aSugerir} className="acciones-fila" style={{ marginBottom: 10 }}>
        <input type="hidden" name="id" value={id} />
        <input type="text" name="indicaciones" placeholder="Indicaciones para la IA (opcional)" style={{ flex: 1, minWidth: 200, padding: '8px 10px', borderRadius: 8, border: '1px solid #D8D8D3', fontFamily: 'inherit' }} />
        <button type="submit" className="boton secundario" disabled={pSugerir}>{pSugerir ? 'Pensando…' : '✦ Sugerir respuesta'}</button>
        <button type="submit" className="boton secundario" formAction={aAnalizar} disabled={pAnalizar}>{pAnalizar ? 'Analizando…' : '✦ Analizar'}</button>
      </form>
      {eSugerir.error && <div className="aviso mal">{eSugerir.error}</div>}
      {eAnalizar.error && <div className="aviso mal">{eAnalizar.error}</div>}
      {eAnalizar.ok && <div className="aviso ok">Análisis: {eAnalizar.ok}</div>}

      <form action={aResponder}>
        <input type="hidden" name="id" value={id} />
        {canal === 'email' && <div className="campo" style={{ marginBottom: 10 }}><input type="text" name="asunto" placeholder="Asunto" /></div>}
        <div className="campo"><textarea name="texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí la respuesta o pedile una sugerencia a la IA…" required /></div>
        <div className="pie-formulario">
          <button type="submit" className="boton" disabled={pResponder || !texto.trim()}>{pResponder ? 'Enviando…' : 'Enviar'}</button>
          <span className="gris" style={{ color: '#8B8B87', fontSize: 12.5 }}>Al responder, la conversación queda a tu cargo y la IA deja de contestar hasta que la devuelvas.</span>
          {eResponder.error && <span className="aviso mal" style={{ margin: 0 }}>{eResponder.error}</span>}
          {eResponder.ok && <span className="aviso ok" style={{ margin: 0 }}>{eResponder.ok}</span>}
        </div>
      </form>
    </div>
  );
}
