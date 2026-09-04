'use client';

import { useEffect, useState } from 'react';
import { t, type Idioma } from '@/lib/idiomas';

/**
 * La cuenta regresiva hasta la apertura.
 *
 * El instante lo calcula el servidor a partir de `lanzado_el` y la zona del
 * destino, y llega aquí como un número: así alguien en Berlín y alguien en La
 * Fortuna ven exactamente lo mismo.
 *
 * No pinta nada en el primer render y espera al navegador. Es a propósito: si
 * el servidor dibujara los números, al hidratar no coincidirían con la hora
 * del cliente y React se quejaría. Un parpadeo de un cuadro es mejor que eso.
 */
export function CuentaRegresiva({ objetivo, idioma }: { objetivo: number; idioma: Idioma }) {
  const [falta, setFalta] = useState<number | null>(null);

  useEffect(() => {
    function medir() { setFalta(objetivo - Date.now()); }
    medir();
    const reloj = setInterval(medir, 1000);
    return () => clearInterval(reloj);
  }, [objetivo]);

  // Antes de montar, y una vez que la fecha ya pasó, no se muestran números.
  if (falta === null || falta <= 0) return null;

  const segundos = Math.floor(falta / 1000);
  const bloques = [
    { valor: Math.floor(segundos / 86400),      uno: 'teaser_dia',     muchos: 'teaser_dias'     },
    { valor: Math.floor(segundos / 3600) % 24,  uno: 'teaser_hora',    muchos: 'teaser_horas'    },
    { valor: Math.floor(segundos / 60) % 60,    uno: 'teaser_minuto',  muchos: 'teaser_minutos'  },
    { valor: segundos % 60,                     uno: 'teaser_segundo', muchos: 'teaser_segundos' },
  ];

  return (
    <div className="cuenta" role="timer" aria-live="off">
      {bloques.map((b, i) => (
        <div className="cuenta-bloque" key={b.uno}>
          <span className="cuenta-numero">{String(b.valor).padStart(2, '0')}</span>
          <span className="cuenta-unidad">{t(b.valor === 1 ? b.uno : b.muchos, idioma)}</span>
          {i < bloques.length - 1 && <span className="cuenta-punto" aria-hidden="true">·</span>}
        </div>
      ))}
    </div>
  );
}
