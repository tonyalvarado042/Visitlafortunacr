'use client';

import { useEffect, useRef } from 'react';
import { t, type Idioma } from '@/lib/idiomas';
import { CampoBusqueda } from './CampoBusqueda';

export function Hero({
  idioma, nombre, region, pais, lema, colorAcento, colorVerde, consulta = '', videoUrl,
}: {
  idioma: Idioma;
  nombre: string;
  region: string | null;
  pais: string;
  lema: string | null;
  colorAcento: string;
  colorVerde: string;
  /** Lo que se buscó, para que el campo no se vacíe al volver los resultados. */
  consulta?: string;
  /** El video del destino, de dst_destino.video_portada_url. Sin él, el hero
   *  se queda con el volcán dibujado y no pasa nada. */
  videoUrl?: string | null;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const titular = useRef<HTMLDivElement>(null);
  const bajar = useRef<HTMLDivElement>(null);
  const c1 = useRef<SVGSVGElement>(null);
  const c2 = useRef<SVGSVGElement>(null);
  const c3 = useRef<SVGSVGElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* El lienzo de ceniza solo existe cuando el destino NO tiene video: era
       el relleno mientras no había imágenes reales. Puede no estar, así que
       de aquí en adelante nada puede darlo por hecho — el scroll y el
       observador de secciones tienen que seguir funcionando igual. */
    const cv = lienzo.current;
    const ctx = cv?.getContext('2d') ?? null;

    let an = 0, al = 0, cuadro = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type Brasa = { x: number; y: number; r: number; vx: number; vy: number; vida: number; baja: number; verde: boolean };
    const brasas: Brasa[] = [];

    function medir() {
      if (!cv || !ctx) return;
      an = cv!.clientWidth; al = cv!.clientHeight;
      cv!.width = an * dpr; cv!.height = al * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* Ceniza que sube del cráter. Es lo que le da vida al hero sin necesitar
       un video: se dibuja sola y pesa cero. */
    function nacer(): Brasa {
      return {
        x: an * 0.5 + (Math.random() - 0.5) * an * 0.12,
        y: al * 0.62 + Math.random() * 40,
        r: Math.random() * 1.7 + 0.4,
        vx: (Math.random() - 0.5) * 0.32,
        vy: -(Math.random() * 0.7 + 0.22),
        vida: 1,
        baja: Math.random() * 0.0035 + 0.0014,
        verde: Math.random() > 0.78,
      };
    }

    function pintar() {
      if (!cv || !ctx) return;
      ctx!.clearRect(0, 0, an, al);
      const g = ctx!.createLinearGradient(0, 0, 0, al);
      g.addColorStop(0, '#050505'); g.addColorStop(0.42, '#0C0A08');
      g.addColorStop(0.72, '#171008'); g.addColorStop(1, '#0B0B0B');
      ctx!.fillStyle = g; ctx!.fillRect(0, 0, an, al);

      const r = ctx!.createRadialGradient(an * 0.5, al * 0.6, 0, an * 0.5, al * 0.6, an * 0.42);
      r.addColorStop(0, 'rgba(255,106,0,.16)'); r.addColorStop(1, 'rgba(255,106,0,0)');
      ctx!.fillStyle = r; ctx!.fillRect(0, 0, an, al);

      if (suave) {
        if (brasas.length < 90) brasas.push(nacer());
        for (let i = brasas.length - 1; i >= 0; i--) {
          const p = brasas[i];
          p.x += p.vx; p.y += p.vy; p.vida -= p.baja;
          if (p.vida <= 0 || p.y < -20) { brasas.splice(i, 1); continue; }
          ctx!.globalAlpha = p.vida * 0.65;
          ctx!.fillStyle = p.verde ? colorVerde : colorAcento;
          ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, 6.2832); ctx!.fill();
        }
        ctx!.globalAlpha = 1;
      }
      cuadro = requestAnimationFrame(pintar);
    }

    if (cv && ctx) {
      medir();
      pintar();
      window.addEventListener('resize', medir);
    }

    // Con video, se reproduce desde el primer momento: es el fondo del hero.
    if (video.current && suave) video.current.play().catch(() => {});

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

      /* El video está desde el primer fotograma y se mueve con el scroll: se
         acerca y sube un poco, igual que hacían las capas dibujadas. Es lo
         que evita que se sienta una foto pegada detrás del texto. */
      if (video.current) {
        video.current.style.transform = `translateY(${-p * 60}px) scale(${1 + p * 0.14})`;
      }

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
      if (cuadro) cancelAnimationFrame(cuadro);
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', alScroll);
      mirador.disconnect();
      barra?.classList.remove('sobre-hero', 'pegada');
    };
  }, [colorAcento, colorVerde]);

  return (
    <div className="pista" ref={pista}>
      <div className="escena">
        {/* El volcán dibujado y la ceniza eran el relleno mientras el destino
            no tenía video. Con video no se dibujan: ni se pintan encima ni
            gastan un requestAnimationFrame permanente detrás de él. */}
        {!videoUrl && <>
        <canvas id="cielo" ref={lienzo} />

        <svg className="capa" ref={c3} width="2400" height="760" viewBox="0 0 2400 760"
             fill="none" aria-hidden="true" style={{ opacity: .35 }}>
          <path d="M0 760 L560 250 Q600 205 640 250 L1180 760 Z" fill="#0E1A12" />
          <path d="M1120 760 L1620 330 Q1656 292 1692 330 L2400 760 Z" fill="#0C1610" />
        </svg>

        <svg className="capa" ref={c2} width="2000" height="700" viewBox="0 0 2000 700" fill="none" aria-hidden="true">
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

        <svg className="capa" ref={c1} width="2600" height="330" viewBox="0 0 2600 330" fill="none" aria-hidden="true">
          <path d="M0 330 L0 190 Q300 130 620 178 Q940 226 1300 160 Q1660 94 2000 168 Q2320 236 2600 176 L2600 330 Z" fill="#080808" />
          <g fill={colorVerde} opacity=".18">
            <path d="M180 190 q30 -66 60 0 q-30 26 -60 0" /><path d="M760 172 q34 -74 68 0 q-34 30 -68 0" />
            <path d="M1500 150 q30 -66 60 0 q-30 26 -60 0" /><path d="M2160 176 q34 -74 68 0 q-34 30 -68 0" />
          </g>
        </svg>

        </>}

        {/* El fondo del hero. Va antes del velo y del grano a propósito, para
            que esos dos lo cubran: son los que disuelven sus bordes en negro
            y los que mantienen legible el titular encima. */}
        {videoUrl && (
          <video ref={video} className="video-escena" src={videoUrl}
                 autoPlay muted loop playsInline preload="auto" aria-hidden="true" />
        )}

        <div className={videoUrl ? 'velo con-video' : 'velo'} />
        <div className="grano" />

        <div className="titular" ref={titular}>
          <span className="antetitulo">{[region, pais].filter(Boolean).join(' · ')}</span>
          <h1>
            <span className="fila"><span className="sube">{nombre}</span></span>
            <span className="fila"><span className="sube"><em>{t('te_espera', idioma)}</em></span></span>
          </h1>
          {lema && <p className="lema-hero">{lema}</p>}

          <CampoBusqueda idioma={idioma} consulta={consulta} />
        </div>

        <div className="bajar" ref={bajar}><span className="riel" />{t('desliza', idioma)}</div>
      </div>
    </div>
  );
}
