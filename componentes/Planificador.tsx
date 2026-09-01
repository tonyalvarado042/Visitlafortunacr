'use client';

import { useState } from 'react';
import { t, type Idioma } from '@/lib/idiomas';

const CON_QUIEN = [
  { valor: 'pareja',  clave: 'pareja'  },
  { valor: 'familia', clave: 'familia' },
  { valor: 'amigos',  clave: 'amigos'  },
  { valor: 'solo',    clave: 'solo'    },
] as const;

export function Planificador({
  idioma, intereses,
}: {
  idioma: Idioma;
  intereses: { babosa: string; nombre: string }[];
}) {
  const [llegaEl, setLlegaEl] = useState('');
  const [conQuien, setConQuien] = useState<string>('');
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [contacto, setContacto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternar(babosa: string) {
    setElegidos((previos) =>
      previos.includes(babosa) ? previos.filter((x) => x !== babosa) : [...previos, babosa]
    );
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    // Una sola caja para correo o WhatsApp: pedir los dos espanta, y con uno
    // basta para responder. El signo decide cuál es cuál.
    const esCorreo = contacto.includes('@');

    try {
      const respuesta = await fetch('/api/solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'itinerario',
          idioma,
          email: esCorreo ? contacto.trim() : null,
          whatsapp: esCorreo ? null : contacto.replace(/[^\d+]/g, ''),
          llega_el: llegaEl || null,
          tipo_viajero: conQuien || null,
          intereses: elegidos,
        }),
      });

      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error ?? 'No se pudo enviar.');
      setListo(true);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo enviar.');
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="bloque" style={{ textAlign: 'center', padding: '46px 26px' }}>
        <div style={{ fontSize: 40, marginBottom: 10, color: 'var(--verde)' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5 5.5-5.5" />
          </svg>
        </div>
        <h3>{t('gracias', idioma)}</h3>
      </div>
    );
  }

  return (
    <form className="bloque" onSubmit={enviar}>
      <div className="titulo">{t('armar_viaje', idioma)}</div>

      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--humo)', marginBottom: 7 }}>
        {t('cuando_llegas', idioma)}
      </label>
      <input
        type="date" value={llegaEl} onChange={(e) => setLlegaEl(e.target.value)}
        min={new Date().toISOString().slice(0, 10)}
        style={campo}
      />

      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--humo)', margin: '16px 0 7px' }}>
        {t('con_quien', idioma)}
      </label>
      <div style={fila}>
        {CON_QUIEN.map(({ valor, clave }) => (
          <button key={valor} type="button" onClick={() => setConQuien(valor)}
                  style={chip(conQuien === valor)}>
            {t(clave, idioma)}
          </button>
        ))}
      </div>

      {intereses.length > 0 && (
        <>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--humo)', margin: '16px 0 7px' }}>
            {t('que_te_mueve', idioma)}
          </label>
          <div style={fila}>
            {intereses.map((i) => (
              <button key={i.babosa} type="button" onClick={() => alternar(i.babosa)}
                      style={chip(elegidos.includes(i.babosa))}>
                {i.nombre}
              </button>
            ))}
          </div>
        </>
      )}

      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--humo)', margin: '16px 0 7px' }}>
        {t('tu_correo', idioma)}
      </label>
      <input
        type="text" required value={contacto} onChange={(e) => setContacto(e.target.value)}
        placeholder="hola@correo.com  ·  +506 8888 8888" style={campo}
      />

      <button className="boton" type="submit" disabled={enviando || contacto.trim().length < 5}
              style={{ width: '100%', padding: 15, fontSize: 14, marginTop: 18 }}>
        {enviando ? '…' : t('ver_itinerario', idioma)}
      </button>

      {error && <p style={{ color: '#E2795A', fontSize: 13, margin: '10px 0 0', textAlign: 'center' }}>{error}</p>}
      <p style={{ fontSize: 11.5, color: '#6E6C68', margin: '12px 0 0', textAlign: 'center' }}>
        {t('sin_costo', idioma)}
      </p>
    </form>
  );
}

const campo: React.CSSProperties = {
  width: '100%', background: '#151515', border: '1px solid #262626', borderRadius: 3,
  padding: '12px 14px', fontSize: 14.5, fontWeight: 600, color: '#FFFFFF',
  fontFamily: 'inherit', colorScheme: 'dark',
};

const fila: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 7 };

const chip = (activo: boolean): React.CSSProperties => ({
  padding: '8px 13px', borderRadius: 100, fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
  background: activo ? 'var(--verde)' : 'transparent',
  borderWidth: 1, borderStyle: 'solid',
  borderColor: activo ? 'var(--verde)' : '#2C2C2C',
  color: activo ? '#0B0B0B' : '#B5B3AF',
});
