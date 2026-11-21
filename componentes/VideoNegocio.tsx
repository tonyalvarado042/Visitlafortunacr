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
 * La MINIATURA del video, en la columna de la derecha y arriba del contacto.
 *
 * Antes era un botón de texto en la cabecera. Tony, 21 de noviembre de 2026:
 * *«quitá el botón, no me gusta la forma; agregá un thumbnail con play
 * arriba de datos de contacto y que al tocar lleve al video»*. Tiene razón y
 * la razón es vieja: **un botón promete, una miniatura muestra.** El que ve
 * un fotograma del lugar ya sabe qué le van a enseñar; el que lee «Ver el
 * video» tiene que decidir a ciegas.
 *
 * ⚠️ DE DÓNDE SALE LA IMAGEN, en este orden y sin inventar ninguna:
 *   1. `video_portada_url`, si el negocio subió una.
 *   2. El fotograma de YouTube (`i.ytimg.com`), que es EL video, no una foto
 *      parecida. Es el caso real de hoy: Jalapas tiene YouTube y no tiene
 *      portada propia.
 *   3. La foto de portada del negocio. Ya no es el video, pero es el lugar.
 *   4. Nada: queda el disco sobre fondo oscuro. Antes de poner una foto de
 *      otra cosa, mejor ninguna.
 *
 * Vimeo cae en 3 a propósito: su miniatura pide una llamada a su API y no
 * vale una petición por ficha para una portada.
 */
export function MiniaturaVideo({
  url, portada, respaldo, idioma,
}: {
  url: string;
  /** La portada que subió el negocio, si hay. */
  portada: string | null;
  /** La foto de portada del negocio, de último recurso. */
  respaldo: string | null;
  idioma: Idioma;
}) {
  const limpia = url.trim();
  /* Solo http y https, igual que el reproductor: si la dirección no sirve
     para el video, tampoco se pinta una miniatura que lleva a un hueco. */
  if (!/^https?:\/\//i.test(limpia)) return null;

  const yt = deYoutube(limpia);
  /* `hqdefault` y no `maxresdefault`: maxres NO existe para todos los videos
     —YouTube solo la genera si la fuente era bastante grande— y cuando no
     existe devuelve una imagen gris de 120x90. Una miniatura rota en la
     ficha de alguien que pagó el plan premium. hqdefault existe siempre.
     Viene en 4:3 con franjas negras; el recorte a 16:9 del CSS se las come. */
  const imagen = portada ?? (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null) ?? respaldo;

  return (
    <a href="#video" className="mini-video">
      {imagen
        /* eslint-disable-next-line @next/next/no-img-element */
        ? <img src={imagen} alt="" loading="lazy" />
        : <span className="mini-video-sinfoto" aria-hidden="true" />}
      <span className="mini-video-play" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </span>
      {/* El texto es lo que le da nombre al enlace. La foto va con alt vacío
          porque es decoración: quien no la ve necesita saber que esto lleva
          al video, no cómo se ve el comedor. */}
      <span className="mini-video-pie">{t('ver_video', idioma)}</span>
    </a>
  );
}
