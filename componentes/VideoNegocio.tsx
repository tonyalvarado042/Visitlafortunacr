import { t, type Idioma } from '@/lib/idiomas';

/*
 * El video de la ficha: lo que se vende en el plan premium.
 *
 * Va DEBAJO de las fotos y no arriba, a propósito. Quien llega a una ficha
 * primero mira fotos y lee; el video es lo que lo termina de convencer, no lo
 * que lo recibe. Pero arriba hay un botón que baja hasta acá, para el que
 * entró justamente a ver el video.
 *
 * Acepta dos formas: un archivo del bucket y un enlace de YouTube o Vimeo.
 * Es a propósito — el primer video se filma y se sube, pero un negocio puede
 * llegar con el suyo ya en YouTube y no hay razón para rechazarlo.
 */

/** El id del video si la dirección es de YouTube, o null. */
function deYoutube(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/);
  return m ? m[1] : null;
}

/** El id si es de Vimeo, o null. */
function deVimeo(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d{6,12})/);
  return m ? m[1] : null;
}

export function VideoNegocio({
  url, portada, nombre, idioma,
}: {
  url: string;
  portada: string | null;
  nombre: string;
  idioma: Idioma;
}) {
  const limpia = url.trim();
  /* Solo http y https. Un javascript: acá sería un agujero en cada ficha. */
  if (!/^https?:\/\//i.test(limpia)) return null;

  const yt = deYoutube(limpia);
  const vi = deVimeo(limpia);

  return (
    <section className="video-negocio" id="video">
      <div className="video-rotulo">
        <span className="video-sello">{t('video_sello', idioma)}</span>
        <h2>{t('video_titulo', idioma).replace('{negocio}', nombre)}</h2>
      </div>

      <div className="video-marco">
        {yt ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0`}
            title={nombre}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : vi ? (
          <iframe
            src={`https://player.vimeo.com/video/${vi}`}
            title={nombre}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          /* Un archivo nuestro. Sin autoplay: un video que arranca solo con
             sonido en el teléfono de alguien es la forma más rápida de que
             cierren la pestaña. */
          <video
            controls
            preload="none"
            playsInline
            poster={portada ?? undefined}
            src={limpia}
          />
        )}
      </div>
    </section>
  );
}

/**
 * El botón de arriba, para el que entró a ver el video.
 *
 * ⚠️ EL TRIÁNGULO VA ADENTRO DE UN CÍRCULO, y eso es lo que lo hace legible.
 * Tony, 21 de noviembre de 2026: *«no se ve como botón de video»*. Tenía
 * razón: un triangulito suelto al lado de un texto es un adorno; el
 * triángulo dentro de un disco es el símbolo de reproducir que todo el mundo
 * ya conoce de YouTube para abajo. No hace falta explicarlo.
 *
 * Y el disco es lo ÚNICO naranja. Antes el botón entero era naranja sólido,
 * igual que «Armar mi viaje» y «Ver los datos de contacto» — las dos
 * acciones que dan plata. Tres botones del mismo color es ninguno
 * destacado: el video es un extra, no la acción principal de la ficha.
 */
export function BotonVerVideo({ idioma }: { idioma: Idioma }) {
  return (
    <a href="#video" className="boton-ver-video">
      <span className="bvv-play" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </span>
      {t('ver_video', idioma)}
    </a>
  );
}
