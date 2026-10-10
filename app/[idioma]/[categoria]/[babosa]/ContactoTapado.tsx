'use client';

import { useActionState, useEffect, useState } from 'react';
import { verContacto, type EstadoContacto } from './acciones';
import type { ContactoTapado as Tapado } from '@/lib/contacto-tapado';
import { t, type Idioma } from '@/lib/idiomas';

const NADA: EstadoContacto = {};

/**
 * El contacto tapado, y cómo se destapa.
 *
 * Lo que llega del servidor es solo la pista ("+506 2479 ••••"). El número
 * entero aparece recién cuando la acción lo devuelve. Si viniera en el HTML
 * tapado con CSS, el muro se saltaría con ver-código.
 *
 * Quien ya lo desbloqueó una vez no vuelve a pedirlo: queda anotado en el
 * navegador. Pedirle los datos tres veces a la misma persona es castigarla
 * por volver.
 */
export function ContactoTapado({
  negocioId, idioma, tapado, comoLlegar, textoComoLlegar,
}: {
  negocioId: string;
  idioma: Idioma;
  tapado: Tapado;
  comoLlegar: string;
  textoComoLlegar: string;
}) {
  const [estado, accion, pendiente] = useActionState(verContacto, NADA);
  const [abierto, setAbierto] = useState(false);
  const [yaLoVio, setYaLoVio] = useState(false);

  const llave = `vlf_contacto_${negocioId}`;

  useEffect(() => {
    try {
      if (window.localStorage.getItem(llave) === '1') setYaLoVio(true);
    } catch {
      /* Navegador en privado o con el almacenamiento bloqueado: no pasa nada,
         simplemente vuelve a pedirlo. */
    }
  }, [llave]);

  useEffect(() => {
    if (!estado.contacto) return;
    try { window.localStorage.setItem(llave, '1'); } catch { /* ídem */ }
  }, [estado.contacto, llave]);

  const real = estado.contacto;

  /* Ya se destapó: en esta visita o en una anterior. En el segundo caso hay
     que volver a pedirlo al servidor, así que se muestra el botón pero sin
     el formulario — un clic y listo. */
  if (real) {
    return (
      <>
        {real.telefono && (
          <a className="linea-contacto" href={`tel:${real.telefono}`}>
            <span className="dato">{real.telefono}</span>
            <span className="que">{t('llamar', idioma)}</span>
          </a>
        )}
        {real.telefono_whatsapp && (
          <a className="linea-contacto" target="_blank" rel="noopener noreferrer"
             href={`https://wa.me/${real.telefono_whatsapp.replace(/\D/g, '')}`}>
            <span className="dato">{real.telefono_whatsapp}</span>
            <span className="que">WhatsApp</span>
          </a>
        )}
        {real.sitio_web && (
          <a className="linea-contacto" href={real.sitio_web} target="_blank" rel="noopener noreferrer">
            <span className="dato" style={{ wordBreak: 'break-all' }}>
              {real.sitio_web.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </span>
            <span className="que">{t('sitio_web', idioma)}</span>
          </a>
        )}
        {real.email && (
          <a className="linea-contacto" href={`mailto:${real.email}`}>
            <span className="dato" style={{ wordBreak: 'break-all', fontSize: 14 }}>{real.email}</span>
          </a>
        )}

        <a className="boton" href={comoLlegar} target="_blank" rel="noopener noreferrer"
           style={{ display: 'block', marginTop: 18, padding: 13 }}>
          {textoComoLlegar}
        </a>
      </>
    );
  }

  return (
    <>
      <div className="contacto-tapado" aria-hidden="true">
        {tapado.telefono && (
          <div className="linea-contacto">
            <span className="dato borroso">{tapado.telefono}</span>
            <span className="que">{t('llamar', idioma)}</span>
          </div>
        )}
        {tapado.whatsapp && (
          <div className="linea-contacto">
            <span className="dato borroso">{tapado.whatsapp}</span>
            <span className="que">WhatsApp</span>
          </div>
        )}
        {tapado.sitio && (
          <div className="linea-contacto">
            <span className="dato borroso" style={{ wordBreak: 'break-all' }}>{tapado.sitio}</span>
            <span className="que">{t('sitio_web', idioma)}</span>
          </div>
        )}
      </div>

      {!abierto ? (
        <button type="button" className="boton boton-destapar" onClick={() => setAbierto(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.3" strokeLinecap="round" aria-hidden="true">
            <rect x="4" y="10.5" width="16" height="10" rx="2" />
            <path d="M8 10.5V7a4 4 0 0 1 8 0" />
          </svg>
          {t('ver_contacto', idioma)}
        </button>
      ) : (
        <form action={accion} className="forma forma-destapar">
          <input type="hidden" name="negocio_id" value={negocioId} />
          <input type="hidden" name="idioma" value={idioma} />

          <p className="destapar-por-que">
            {yaLoVio ? t('ver_contacto_de_nuevo', idioma) : t('ver_contacto_por_que', idioma)}
          </p>

          <label>
            <span>{t('ver_contacto_nombre', idioma)}</span>
            <input name="nombre" type="text" autoComplete="name" required />
          </label>
          <label>
            <span>{t('ver_contacto_correo', idioma)}</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            <span>{t('ver_contacto_whatsapp', idioma)}</span>
            <input name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+506…" />
          </label>

          {estado.error && <p className="forma-error">{estado.error}</p>}

          <button type="submit" className="boton" disabled={pendiente}>
            {pendiente ? t('ver_contacto_abriendo', idioma) : t('ver_contacto_mostrar', idioma)}
          </button>
          <small className="destapar-letra-chica">{t('ver_contacto_aviso', idioma)}</small>
        </form>
      )}

      <a className="boton-linea" href={comoLlegar} target="_blank" rel="noopener noreferrer"
         style={{ display: 'block', textAlign: 'center', marginTop: 14, padding: 12 }}>
        {textoComoLlegar}
      </a>
    </>
  );
}
