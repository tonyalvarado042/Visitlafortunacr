'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/*
 * La ultima ruta que ya se le reporto a Meta.
 *
 * Vive FUERA del componente a proposito. Si fuera un `useRef`, se reiniciaria
 * cada vez que React desmonta y vuelve a montar este arbol —pasa al cambiar de
 * idioma, porque cambia el parametro del layout— y esa vista se perderia sin
 * que nada lo delatara.
 */
let ultimaRuta: string | null = null;

/*
 * El pixel de Meta.
 *
 * POR QUE NO ES SOLO EL SNIPPET PEGADO: el codigo que da Meta cuenta UNA vista
 * y se calla, porque asume un sitio donde cada clic recarga la pagina. Este
 * sitio no recarga: el App Router cambia de ficha sin volver a pedir el
 * documento. Pegado tal cual, Meta solo veria la primera pagina de cada visita
 * —la de entrada— y el recorrido completo quedaria invisible. Peor que no
 * tener pixel, porque los numeros existen y estan mal.
 *
 * COMO SE ARREGLA: el bloque en linea carga la libreria, hace `init` y manda la
 * primera `PageView` (eso es el snippet de Meta, intacto). De ahi en adelante
 * el efecto manda una `PageView` por cada cambio de ruta.
 *
 * ⚠️⚠️ Y VA CON `trackSingle`, NO CON `track`. Esto es lo unico de este archivo
 * que no se puede deducir leyendo nada: **la libreria de Meta descarta los
 * `fbq('track','PageView')` repetidos dentro de un mismo documento.** El
 * segundo y los siguientes no salen al cable. No avisa, no tira error, no
 * aparece en la consola: simplemente no se manda.
 *
 * Medido en produccion con el Resource Timing del navegador, en una pestana
 * limpia y sin espias:
 *
 *   fbq('track','PageView')      2a vez → NO sale
 *   ...con eventID distinto      → NO sale
 *   ...con parametros distintos  → NO sale
 *   fbq('track','ViewContent')   → SI sale   (o sea la libreria funciona)
 *   <img> crudo a facebook.com/tr → SI sale  (o sea la red esta libre)
 *   fbq('trackSingle', id, 'PageView')  → SI sale, SIEMPRE, sin descartar
 *
 * Por eso el consejo que anda por todas partes —«llama a
 * `fbq('track','PageView')` cuando cambie la ruta»— **no funciona**, y falla
 * callado, que es lo peor: uno queda convencido de que mide y mide solo la
 * primera pagina.
 *
 * Si alguien lo "ordena" volviendolo `track`, el sitio sigue sin errores y las
 * campanas se quedan ciegas de nuevo. Antes de tocarlo, repeti la medicion de
 * arriba.
 *
 * ⚠️ `ultimaRuta` es lo que evita contar doble. La primera vista NO se manda
 * desde aca —ya la mando el bloque en linea— y por eso el efecto se limita a
 * anotar la ruta y salir. Esa guarda importa MAS ahora que se usa
 * `trackSingle`: como `trackSingle` no descarta nada, cualquier llamada de mas
 * se cuenta de verdad. No la quites sin sacar tambien el
 * `fbq('track','PageView')` del bloque en linea.
 *
 * Solo mira la ruta, no la query. En este sitio la query son filtros
 * (`?operador=…`), y contar cada filtro como una vista infla el numero.
 */
export function PixelMeta({ id }: { id: string }) {
  const ruta = usePathname();

  useEffect(() => {
    if (ultimaRuta === ruta) return;
    if (ultimaRuta === null) {
      ultimaRuta = ruta;
      return;
    }
    ultimaRuta = ruta;
    /* Medir nunca puede romper el sitio: si `trackSingle` no existiera en una
       version futura de la libreria, se cae al `track` de siempre —que al
       menos manda la primera— en vez de tirar una excepcion dentro de un
       efecto. */
    try {
      window.fbq?.('trackSingle', id, 'PageView');
    } catch {
      try {
        window.fbq?.('track', 'PageView');
      } catch {
        /* sin pixel se vive; con el sitio roto no */
      }
    }
  }, [ruta, id]);

  return (
    <>
      <Script id="pixel-meta" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}');
fbq('track', 'PageView');`}
      </Script>
      {/* Para el que navega con javascript apagado. Es parte del codigo que da
          Meta; sin esto esa visita no existe para ellos. */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
