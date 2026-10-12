'use client';

import { useActionState } from 'react';
import { responderDesdeElCorreo, type EstadoRespuesta } from './acciones';

/*
 * La caja de respuesta del enlace del correo.
 *
 * Es de cliente para poder mostrar el resultado sin recargar: quien llega acá
 * viene de un correo, escribe dos líneas y se va. Una recarga que lo devuelva
 * a una página en blanco se siente como que no se guardó.
 */

const vacio: EstadoRespuesta = {};

export function Responder({ token, yaTiene }: { token: string; yaTiene: string | null }) {
  const [estado, enviar, enviando] = useActionState(responderDesdeElCorreo, vacio);

  if (estado.ok) {
    return (
      <div className="respuesta-lista" role="status">
        <strong>Listo, ya quedó publicada.</strong>
        <p>Tu respuesta se ve debajo de la reseña, en tu ficha.</p>
      </div>
    );
  }

  return (
    <form action={enviar} className="forma">
      <input type="hidden" name="token" value={token} />
      <div className="campo">
        <label htmlFor="texto">Tu respuesta</label>
        <textarea id="texto" name="texto" rows={6} maxLength={2000} required
                  defaultValue={yaTiene ?? ''}
                  placeholder="Gracias por la visita…" />
        <small>
          La ve cualquiera que entre a tu ficha, con el nombre de tu negocio.
          Contestar bien una reseña regular vende más que diez buenas sin responder.
        </small>
      </div>

      {estado.error && <p className="sorteo-error" role="alert">{estado.error}</p>}

      <button className="boton" type="submit" disabled={enviando}>
        {enviando ? 'Publicando…' : 'Publicar la respuesta'}
      </button>
    </form>
  );
}
