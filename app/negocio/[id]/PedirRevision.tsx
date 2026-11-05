'use client';

import { useActionState } from 'react';
import { pedirRevisionDeMiNegocio } from '../acciones';
import type { EstadoComercio } from '../acciones';

/*
 * «Ya terminé, revisen mi ficha.»
 *
 * Antes el dueño cargaba todo y quedaba mudo: no había forma de avisar. El
 * negocio nacía en `pendiente` desde el minuto cero, así que al equipo le
 * llegaban todos iguales —los vacíos y los listos— y se le acumulaban.
 *
 * La validación vive en la base (`pedir_revision_de_mi_negocio`): exige
 * descripción y al menos una foto, y devuelve el motivo en castellano. Acá no
 * se repite esa lógica a propósito; si se repitiera, el día que cambie una de
 * las dos quedarían diciendo cosas distintas.
 */
export function PedirRevision({ negocioId, yaPidio }: { negocioId: string; yaPidio: string | null }) {
  const [estado, enviar, enviando] = useActionState<EstadoComercio, FormData>(
    pedirRevisionDeMiNegocio,
    {},
  );

  if (yaPidio && !estado.error) {
    return (
      <div className="comercio-aviso">
        <strong>Ya le avisaste al equipo.</strong>
        <p>Está en la fila para revisión. Te escribimos apenas la publiquemos.</p>
        <p>Mientras tanto podés seguir cambiando lo que quieras: se guarda solo.</p>
      </div>
    );
  }

  return (
    <form action={enviar} className="comercio-aviso">
      <strong>¿Ya terminaste de cargar tu ficha?</strong>
      <p>
        Avisanos y la ponemos en la fila para revisarla. Necesitás tener escrita
        la descripción y al menos una foto.
      </p>
      <input type="hidden" name="id" value={negocioId} />
      <button type="submit" className="boton" disabled={enviando}>
        {enviando ? 'Avisando…' : 'Ya terminé — revisen mi ficha'}
      </button>
      {estado.error && <p className="forma-error">{estado.error}</p>}
      {estado.ok && <p className="forma-ok">{estado.ok}</p>}
    </form>
  );
}
