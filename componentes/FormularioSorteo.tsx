'use client';

import { useState } from 'react';
import { t, type Idioma } from '@/lib/idiomas';
import type { Sorteo } from '@/lib/sorteo';

/*
 * El formulario de la rifa. El mismo en el aviso emergente y en la pagina:
 * si fueran dos, el dia que cambie un campo cambia en uno solo.
 *
 * Tres campos y ni uno mas. Cada campo que se agrega cuesta participantes, y
 * lo unico que de verdad hace falta para sortear y avisar es el nombre y el
 * correo. El WhatsApp va aparte y opcional —se decide desde el panel— porque
 * sube mucho la probabilidad de poder avisarle al ganador meses despues,
 * cuando el correo ya se enfrio, pero no vale perder gente por pedirlo.
 */

export function FormularioSorteo({
  sorteo, idioma, origen, onListo,
}: {
  sorteo: Sorteo;
  idioma: Idioma;
  origen: 'aviso' | 'pagina';
  /** El aviso lo usa para cerrarse solo un rato despues de apuntarse. */
  onListo?: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<'nuevo' | 'ya_estaba' | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch('/api/sorteo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre, email, whatsapp, idioma, origen, acepta,
          pagina: typeof location !== 'undefined' ? location.pathname : null,
        }),
      });
      const datos = await r.json();
      if (!r.ok) {
        setError(datos?.error ?? t('sorteo_error', idioma));
        return;
      }
      setListo(datos.ya_estaba ? 'ya_estaba' : 'nuevo');
      /* Se recuerda que esta persona ya participo para no volver a
         interrumpirla en ninguna pagina. Si el navegador no deja escribir
         —modo privado, almacenamiento bloqueado— no pasa nada: lo peor es
         que el aviso vuelva a salir, no que se rompa. */
      try { localStorage.setItem('vlf_sorteo_hecho', sorteo.id); } catch { /* da igual */ }
      onListo?.();
    } catch {
      setError(t('sorteo_error', idioma));
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="sorteo-listo" role="status">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="m8.5 12.5 2.5 2.5 4.5-5" />
        </svg>
        <strong>
          {listo === 'ya_estaba' ? t('sorteo_ya_estabas', idioma) : t('sorteo_adentro', idioma)}
        </strong>
        <p>{t('sorteo_te_avisamos', idioma)}</p>
      </div>
    );
  }

  return (
    <form className="sorteo-forma forma" onSubmit={enviar} noValidate>
      <div className="campo">
        <label htmlFor={`sn-${origen}`}>{t('sorteo_nombre', idioma)}</label>
        <input id={`sn-${origen}`} name="nombre" autoComplete="name" required
               value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>

      <div className="campo">
        <label htmlFor={`se-${origen}`}>{t('sorteo_correo', idioma)}</label>
        <input id={`se-${origen}`} name="email" type="email" autoComplete="email" required
               inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      {sorteo.pide_whatsapp && (
        <div className="campo">
          <label htmlFor={`sw-${origen}`}>
            {t('sorteo_whatsapp', idioma)}
            {!sorteo.whatsapp_obligatorio && <span className="opcional">{t('opcional', idioma)}</span>}
          </label>
          <input id={`sw-${origen}`} name="whatsapp" type="tel" autoComplete="tel"
                 inputMode="tel" placeholder="+506…"
                 required={sorteo.whatsapp_obligatorio}
                 value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <small>{t('sorteo_whatsapp_por_que', idioma)}</small>
        </div>
      )}

      <label className="sorteo-acepto">
        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} required />
        <span>
          {t('sorteo_acepto', idioma)}{' '}
          <a href={`/${idioma}/${sorteo.babosa}#bases`}>{t('sorteo_bases', idioma)}</a>.
        </span>
      </label>

      {error && <p className="sorteo-error" role="alert">{error}</p>}

      <button className="boton" type="submit" disabled={enviando || !acepta}>
        {enviando ? t('sorteo_enviando', idioma) : t('sorteo_participar', idioma)}
      </button>
      <small className="sorteo-letra">{t('sorteo_gratis', idioma)}</small>
    </form>
  );
}
