'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { enviarMensaje, generarPlan, puntuarAhora, redactarConIA, type Estado } from '../acciones';

const NADA: Estado = {};

/**
 * Lo que la IA hace por un lead desde su ficha: puntuarlo, redactar el
 * seguimiento (que una persona revisa y manda) y armar el plan.
 */
export function PanelIA({ id, tieneWhatsapp, tieneEmail, esItinerario }: { id: string; tieneWhatsapp: boolean; tieneEmail: boolean; esItinerario: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [asunto, setAsunto] = useState('');
  const [canal, setCanal] = useState<'whatsapp' | 'email'>(tieneWhatsapp ? 'whatsapp' : 'email');
  const [ePuntuar, aPuntuar, pPuntuar] = useActionState(puntuarAhora, NADA);
  const [eRedactar, aRedactar, pRedactar] = useActionState(redactarConIA, NADA);
  const [eEnviar, aEnviar, pEnviar] = useActionState(enviarMensaje, NADA);
  const [ePlan, aPlan, pPlan] = useActionState(generarPlan, NADA);

  useEffect(() => {
    if (eRedactar.borrador) setTexto(eRedactar.borrador);
    if (eRedactar.asunto) setAsunto(eRedactar.asunto);
  }, [eRedactar]);

  useEffect(() => {
    if (eEnviar.ok) { setTexto(''); router.refresh(); }
  }, [eEnviar, router]);

  useEffect(() => {
    if (ePuntuar.ok || ePlan.ok) router.refresh();
  }, [ePuntuar, ePlan, router]);

  return (
    <div className="tarjeta">
      <h2>Escribirle al viajero <small>una persona manda; la IA ayuda</small></h2>

      <form action={aRedactar} className="acciones-fila" style={{ marginBottom: 10 }}>
        <input type="hidden" name="id" value={id} />
        <select name="intento" defaultValue="1" className="campo" style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #D8D8D3', fontFamily: 'inherit' }}>
          <option value="1">1er seguimiento</option>
          <option value="2">2do seguimiento</option>
          <option value="3">Cierre suave</option>
        </select>
        <input type="hidden" name="canal" value={canal} />
        <input type="text" name="indicaciones" placeholder="Indicaciones para la IA (opcional)" style={{ flex: 1, minWidth: 200, padding: '8px 10px', borderRadius: 8, border: '1px solid #D8D8D3', fontFamily: 'inherit' }} />
        <button type="submit" className="boton secundario" disabled={pRedactar}>{pRedactar ? 'Redactando…' : '✦ Redactar con IA'}</button>
      </form>
      {eRedactar.error && <div className="aviso mal">{eRedactar.error}</div>}
      {eRedactar.ok && !eRedactar.error && <div className="aviso info">IA: {eRedactar.ok}</div>}

      <form action={aEnviar}>
        <input type="hidden" name="id" value={id} />
        <div className="campos" style={{ gridTemplateColumns: '1fr' }}>
          <div className="campo">
            <label>Canal</label>
            <div className="acciones-fila">
              {tieneWhatsapp && <label><input type="radio" name="canal" value="whatsapp" checked={canal === 'whatsapp'} onChange={() => setCanal('whatsapp')} /> WhatsApp</label>}
              {tieneEmail && <label><input type="radio" name="canal" value="email" checked={canal === 'email'} onChange={() => setCanal('email')} /> Correo</label>}
              {!tieneWhatsapp && !tieneEmail && <span className="gris">El viajero no tiene contacto.</span>}
            </div>
          </div>
          {canal === 'email' && (
            <div className="campo"><label>Asunto</label><input type="text" name="asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} /></div>
          )}
          <div className="campo">
            <label>Mensaje</label>
            <textarea name="texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí o pedile un borrador a la IA…" required />
          </div>
        </div>
        <div className="pie-formulario">
          <button type="submit" className="boton" disabled={pEnviar || !texto.trim()}>{pEnviar ? 'Enviando…' : 'Enviar'}</button>
          {eEnviar.error && <span className="aviso mal" style={{ margin: 0 }}>{eEnviar.error}</span>}
          {eEnviar.ok && <span className="aviso ok" style={{ margin: 0 }}>{eEnviar.ok}</span>}
        </div>
      </form>

      <hr style={{ border: 0, borderTop: '1px solid #EEE', margin: '18px 0' }} />

      <div className="acciones-fila">
        <form action={aPuntuar}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="boton secundario" disabled={pPuntuar}>{pPuntuar ? 'Puntuando…' : '✦ Puntuar ahora'}</button>
        </form>
        <form action={aPlan}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="boton secundario" disabled={pPlan}>{pPlan ? 'Armando el plan…' : esItinerario ? '✦ Armar (o rehacer) el plan' : '✦ Armar un plan'}</button>
        </form>
      </div>
      {ePuntuar.error && <div className="aviso mal" style={{ marginTop: 10 }}>{ePuntuar.error}</div>}
      {ePuntuar.ok && <div className="aviso ok" style={{ marginTop: 10 }}>{ePuntuar.ok}</div>}
      {ePlan.error && <div className="aviso mal" style={{ marginTop: 10 }}>{ePlan.error}</div>}
      {ePlan.ok && <div className="aviso ok" style={{ marginTop: 10 }}>{ePlan.ok} {ePlan.url && <a href={ePlan.url} target="_blank" rel="noreferrer">abrir ↗</a>}</div>}
    </div>
  );
}
