'use client';

import { useEffect, useRef, useState } from 'react';

/* La banda de video que separa el hero del contenido. La fuente sale de
   dst_destino.video_portada_url: el código no trae el video de ningún destino,
   igual que no trae sus colores. Si el destino no tiene video, no hay banda. */

const REPRODUCIBLES = ['.mp4', '.webm', '.mov', '.m4v'];

export function VideoPortada({ url, poster }: { url: string; poster?: string | null }) {
  const video = useRef<HTMLVideoElement>(null);
  // Sin animación, el video no arranca solo: se le dan controles y decide quien mira.
  const [quietud, setQuietud] = useState(false);

  useEffect(() => {
    const nodo = video.current;
    if (!nodo) return;

    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setQuietud(sinMovimiento);
    if (sinMovimiento) return;

    /* Con preload="none" los megas no se descargan hasta que la banda llega a
       la pantalla: quien no baja del hero no paga nada. Y al salir de vista se
       pausa, que no tiene sentido gastar batería en un video que nadie ve. */
    const mirador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          // play() devuelve una promesa que el navegador rechaza cuando hay
          // ahorro de datos: si se ignora, la consola se llena de errores.
          if (e.isIntersecting) nodo.play().catch(() => {});
          else nodo.pause();
        }
      },
      { threshold: 0.25 },
    );
    mirador.observe(nodo);
    return () => mirador.disconnect();
  }, []);

  const ruta = url.split('?')[0].toLowerCase();
  if (!REPRODUCIBLES.some((e) => ruta.endsWith(e))) return null;

  return (
    <section className="zona banda-video revela">
      <video
        ref={video}
        src={url}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        preload="none"
        controls={quietud}
        aria-label=""
      />
    </section>
  );
}
