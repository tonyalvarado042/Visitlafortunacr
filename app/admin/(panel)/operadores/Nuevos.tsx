'use client';

import { useActionState } from 'react';
import { crearContrato, crearProducto, type Estado } from './acciones';

/*
 * Crear contrato y crear producto.
 *
 * Son de cliente solo para poder mostrar el resultado — "creado, nace
 * apagado" — sin que la página pierda el scroll. Todo lo demás de esta
 * pantalla son formularios de servidor normales.
 */

const vacio: Estado = {};

function Resultado({ estado }: { estado: Estado }) {
  if (estado.error) return <p style={{ margin: '8px 0 0', fontSize: 13, color: '#B42318' }}>{estado.error}</p>;
  if (estado.ok) return <p style={{ margin: '8px 0 0', fontSize: 13, color: '#1E7B34' }}>{estado.ok}</p>;
  return null;
}

export function NuevoContrato({
  negocios,
}: {
  negocios: { id: string; nombre: string }[];
}) {
  const [estado, accion, enviando] = useActionState(crearContrato, vacio);

  return (
    <details style={{ marginTop: 14 }}>
      <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        + Nuevo contrato
      </summary>
      <form action={accion} className="campos" style={{ marginTop: 12 }}>
        <div className="campo">
          <label htmlFor="nc-neg">Negocio</label>
          <select id="nc-neg" name="negocio_id" required defaultValue="">
            <option value="" disabled>Elegí uno…</option>
            {negocios.map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
          </select>
          <small>Tiene que estar publicado en el directorio. Si no está, creálo primero en Negocios.</small>
        </div>
        <div className="campo">
          <label htmlFor="nc-nom">Nombre del contrato</label>
          <input id="nc-nom" name="nombre" required placeholder="Piloto 60 días" />
        </div>
        <button className="boton" type="submit" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear contrato'}
        </button>
        <Resultado estado={estado} />
      </form>
    </details>
  );
}

export function NuevoProducto({
  contratoId, negocioId,
}: {
  contratoId: string;
  negocioId: string;
}) {
  const [estado, accion, enviando] = useActionState(crearProducto, vacio);

  return (
    <details style={{ marginTop: 14 }}>
      <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        + Nuevo producto en este contrato
      </summary>
      <form action={accion} className="campos" style={{ marginTop: 12 }}>
        <input type="hidden" name="contrato_id" value={contratoId} />
        <input type="hidden" name="negocio_id" value={negocioId} />
        <div className="campo ancho">
          <label htmlFor={`np-${contratoId}`}>Nombre del producto</label>
          <input id={`np-${contratoId}`} name="nombre" required placeholder="Tour al volcán, medio día" />
          <small>La dirección se arma sola a partir del nombre.</small>
        </div>
        <button className="boton" type="submit" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear producto'}
        </button>
        <Resultado estado={estado} />
      </form>
    </details>
  );
}
