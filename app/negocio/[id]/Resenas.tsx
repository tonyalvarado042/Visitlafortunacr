'use client';

import { useActionState } from 'react';
import type { ResenaDeMiNegocio } from '@/lib/comercio';
import { responderResena, type EstadoComercio } from '../acciones';

const NADA: EstadoComercio = {};

export function Resenas({
  negocioId, resenas,
}: {
  negocioId: string;
  resenas: ResenaDeMiNegocio[];
}) {
  if (!resenas.length) {
    return (
      <section className="comercio-bloque">
        <h2>Reseñas</h2>
        <p className="comercio-sub">Todavía no hay reseñas de tu negocio.</p>
      </section>
    );
  }

  return (
    <section className="comercio-bloque">
      <h2>Reseñas</h2>
      <p className="comercio-sub">
        Podés contestarlas. No se pueden editar ni borrar: lo que escribió el
        viajero es suyo.
      </p>
      {resenas.map((r) => <Resena key={r.id} negocioId={negocioId} resena={r} />)}
    </section>
  );
}

function Resena({ negocioId, resena }: { negocioId: string; resena: ResenaDeMiNegocio }) {
  const [estado, accion, pendiente] = useActionState(responderResena, NADA);

  return (
    <article className="comercio-resena">
      <header>
        <span className="comercio-estrellas" aria-label={`${resena.calificacion} de 5`}>
          {'★'.repeat(resena.calificacion)}{'☆'.repeat(5 - resena.calificacion)}
        </span>
        <strong>{resena.autor}</strong>
        <time dateTime={resena.creado_en}>
          {new Date(resena.creado_en).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </time>
      </header>

      {resena.titulo && <h3>{resena.titulo}</h3>}
      {resena.cuerpo && <p>{resena.cuerpo}</p>}

      <form action={accion} className="comercio-respuesta">
        <input type="hidden" name="resena_id" value={resena.id} />
        <input type="hidden" name="negocio_id" value={negocioId} />
        <label>
          <span>{resena.respuesta_negocio ? 'Tu respuesta' : 'Responder'}</span>
          <textarea name="respuesta" rows={3} defaultValue={resena.respuesta_negocio ?? ''}
                    placeholder="Gracias por venir…" />
        </label>

        {estado.error && <p className="forma-error">{estado.error}</p>}
        {estado.ok && <p className="forma-ok">{estado.ok}</p>}

        <button type="submit" className="boton-linea" disabled={pendiente}>
          {pendiente ? 'Guardando…' : resena.respuesta_negocio ? 'Actualizar respuesta' : 'Publicar respuesta'}
        </button>
      </form>
    </article>
  );
}
