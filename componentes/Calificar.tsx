'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconoVolcan } from './Volcanes';
import { t, type Idioma } from '@/lib/idiomas';

/*
 * Calificar y contar por qué. El gesto es el de siempre: se tocan los
 * volcanes y se abre el modal con esa nota ya puesta, porque quien acaba de
 * calificar está a un segundo de escribir y a diez de arrepentirse.
 *
 * Escribe por /api/resena, que llama a registrar_resena. Desde aquí no se
 * toca ninguna tabla: el sitio público no tiene INSERT sobre nada.
 */

const MINIMO = 40;

export function Calificar({
  negocioId,
  negocioNombre,
  idioma,
  compacto = false,
}: {
  negocioId: string;
  negocioNombre: string;
  idioma: Idioma;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [nota, setNota] = useState(0);
  const [sobre, setSobre] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<'publicada' | 'pendiente' | null>(null);
  const [cuerpo, setCuerpo] = useState('');
  const dialogo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', tecla);
    // El foco entra al modal; si no, quien navega con teclado se queda atrás.
    dialogo.current?.querySelector('textarea')?.focus();
    return () => window.removeEventListener('keydown', tecla);
  }, [abierto]);

  function elegir(valor: number) {
    setNota(valor);
    setListo(null);
    setError(null);
    setAbierto(true);
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    const datos = new FormData(evento.currentTarget);

    // Trampa para robots: el campo está oculto, una persona nunca lo llena.
    if (String(datos.get('sitio') ?? '')) { setAbierto(false); return; }

    setEnviando(true);
    setError(null);
    try {
      const r = await fetch('/api/resena', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          negocio_id:   negocioId,
          calificacion: nota,
          cuerpo:       String(datos.get('cuerpo') ?? ''),
          titulo:       String(datos.get('titulo') ?? ''),
          nombre:       String(datos.get('nombre') ?? ''),
          email:        String(datos.get('email') ?? ''),
          visitado_el:  String(datos.get('visitado_el') ?? '') || null,
          idioma,
        }),
      });
      const respuesta = await r.json();
      if (!r.ok) throw new Error(respuesta.error ?? 'error');
      setListo(respuesta.visible ? 'publicada' : 'pendiente');
      setCuerpo('');
      if (respuesta.visible) router.refresh();
    } catch (fallo) {
      setError(fallo instanceof Error && fallo.message !== 'error' ? fallo.message : t('resena_error', idioma));
    } finally {
      setEnviando(false);
    }
  }

  const faltan = Math.max(0, MINIMO - cuerpo.trim().length);

  return (
    <div className={`calificar${compacto ? ' compacto' : ''}`}>
      <div className="pregunta">{t('tu_calificacion', idioma)}</div>
      <div className="volcanes-elegir" onMouseLeave={() => setSobre(0)}>
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            className={v <= (sobre || nota) ? 'on' : ''}
            onMouseEnter={() => setSobre(v)}
            onFocus={() => setSobre(v)}
            onBlur={() => setSobre(0)}
            onClick={() => elegir(v)}
            aria-label={`${t('calificar_con', idioma)} ${v}/5`}
          >
            <IconoVolcan tamano={compacto ? 20 : 28} />
          </button>
        ))}
      </div>

      {abierto && (
        <div className="modal-fondo" onClick={(e) => { if (e.target === e.currentTarget) setAbierto(false); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label={t('escribi_resena', idioma)} ref={dialogo}>
            <header>
              <div>
                <strong>{t('escribi_resena', idioma)}</strong>
                <small>{negocioNombre}</small>
              </div>
              <button type="button" onClick={() => setAbierto(false)} aria-label={t('cerrar', idioma)}>×</button>
            </header>

            {listo ? (
              <div className="gracias">
                <div className="volcanes-vistos">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <span key={v} className={v <= nota ? 'on' : ''}><IconoVolcan tamano={24} /></span>
                  ))}
                </div>
                <p>{t(listo === 'publicada' ? 'resena_gracias' : 'resena_en_revision', idioma)}</p>
                <button type="button" className="boton" onClick={() => setAbierto(false)}>{t('cerrar', idioma)}</button>
              </div>
            ) : (
              <form onSubmit={enviar}>
                <div className="volcanes-elegir" onMouseLeave={() => setSobre(0)}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={v <= (sobre || nota) ? 'on' : ''}
                      onMouseEnter={() => setSobre(v)}
                      onClick={() => setNota(v)}
                      aria-label={`${t('calificar_con', idioma)} ${v}/5`}
                    >
                      <IconoVolcan tamano={26} />
                    </button>
                  ))}
                </div>

                <label>
                  <span>{t('contanos', idioma)}</span>
                  <textarea
                    name="cuerpo" rows={5} required maxLength={4000}
                    value={cuerpo} onChange={(e) => setCuerpo(e.target.value)}
                    placeholder={t('contanos_pista', idioma)}
                  />
                  <small className={faltan ? 'falta' : ''}>
                    {faltan ? `${t('faltan', idioma)} ${faltan}` : t('asi_esta_bien', idioma)}
                  </small>
                </label>

                <label>
                  <span>{t('titulo_opcional', idioma)}</span>
                  <input type="text" name="titulo" maxLength={120} />
                </label>

                <div className="par">
                  <label>
                    <span>{t('tu_nombre', idioma)}</span>
                    <input type="text" name="nombre" required maxLength={80} autoComplete="name" />
                  </label>
                  <label>
                    <span>{t('cuando_fuiste', idioma)}</span>
                    <input type="date" name="visitado_el" max={new Date().toISOString().slice(0, 10)} />
                  </label>
                </div>

                <label>
                  <span>{t('tu_email', idioma)}</span>
                  <input type="email" name="email" required maxLength={160} autoComplete="email" />
                  <small>{t('email_privado', idioma)}</small>
                </label>

                <input type="text" name="sitio" tabIndex={-1} autoComplete="off" aria-hidden="true" className="trampa" />

                {error && <p className="error">{error}</p>}

                <button type="submit" className="boton" disabled={enviando || faltan > 0 || nota < 1}>
                  {enviando ? '···' : t('publicar_resena', idioma)}
                </button>
                <p className="nota-legal">{t('una_por_persona', idioma)}</p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
