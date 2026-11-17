'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { t, type Idioma } from '@/lib/idiomas';
import { formatearMensaje, type Trozo } from '@/lib/formato-chat';
import { sonar, sePuedeSonar, vigilarElPrimerToque } from './agente-sonido';
import { marcarConversacion } from './no-interrumpir';

/*
 * El chat del sitio. Habla con /api/ia/conversar, que registra cada mensaje y
 * deja responder al concierge; si una persona del equipo toma la conversación,
 * el widget consulta cada tanto por sus respuestas. El identificador del
 * visitante vive en localStorage: la misma persona vuelve mañana y sigue el
 * mismo hilo.
 *
 * ⚠️ QUIÉN CONTESTA SE DICE, NO SE DISIMULA.
 *
 * Tony, 16 de noviembre de 2026, pidió que se sintiera una persona: foto,
 * nombre, que se asome solo, campanita. Todo eso está acá, porque todo eso es
 * diseño legítimo y es lo que hace que alguien se anime a escribir.
 *
 * Lo que NO está es decir que es una persona. El encabezado lleva siempre el
 * cargo («Asistente virtual») al lado del nombre, y el saludo dejó de decir
 * «soy del equipo local». El motivo no es moral, es de negocio: quien descubre
 * que le mintieron en el chat no desconfía del chat, desconfía del sitio donde
 * está a punto de dejar la tarjeta. La calidez sale de la cara, del nombre y
 * de la forma de escribir —y esas tres siguen enteras.
 */

type Burbuja = { de: 'yo' | 'ellos'; texto: string; en: string };

export type QuienContesta = {
  nombre: string;
  cargo: string;
  foto_url: string | null;
};

/* Cuándo se asoma solo, y cuánto se queda.
   El cupón de salida (`CuponAlSalir`) sale a los 45 s. El gancho sale a los 18
   y se esconde a los 14 de estar en pantalla: a los 32 s ya no está, así que
   nunca se pelean por la esquina sin que un archivo tenga que saber del otro. */
const GANCHO_ESPERA_MS = 18_000;
const GANCHO_DURA_MS = 14_000;

const YA_SE_ASOMO = 'vlf_chat_gancho_visto';

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

/* Los trozos ya vienen separados por `formatearMensaje`; aquí solo se eligen
   las etiquetas. Nada de `dangerouslySetInnerHTML`: lo que escriba el modelo
   entra como texto de React y no puede convertirse en marcado. */
function pintar(t: Trozo, i: number) {
  if (t.tipo === 'fuerte') return <strong key={i}>{t.texto}</strong>;
  if (t.tipo === 'enlace') {
    return (
      <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow">{t.texto}</a>
    );
  }
  return <span key={i}>{t.texto}</span>;
}

/* La cara. Con foto si hay; si no, un disco de marca con la inicial.
   ⚠️ El respaldo es a propósito un monograma y NO una cara genérica: una foto
   de alguien que no existe afirma algo falso sin escribir una palabra, y
   encima se reconoce a la legua. Un monograma bien hecho se ve profesional y
   no miente. */
function Cara({ quien, tamano }: { quien: QuienContesta; tamano: number }) {
  const inicial = (quien.nombre.trim()[0] ?? '·').toUpperCase();
  return (
    <span className="agente-cara" style={{ width: tamano, height: tamano, fontSize: Math.round(tamano * 0.42) }}>
      {quien.foto_url
        ? <img src={quien.foto_url} alt="" width={tamano} height={tamano} loading="lazy" decoding="async" />
        : <span aria-hidden="true">{inicial}</span>}
    </span>
  );
}

/* Lo que dice el concierge. Los enlaces a fichas nuestras no van dentro de la
   frase: bajan a pastillas, que es lo que se toca con el dedo. */
function Dicho({ texto, dominio }: { texto: string; dominio: string }) {
  const { bloques, pastillas } = formatearMensaje(texto, dominio);
  return (
    <>
      {bloques.map((b, i) =>
        b.tipo === 'parrafo' ? (
          <p key={i}>{b.trozos.map(pintar)}</p>
        ) : (
          <ul key={i}>
            {b.puntos.map((punto, j) => <li key={j}>{punto.map(pintar)}</li>)}
          </ul>
        ))}
      {pastillas.length > 0 && (
        <div className="pastillas">
          {pastillas.map((p) => (
            <Link key={p.href} className="pastilla" href={p.href}>
              {p.texto}<span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function Concierge({
  idioma, marca, dominio, quien,
}: {
  idioma: Idioma;
  marca: string;
  dominio: string;
  /* Puede no venir: el layout lo pasa, pero si la consulta falló el chat tiene
     que abrirse igual. Ver `lib/concierge.ts`. */
  quien?: QuienContesta | null;
}) {
  const presenta: QuienContesta = {
    nombre: quien?.nombre?.trim() || marca,
    cargo: quien?.cargo?.trim() || t('concierge_cargo', idioma),
    foto_url: quien?.foto_url ?? null,
  };

  const [abierto, setAbierto] = useState(false);
  const [gancho, setGancho] = useState(false);
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

  /* ── El gancho: el agente se asoma solo, una vez ──────────────────────────
     Una sola vez por navegador, y nunca si ya hay conversación empezada: a
     quien ya escribió no se le ofrece empezar. */
  useEffect(() => {
    const dejarDeVigilar = vigilarElPrimerToque();

    let yaLoVio = false;
    try { yaLoVio = !!localStorage.getItem(YA_SE_ASOMO); } catch { /* da igual */ }
    if (yaLoVio) return dejarDeVigilar;

    let esconder: number | undefined;
    const asomar = window.setTimeout(() => {
      /* Si mientras tanto abrió el chat o ya tenía hilo, no se asoma. */
      setGancho((previo) => {
        if (previo) return previo;
        return true;
      });
      try { localStorage.setItem(YA_SE_ASOMO, '1'); } catch { /* da igual */ }
      /* La campanita puede NO sonar: los navegadores bloquean el audio hasta
         que la persona toque algo. Si no se puede, el gancho aparece igual, en
         silencio. Ver `agente-sonido.ts`. */
      if (sePuedeSonar()) sonar();
      esconder = window.setTimeout(() => setGancho(false), GANCHO_DURA_MS);
    }, GANCHO_ESPERA_MS);

    return () => {
      window.clearTimeout(asomar);
      if (esconder) window.clearTimeout(esconder);
      dejarDeVigilar();
    };
  }, []);

  /* Abrir el chat apaga el gancho, siempre. */
  useEffect(() => {
    if (abierto) setGancho(false);
  }, [abierto]);

  /* Y mientras el chat este abierto, nadie mas le tapa la pantalla: ni la
     ventana de la rifa ni el cupon de salida. Quien esta escribiendole al chat
     ya esta haciendo justo lo que queremos. Ver `no-interrumpir.ts`. */
  useEffect(() => {
    marcarConversacion(abierto);
    return () => marcarConversacion(false);
  }, [abierto]);

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
        /* Llegó algo de una persona de verdad mientras la ventana estaba
           abierta: eso sí merece campanita. */
        if (sePuedeSonar()) sonar();
      }
    } catch { /* la próxima vez */ }
  }, [conversacionId]);

  useEffect(() => {
    if (!abierto || !humano) return;
    const temporizador = setInterval(consultar, 8000);
    return () => clearInterval(temporizador);
  }, [abierto, humano, consultar]);

  function cerrarGancho(evento: React.MouseEvent) {
    evento.stopPropagation();
    setGancho(false);
    try { localStorage.setItem(YA_SE_ASOMO, '1'); } catch { /* da igual */ }
  }

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
      {/* El gancho. Va FUERA del botón: un botón dentro de otro botón no es
          HTML válido y el navegador lo desarma donde menos conviene. */}
      {gancho && !abierto && (
        <div className="agente-gancho" role="status">
          <button type="button" className="agente-gancho-cuerpo" onClick={() => setAbierto(true)}>
            <Cara quien={presenta} tamano={38} />
            <span className="agente-gancho-texto">
              <strong>{presenta.nombre}</strong>
              {t('concierge_gancho', idioma)}
            </span>
          </button>
          <button
            type="button" className="agente-gancho-cerrar" onClick={cerrarGancho}
            aria-label={t('concierge_gancho_no', idioma)}
          >×</button>
        </div>
      )}

      <button
        type="button" className={`concierge-boton${abierto ? ' oculto' : ''}`}
        onClick={() => setAbierto(true)}
        aria-label={`${t('concierge_boton', idioma)} — ${presenta.nombre}, ${presenta.cargo}`}
      >
        <span className="concierge-boton-cara">
          <Cara quien={presenta} tamano={34} />
          <i className="agente-punto" aria-hidden="true" />
        </span>
        <span className="concierge-boton-texto">
          <strong>{t('concierge_boton', idioma)}</strong>
          <small>{presenta.nombre} · {t('concierge_enlinea', idioma)}</small>
        </span>
      </button>

      {abierto && (
        <section className="concierge" aria-label={t('concierge_titulo', idioma)}>
          <header>
            <span className="concierge-boton-cara">
              <Cara quien={presenta} tamano={42} />
              <i className="agente-punto" aria-hidden="true" />
            </span>
            <div className="concierge-quien">
              <strong>{presenta.nombre}</strong>
              {/* ⚠️ El cargo se muestra SIEMPRE. Es la línea que hace que esto
                  sea cálido sin ser un engaño. No se esconde en un tooltip. */}
              <small>{presenta.cargo} · {marca}</small>
            </div>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar">×</button>
          </header>

          <div className="hilo" ref={fondo}>
            <div className="burbuja ellos">{t('concierge_saludo', idioma)}</div>
            {burbujas.map((b, i) => (
              <div key={i} className={`burbuja ${b.de}`}>
                {b.de === 'ellos'
                  ? <Dicho texto={b.texto} dominio={dominio} />
                  : b.texto}
              </div>
            ))}
            {enviando && (
              <div className="agente-escribiendo">
                <Cara quien={presenta} tamano={26} />
                <span className="agente-puntos" aria-hidden="true"><i /><i /><i /></span>
                <span className="agente-escribiendo-texto">
                  {presenta.nombre} {t('concierge_escribiendo', idioma)}…
                </span>
              </div>
            )}
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
