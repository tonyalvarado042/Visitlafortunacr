'use client';

import { useActionState } from 'react';
import { crearMiTour, type EstadoComercio } from '../../acciones';

const NADA: EstadoComercio = {};

/*
 * Crear una tour pide UNA sola cosa: el nombre.
 *
 * Un formulario de veinte campos para empezar es donde la gente abandona.
 * Con el nombre ya hay algo a lo que volver, y el resto se llena en la
 * pantalla de editar, que guarda sola. La base la crea en borrador con precio
 * cero, y `mandar_mi_tour_a_revision` no la deja salir sin precio.
 */
export function NuevaTour({ negocioId }: { negocioId: string }) {
  const [estado, accion, pendiente] = useActionState(crearMiTour, NADA);

  return (
    <form action={accion} className="forma comercio-forma tour-nueva">
      <input type="hidden" name="negocio_id" value={negocioId} />
      <h2>Agregar una tour</h2>
      <label htmlFor="nt-nom">¿Cómo se llama?</label>
      <input id="nt-nom" name="nombre" type="text" required maxLength={120}
             placeholder="Caminata nocturna al volcán" />
      <small>El resto —precio, qué incluye, fotos— lo llenás en la pantalla siguiente.</small>

      {estado.error && <p className="forma-error" role="alert">{estado.error}</p>}

      <button className="boton" type="submit" disabled={pendiente}>
        {pendiente ? 'Creando…' : 'Crear tour'}
      </button>
    </form>
  );
}
