'use client';

import { useState } from 'react';

/**
 * Las tres lecturas de un viaje: la que convence, la que se consulta y la que
 * se mira. Juntas en una sola página la gente abandona antes de llegar al
 * precio; en pestañas, cada quien entra por donde le importa.
 *
 * El contenido ya viene pintado desde el servidor —las tres pestañas están en
 * el HTML desde el primer momento— así que el buscador las lee todas y
 * cambiar de pestaña no pide nada a la red. Lo único que hace el cliente es
 * decidir cuál se muestra.
 */
export function Pestanas({
  solapas,
}: {
  solapas: { clave: string; titulo: string; contenido: string }[];
}) {
  const [activa, setActiva] = useState(solapas[0]?.clave ?? '');

  if (solapas.length === 0) return null;

  return (
    <>
      <div className="exp-solapas" role="tablist">
        {solapas.map((s) => (
          <button
            key={s.clave}
            type="button"
            role="tab"
            id={`solapa-${s.clave}`}
            aria-selected={activa === s.clave}
            aria-controls={`panel-${s.clave}`}
            className={activa === s.clave ? 'activa' : ''}
            onClick={() => setActiva(s.clave)}
          >
            {s.titulo}
          </button>
        ))}
      </div>

      {solapas.map((s) => (
        <div
          key={s.clave}
          role="tabpanel"
          id={`panel-${s.clave}`}
          aria-labelledby={`solapa-${s.clave}`}
          hidden={activa !== s.clave}
          className="exp-prosa"
          /* Lo escribe el equipo en el panel y pasa por htmlDeConfianza antes
             de llegar acá. Ver lib/html-de-confianza.ts. */
          dangerouslySetInnerHTML={{ __html: s.contenido }}
        />
      ))}
    </>
  );
}
