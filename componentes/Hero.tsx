'use client';

import { useEffect, useRef } from 'react';
import { t, type Idioma } from '@/lib/idiomas';
import { usarCeniza } from '@/lib/ceniza';
import { CapasVolcan } from './CapasVolcan';

export function Hero({
  idioma, nombre, region, pais, lema, colorAcento, colorVerde,
}: {
  idioma: Idioma;
  nombre: string;
  region: string | null;
  pais: string;
  lema: string | null;
  colorAcento: string;
  colorVerde: string;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const titular = useRef<HTMLDivElement>(null);
  const bajar = useRef<HTMLDivElement>(null);
  const c1 = useRef<SVGSVGElement>(null);
  const c2 = useRef<SVGSVGElement>(null);
  const c3 = useRef<SVGSVGElement>(null);

  usarCeniza(lienzo, colorAcento, colorVerde);

  useEffect(() => {
    /* El titular sube y se desvanece mientras el volcán se acerca. Cada capa
       se mueve distinto: el frente más que el fondo, que es lo que da la
       sensación de profundidad. */
    const barra = document.getElementById('barra');
    function alScroll() {
      const y = window.scrollY;
      const largo = (pista.current?.offsetHeight ?? 1) - window.innerHeight;
      const p = Math.min(Math.max(y / largo, 0), 1);

      if (titular.current) {
        titular.current.style.transform = `translateY(${-p * 130}px) scale(${1 - p * 0.1})`;
        titular.current.style.opacity = String(Math.max(1 - p * 1.7, 0));
      }
      if (bajar.current) bajar.current.style.opacity = String(Math.max(1 - p * 3.4, 0));
      if (c1.current) c1.current.style.transform = `translateX(-50%) translateY(${p * 90}px) scale(${1 + p * 0.16})`;
      if (c2.current) c2.current.style.transform = `translateX(-50%) translateY(${p * 34}px) scale(${1 + p * 0.09})`;
      if (c3.current) c3.current.style.transform = `translateX(-50%) translateY(${p * 12}px) scale(${1 + p * 0.04})`;

      barra?.classList.toggle('pegada', y > 80);
      barra?.classList.toggle('sobre-hero', y <= 80);
    }

    alScroll();
    window.addEventListener('scroll', alScroll, { passive: true });

    /* Las secciones entran al aparecer */
    const mirador = new IntersectionObserver((entradas) => {
      entradas.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add('visible'), i * 70);
          mirador.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.revela').forEach((el) => mirador.observe(el));

    return () => {
      window.removeEventListener('scroll', alScroll);
      mirador.disconnect();
      barra?.classList.remove('sobre-hero', 'pegada');
    };
  }, []);

  return (
    <div className="pista" ref={pista}>
      <div className="escena">
        <canvas id="cielo" ref={lienzo} />

        <CapasVolcan colorAcento={colorAcento} colorVerde={colorVerde}
                     capas={{ lejos: c3, cono: c2, frente: c1 }} />

        <div className="titular" ref={titular}>
          <span className="antetitulo">{[region, pais].filter(Boolean).join(' · ')}</span>
          <h1>
            <span className="fila"><span className="sube">{nombre}</span></span>
            <span className="fila"><span className="sube"><em>{t('te_espera', idioma)}</em></span></span>
          </h1>
          {lema && <p className="lema-hero">{lema}</p>}

          <div className="buscador">
            <div className="campo">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#8B8B87"
                   strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
              </svg>
              <span className="texto">{t('que_buscas', idioma)}</span>
            </div>
            <a className="boton" href="#plan">{t('buscar', idioma)}</a>
          </div>
        </div>

        <div className="bajar" ref={bajar}><span className="riel" />{t('desliza', idioma)}</div>
      </div>
    </div>
  );
}
