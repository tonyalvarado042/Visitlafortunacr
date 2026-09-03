'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { t, type Idioma } from '@/lib/idiomas';

/*
 * El chat "Preguntale a alguien de aquí". Habla con /api/ia/conversar, que
 * registra cada mensaje y deja responder al concierge; si una persona del
 * equipo toma la conversación, el widget consulta cada tanto por sus
 * respuestas. El identificador del visitante vive en localStorage: la misma
 * persona vuelve mañana y sigue el mismo hilo.
 */

type Burbuja = { de: 'yo' | 'ellos'; texto: string; en: string };

function identificadorLocal(): string {
  try {
    const guardado = localStorage.getItem('vlf_chat_id');
    if (guardado && /^[a-zA-Z0-9_-]{8,64}$/.test(guardado)) return guardado;
    const nuevo = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
    localStorage.setItem('vlf_chat_id', nuevo);
    return nuevo;
  } catch {
    return `anon-${Math.random().toString(36).slice(2, 14)}`;
  }
}

export function Concierge({ idioma, marca }: { idioma: Idioma; marca: string }) {
  const [abierto, setAbierto] = useState(false);
  const [burbujas, setBurbujas] = useState<Burbuja[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [humano, setHumano] = useState(false);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const identificador = useRef<string>('');
  const ultimoRecibido = useRef<string | null>(null);
  const fondo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    identificador.current = identificadorLocal();
    try {
      const guardada = localStorage.getItem('vlf_chat_conv');
      if (guardada) setConversacionId(guardada);
      const historial = localStorage.getItem('vlf_chat_hilo');
      if (historial) setBurbujas(JSON.parse(historial));
    } catch { /* sin almacenamiento, sin memoria: igual funciona */ }

    const abrir = (evento: Event) => {
      setAbierto(true);
      const detalle = (evento as CustomEvent<{ mensaje?: string }>).detail;
      if (detalle?.mensaje) setTexto(detalle.mensaje);
    };
    window.addEventListener('abrir-concierge', abrir);
    return () => window.removeEventListener('abrir-concierge', abrir);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('vlf_chat_hilo', JSON.stringify(burbujas.slice(-60))); } catch { /* nada */ }
    fondo.current?.scrollTo({ top: fondo.current.scrollHeight, behavior: 'smooth' });
  }, [burbujas, abierto]);

  // Cuando una persona atiende, se consulta cada 8 segundos por sus respuestas.
  const consultar = useCallback(async () => {
    if (!conversacionId) return;
    const params = new URLSearchParams({ conversacion_id: conversacionId, identificador: identificador.current });
    if (ultimoRecibido.current) params.set('desde', ultimoRecibido.current);
    try {
      const r = await fetch(`/api/ia/conversar?${params.toString()}`);
      if (!r.ok) return;
      const cuerpo = await r.json();
      setHumano(!!cuerpo.humano);
      const nuevos = (cuerpo.mensajes ?? []) as { cuerpo: string; enviado_en: string }[];
      if (nuevos.length) {
        ultimoRecibido.current = nuevos[nuevos.length - 1].enviado_en;
        setBurbujas((previas) => [...previas, ...nuevos.map((m) => ({ de: 'ellos' as const, texto: m.cuerpo, en: m.enviado_en }))]);
      }
    } catch { /* la próxima vez */ }
  }, [conversacionId]);

  useEffect(() => {
    if (!abierto || !humano) return;
    const temporizador = setInterval(consultar, 8000);
    return () => clearInterval(temporizador);
  }, [abierto, humano, consultar]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const mensaje = texto.trim();
    if (!mensaje || enviando) return;
    setTexto('');
    setEnviando(true);
    const ahora = new Date().toISOString();
    setBurbujas((previas) => [...previas, { de: 'yo', texto: mensaje, en: ahora }]);

    try {
      const r = await fetch('/api/ia/conversar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador: identificador.current, mensaje, idioma }),
      });
      const cuerpo = await r.json();
      if (cuerpo.conversacion_id) {
        setConversacionId(cuerpo.conversacion_id);
        try { localStorage.setItem('vlf_chat_conv', cuerpo.conversacion_id); } catch { /* nada */ }
      }
      if (!r.ok) throw new Error(cuerpo.error ?? 'error');
      ultimoRecibido.current = new Date().toISOString();
      if (cuerpo.respuesta) {
        setBurbujas((previas) => [...previas, { de: 'ellos', texto: cuerpo.respuesta, en: new Date().toISOString() }]);
      }
      setHumano(!!cuerpo.humano || !!cuerpo.escalada);
    } catch {
      setBurbujas((previas) => [...previas, { de: 'ellos', texto: t('concierge_error', idioma), en: new Date().toISOString() }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button type="button" className={`concierge-boton${abierto ? ' oculto' : ''}`} onClick={() => setAbierto(true)} aria-label={t('concierge_boton', idioma)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
        </svg>
        <span>{t('concierge_boton', idioma)}</span>
      </button>

      {abierto && (
        <section className="concierge" aria-label={t('concierge_titulo', idioma)}>
          <header>
            <div>
              <strong>{t('concierge_titulo', idioma)}</strong>
              <small>{marca}</small>
            </div>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar">×</button>
          </header>

          <div className="hilo" ref={fondo}>
            <div className="burbuja ellos">{t('concierge_saludo', idioma)}</div>
            {burbujas.map((b, i) => (
              <div key={i} className={`burbuja ${b.de}`}>{b.texto}</div>
            ))}
            {enviando && <div className="burbuja ellos pensando">···</div>}
            {humano && <div className="aviso">{t('concierge_humano', idioma)}</div>}
          </div>

          <form onSubmit={enviar}>
            <input
              type="text" value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder={t('concierge_escribe', idioma)} maxLength={2000} autoFocus
            />
            <button type="submit" disabled={enviando || !texto.trim()}>{t('concierge_enviar', idioma)}</button>
          </form>
        </section>
      )}
    </>
  );
}
