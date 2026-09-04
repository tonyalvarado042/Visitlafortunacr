'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { t, NOMBRE_PROPIO, IDIOMAS_TEASER, type Idioma } from '@/lib/idiomas';
import { usarCeniza } from '@/lib/ceniza';
import { CapasVolcan } from './CapasVolcan';
import { CuentaRegresiva } from './CuentaRegresiva';
import { MarcaVLF } from './Marca';

type Publico = 'viajero' | 'negocio';

export function Teaser({
  idioma, nombre, marca, sigla, dominio, region, pais, objetivo,
  colorAcento, colorVerde, logoUrl, videoUrl, imagenUrl,
}: {
  idioma: Idioma;
  nombre: string;
  marca: string;
  sigla: string | null;
  dominio: string;
  region: string | null;
  pais: string;
  /** Instante de la apertura en ms, ya resuelto en la zona del destino. */
  objetivo: number | null;
  colorAcento: string;
  colorVerde: string;
  logoUrl: string | null;
  /** dst_destino.video_portada_url. Si está, manda sobre el volcán dibujado. */
  videoUrl: string | null;
  /** dst_destino.imagen_portada_url. Es el cartel del video mientras carga. */
  imagenUrl: string | null;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const [publico, setPublico] = useState<Publico | null>(null);

  /* El fondo es uno de dos: el video del destino, si ya lo cargaron desde el
     panel, o el volcán dibujado, que no necesita ningún archivo. El día que
     entre el video no hay que tocar código: es pegar la URL en Ajustes. */
  const conVideo = Boolean(videoUrl);
  // Con video no se monta el lienzo, y el hook se sale solo al no encontrarlo.
  usarCeniza(lienzo, colorAcento, colorVerde);

  // Al abrir el formulario, el cursor ya queda dentro: un clic menos.
  useEffect(() => { if (publico) campo.current?.focus(); }, [publico]);

  const conNombre = (clave: string) => t(clave, idioma).replace('{destino}', nombre);

  return (
    <div className={conVideo ? 'teaser con-video' : 'teaser'}>
      {conVideo ? (
        <video className="teaser-video" poster={imagenUrl ?? undefined}
               autoPlay muted loop playsInline preload="auto">
          <source src={videoUrl!} />
        </video>
      ) : (
        <>
          <canvas id="cielo" ref={lienzo} />
          <CapasVolcan colorAcento={colorAcento} colorVerde={colorVerde} />
        </>
      )}
      {conVideo && <div className="velo" />}

      <div className="teaser-marco">
        <header className="teaser-barra">
          <span className="teaser-lugar">{[nombre, region, pais].filter(Boolean).join(' · ')}</span>
          <nav className="teaser-idiomas" aria-label="Idioma">
            {IDIOMAS_TEASER.map((i) => (
              <Link key={i} href={`/${i}`} aria-current={i === idioma ? 'page' : undefined}
                    className={i === idioma ? 'activo' : undefined}>
                <abbr title={NOMBRE_PROPIO[i]}>{i.toUpperCase()}</abbr>
              </Link>
            ))}
          </nav>
        </header>

        <main className="teaser-centro">
          <span className="antetitulo">{t('teaser_ritmo', idioma)}</span>

          <MarcaVLF marca={marca} sigla={sigla ?? 'VLF'} dominio={dominio} logoUrl={logoUrl} />

          <h1 className="teaser-titular">{conNombre('teaser_titular')}</h1>
          <p className="teaser-bajada">{t('teaser_bajada', idioma)}</p>

          <div className="teaser-botones">
            <button type="button" className="boton"
                    onClick={() => setPublico('viajero')}
                    aria-expanded={publico === 'viajero'}>
              {t('teaser_acceso', idioma)}
            </button>
            <button type="button" className="boton-linea"
                    onClick={() => setPublico('negocio')}
                    aria-expanded={publico === 'negocio'}>
              {t('teaser_negocio', idioma)}
            </button>
          </div>

          {publico && (
            <Anotarse idioma={idioma} publico={publico} campo={campo}
                      alCerrar={() => setPublico(null)} />
          )}

          <p className="teaser-categorias">{t('teaser_categorias', idioma)}</p>

          <div className="teaser-lanzamiento">
            <span className="rotulo">{t('teaser_pronto', idioma)}</span>
            {objetivo !== null && <CuentaRegresiva objetivo={objetivo} idioma={idioma} />}
          </div>

          <p className="teaser-promesa">{conNombre('teaser_promesa')}</p>
        </main>

        <footer className="teaser-pie">
          © {new Date().getFullYear()} {marca} · {dominio}
        </footer>
      </div>
    </div>
  );
}

/**
 * El formulario. Escribe por la misma puerta que el resto del sitio
 * (/api/solicitud → registrar_solicitud), y lo único que cambia entre un
 * viajero y un negocio es el `origen`: con eso se separan en el CRM sin tocar
 * la base ni los filtros del panel.
 */
function Anotarse({
  idioma, publico, campo, alCerrar,
}: {
  idioma: Idioma;
  publico: Publico;
  campo: React.RefObject<HTMLInputElement | null>;
  alCerrar: () => void;
}) {
  const [contacto, setContacto] = useState('');
  const [trampa, setTrampa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abiertoEn = useRef(Date.now());

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    // Una sola caja para correo o WhatsApp: el arroba decide cuál es cuál.
    const esCorreo = contacto.includes('@');

    try {
      const respuesta = await fetch('/api/solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'consulta_general',
          idioma,
          email: esCorreo ? contacto.trim() : null,
          whatsapp: esCorreo ? null : contacto.replace(/[^\d+]/g, ''),
          origen: publico === 'negocio' ? 'teaser_negocio' : 'teaser_viajero',
          /* El `origen` se guarda en el viajero y NO se pisa si ya existía: un
             negocio que antes se anotó como viajero quedaría mal clasificado.
             El mensaje, en cambio, se escribe en cada solicitud, así que la
             intención de ESTA vez siempre queda registrada. */
          mensaje: publico === 'negocio'
            ? 'Prelanzamiento: quiere sumar su negocio al directorio.'
            : 'Prelanzamiento: pidió acceso anticipado.',
          sitio_web: trampa,
          abierto_en: abiertoEn.current,
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
      <div className="teaser-forma teaser-gracias" role="status">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M4 12.5l5 5 11-11" />
        </svg>
        <p>{t('gracias', idioma)}</p>
      </div>
    );
  }

  return (
    <form className="teaser-forma" onSubmit={enviar}>
      <div className="teaser-forma-cabeza">
        <strong>{t(publico === 'negocio' ? 'teaser_pide_negocio' : 'teaser_pide_viajero', idioma)}</strong>
        <button type="button" className="teaser-cerrar" onClick={alCerrar}>
          {t('teaser_cerrar', idioma)}
        </button>
      </div>

      <div className="teaser-forma-fila">
        <input
          ref={campo}
          type="text"
          inputMode="email"
          autoComplete="email"
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder={t('tu_correo', idioma)}
          aria-label={t('tu_correo', idioma)}
          required
        />
        <button type="submit" className="boton" disabled={enviando || contacto.trim().length < 5}>
          {t('teaser_enviar', idioma)}
        </button>
      </div>

      {/* La trampa: invisible para una persona, irresistible para un robot.
          No lleva display:none porque algunos robots lo detectan. */}
      <div className="trampa" aria-hidden="true">
        <label htmlFor="sitio_web">Sitio web</label>
        <input id="sitio_web" name="sitio_web" type="text" tabIndex={-1} autoComplete="off"
               value={trampa} onChange={(e) => setTrampa(e.target.value)} />
      </div>

      {error && <p className="teaser-error">{error}</p>}
      <p className="teaser-nota">{t('teaser_sin_spam', idioma)}</p>
    </form>
  );
}
