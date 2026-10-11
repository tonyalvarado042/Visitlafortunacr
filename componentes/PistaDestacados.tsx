'use client';

import { useEffect, useRef } from 'react';

/*
 * La pista de destacados, andando sola.
 *
 * Por qué mover el scroll y no animar un `transform`, que sería más barato y
 * sin JavaScript: un transform le quita el dedo al visitante. En teléfono la
 * fila se arrastra, y si el premium de alguien pasa de largo tiene que poder
 * traerlo de vuelta — es lo que se está vendiendo. Moviendo `scrollLeft` el
 * arrastre nativo sigue funcionando y la animación es solo una ayuda.
 *
 * El bucle no da saltos porque las tarjetas vienen DOS veces desde el
 * servidor, en UNA sola lista (ver FilaDestacados). Al pasar la distancia
 * entre una tarjeta y su copia se le resta esa distancia al scroll: en ese
 * punto el píxel de salida y el de llegada son idénticos, así que el ojo no
 * ve nada.
 *
 * Se detiene con el puntero encima, con el foco adentro, mientras alguien la
 * arrastra, cuando no se ve en pantalla y si el sistema pide menos
 * movimiento. Una fila que no para es una fila que no se puede leer.
 */

/** Píxeles por segundo. Lento a propósito: tiene que leerse, no desfilar. */
const VELOCIDAD = 26;

/** Lo que espera después de que alguien la toca, antes de seguir sola. */
const ESPERA_TRAS_TOCAR = 3500;

export function PistaDestacados({ children }: { children: React.ReactNode }) {
  const pista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const caja = pista.current;
    if (!caja) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lista = caja.firstElementChild as HTMLElement | null;
    const tarjetas = lista?.children;
    /* Hacen falta al menos dos tarjetas y su copia: con una sola no hay
       vuelta que dar. */
    if (!tarjetas || tarjetas.length < 2) return;
    const mitad = tarjetas.length / 2;
    if (!Number.isInteger(mitad) || mitad < 1) return;

    let cuadro = 0;
    let anterior = 0;
    /* Fracciones de píxel acumuladas: a 26 px/s cada cuadro avanza 0.43px y
       scrollLeft redondea. Sin esto la fila no se movería nunca. */
    let sobrante = 0;
    let detenidoHasta = 0;
    let conPuntero = false;
    let aLaVista = false;

    /* La vuelta se mide de la primera tarjeta a su copia, NO con
       scrollWidth/2: el relleno de la pista entra en scrollWidth y dejaría la
       mitad corrida unos píxeles. Esa diferencia se suma vuelta tras vuelta
       hasta que el salto se ve. */
    let vuelta = 0;
    const medir = () => {
      vuelta = (tarjetas[mitad] as HTMLElement).offsetLeft
             - (tarjetas[0] as HTMLElement).offsetLeft;
    };
    medir();

    /* Las fotos llegan tarde y cambian el ancho: si no se vuelve a medir,
       la vuelta se calculó con tarjetas vacías y el bucle salta. */
    const observador = new ResizeObserver(medir);
    observador.observe(lista);

    const andando = () =>
      aLaVista && !conPuntero && vuelta > 0
      && Date.now() >= detenidoHasta
      && document.visibilityState === 'visible';

    const paso = (ahora: number) => {
      cuadro = requestAnimationFrame(paso);
      const dt = anterior ? Math.min(ahora - anterior, 100) : 0;
      anterior = ahora;
      if (dt === 0 || !andando()) return;

      sobrante += (VELOCIDAD * dt) / 1000;
      const avance = Math.floor(sobrante);
      if (avance < 1) return;
      sobrante -= avance;

      const nuevo = caja.scrollLeft + avance;
      caja.scrollLeft = nuevo >= vuelta ? nuevo - vuelta : nuevo;
    };

    /* Si el visitante la arrastra hacia atrás más allá del principio, se la
       manda a la copia: así el arrastre tampoco tiene tope. */
    const alRodar = () => {
      if (vuelta > 0 && caja.scrollLeft < 1) caja.scrollLeft += vuelta;
    };

    const entra = () => { conPuntero = true; };
    const sale = () => { conPuntero = false; };
    const tocaron = () => { detenidoHasta = Date.now() + ESPERA_TRAS_TOCAR; };

    const mirón = new IntersectionObserver(
      ([e]) => { aLaVista = e.isIntersecting; },
      { threshold: 0.15 },
    );
    mirón.observe(caja);

    caja.addEventListener('pointerenter', entra);
    caja.addEventListener('pointerleave', sale);
    caja.addEventListener('focusin', entra);
    caja.addEventListener('focusout', sale);
    caja.addEventListener('pointerdown', tocaron);
    caja.addEventListener('touchstart', tocaron, { passive: true });
    caja.addEventListener('wheel', tocaron, { passive: true });
    caja.addEventListener('scroll', alRodar, { passive: true });

    cuadro = requestAnimationFrame(paso);

    return () => {
      cancelAnimationFrame(cuadro);
      mirón.disconnect();
      observador.disconnect();
      caja.removeEventListener('pointerenter', entra);
      caja.removeEventListener('pointerleave', sale);
      caja.removeEventListener('focusin', entra);
      caja.removeEventListener('focusout', sale);
      caja.removeEventListener('pointerdown', tocaron);
      caja.removeEventListener('touchstart', tocaron);
      caja.removeEventListener('wheel', tocaron);
      caja.removeEventListener('scroll', alRodar);
    };
  }, []);

  return (
    <div className="destacados-pista" ref={pista}>
      <ul className="destacados-tren">{children}</ul>
    </div>
  );
}
