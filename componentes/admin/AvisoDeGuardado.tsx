'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/*
 * El cartel que dice que lo último que se guardó rebotó.
 *
 * Lo pone `lib/admin/aviso.ts`, que redirige con `?fallo=…`. Acá se lee, se
 * muestra, y se limpia la dirección para que el mensaje no quede pegado al
 * recargar ni se lo lleve un enlace compartido.
 *
 * ⚠️ POR QUÉ POR LA DIRECCIÓN Y NO POR ALGO MÁS ELEGANTE: ver el comentario
 * largo de `lib/admin/aviso.ts`. Resumen: se probaron el layout del servidor
 * y una galleta, los dos en el navegador, y a la pantalla no llegaba nada.
 * Una navegación de verdad sí llega.
 */

export function AvisoDeGuardado() {
  const params = useSearchParams();
  const fallo = params.get('fallo');
  const [texto, setTexto] = useState<string | null>(null);

  useEffect(() => {
    if (!fallo) return;
    setTexto(fallo);
    /* Se saca de la dirección sin recargar: si queda, al refrescar vuelve a
       salir el error de hace rato y manda a arreglar lo que ya no está roto. */
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('fallo');
      window.history.replaceState(null, '', u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : ''));
    } catch { /* si no se puede limpiar, el cartel igual se ve */ }
  }, [fallo]);

  if (!texto) return null;

  return (
    <div className="aviso mal" role="alert"
         style={{ position: 'sticky', top: 8, zIndex: 50, display: 'flex', alignItems: 'start', gap: 12 }}>
      <span style={{ flex: 1 }}>{texto}</span>
      <button type="button" onClick={() => setTexto(null)} aria-label="Cerrar"
              style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: 18, lineHeight: 1, color: 'inherit' }}>
        ×
      </button>
    </div>
  );
}
