'use client';

import type { RefObject } from 'react';

/**
 * Las tres capas del volcán, en SVG: el fondo lejano, el cono con su lava, y
 * la selva de enfrente. Más el velo y el grano que las funden con el negro.
 *
 * Se comparte entre el hero de la portada y la pantalla de prelanzamiento. El
 * hero le pasa refs para moverlas con el scroll (cada capa a distinta
 * velocidad, que es lo que da profundidad); el teaser no le pasa nada, porque
 * es una sola pantalla quieta.
 */
export function CapasVolcan({
  colorAcento, colorVerde, capas,
}: {
  colorAcento: string;
  colorVerde: string;
  capas?: {
    lejos: RefObject<SVGSVGElement | null>;
    cono: RefObject<SVGSVGElement | null>;
    frente: RefObject<SVGSVGElement | null>;
  };
}) {
  return (
    <>
      <svg className="capa" ref={capas?.lejos} width="2400" height="760" viewBox="0 0 2400 760"
           fill="none" aria-hidden="true" style={{ opacity: .35 }}>
        <path d="M0 760 L560 250 Q600 205 640 250 L1180 760 Z" fill="#0E1A12" />
        <path d="M1120 760 L1620 330 Q1656 292 1692 330 L2400 760 Z" fill="#0C1610" />
      </svg>

      <svg className="capa" ref={capas?.cono} width="2000" height="700" viewBox="0 0 2000 700" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="cono" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1C1C1A" /><stop offset="100%" stopColor="#0B0B0B" />
          </linearGradient>
          <linearGradient id="lava" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorAcento} /><stop offset="100%" stopColor={colorAcento} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M240 700 L900 128 Q1000 44 1100 128 L1760 700 Z" fill="url(#cono)" />
        <path d="M960 96 L1000 62 L1040 96 L1022 140 L978 140 Z" fill="url(#lava)" opacity=".85" />
        <path d="M1000 62 L1016 132 L1048 260 L1030 700 L985 700 L972 250 Z" fill={colorAcento} opacity=".13" />
        <path d="M1000 66 L1010 120 L1028 210" stroke={colorAcento} strokeWidth="3" opacity=".5" fill="none" />
      </svg>

      <svg className="capa" ref={capas?.frente} width="2600" height="330" viewBox="0 0 2600 330" fill="none" aria-hidden="true">
        <path d="M0 330 L0 190 Q300 130 620 178 Q940 226 1300 160 Q1660 94 2000 168 Q2320 236 2600 176 L2600 330 Z" fill="#080808" />
        <g fill={colorVerde} opacity=".18">
          <path d="M180 190 q30 -66 60 0 q-30 26 -60 0" /><path d="M760 172 q34 -74 68 0 q-34 30 -68 0" />
          <path d="M1500 150 q30 -66 60 0 q-30 26 -60 0" /><path d="M2160 176 q34 -74 68 0 q-34 30 -68 0" />
        </g>
      </svg>

      <div className="velo" />
      <div className="grano" />
    </>
  );
}
