'use client';

import { useEffect, type RefObject } from 'react';

/**
 * La ceniza que sube del cráter, pintada en un canvas.
 *
 * Vive aparte porque la usan dos pantallas distintas: el hero de la portada,
 * que además se mueve con el scroll, y la pantalla de prelanzamiento, que es
 * una sola vista quieta. El fondo es el mismo; lo que cambia es lo que va
 * encima. Pesa cero: no hay video ni imágenes, se dibuja sola.
 *
 * Respeta `prefers-reduced-motion`: si alguien pidió menos movimiento, el
 * degradado se pinta igual pero las partículas no.
 */
export function usarCeniza(
  lienzo: RefObject<HTMLCanvasElement | null>,
  colorAcento: string,
  colorVerde: string
) {
  useEffect(() => {
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cv = lienzo.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let an = 0, al = 0, cuadro = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type Brasa = { x: number; y: number; r: number; vx: number; vy: number; vida: number; baja: number; verde: boolean };
    const brasas: Brasa[] = [];

    function medir() {
      an = cv!.clientWidth; al = cv!.clientHeight;
      cv!.width = an * dpr; cv!.height = al * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

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

    medir();
    pintar();
    window.addEventListener('resize', medir);

    return () => {
      cancelAnimationFrame(cuadro);
      window.removeEventListener('resize', medir);
    };
  }, [lienzo, colorAcento, colorVerde]);
}
