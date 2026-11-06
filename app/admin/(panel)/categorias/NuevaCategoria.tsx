'use client';

import { useActionState } from 'react';
import { crearCategoria, type Estado } from './acciones';

const SECCIONES: { valor: string; nombre: string; pista: string }[] = [
  { valor: 'que_hacer',    nombre: 'Qué hacer',     pista: 'lugares visitables: cataratas, termales, parques' },
  { valor: 'tours',        nombre: 'Tours',         pista: 'lo que vende un operador: aventura, naturaleza' },
  { valor: 'donde_dormir', nombre: 'Dónde dormir',  pista: 'hoteles, lodges, hostales' },
  { valor: 'comer_beber',  nombre: 'Comer y beber', pista: 'restaurantes, sodas, bares' },
  { valor: 'explorar',     nombre: 'Explorar',      pista: 'lo que no cabe en las otras' },
  { valor: 'transporte',   nombre: 'Transporte',    pista: 'shuttles, traslados, alquiler' },
];

/*
 * Crear una categoría que no existe.
 *
 * EL HUECO QUE TAPA: no había forma de crear ni editar una categoría desde el
 * panel. Si un negocio o un tour no encajaba en ninguna de las que había, no
 * quedaba otra que meterlo en la que menos mal le quedara — o dejarlo sin
 * categoría, que es dejarlo fuera del directorio.
 *
 * La SECCIÓN no es un detalle: decide en qué parte del menú aparece y de qué
 * color sale su tarjeta en la retícula. Por eso cada una lleva su pista, en
 * vez de seis palabras sueltas que hay que adivinar.
 */
export function NuevaCategoria() {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(crearCategoria, {});

  return (
    <form action={enviar} className="tarjeta">
      <h2>Crear una categoría <small>si la que necesitás no existe</small></h2>

      <div className="campos">
        <div className="campo">
          <label htmlFor="nc-nombre">Nombre</label>
          <input id="nc-nombre" name="nombre" required placeholder="Cabalgatas" />
          <small>La dirección se arma sola con este nombre.</small>
        </div>
        <div className="campo">
          <label htmlFor="nc-seccion">Sección</label>
          <select id="nc-seccion" name="seccion" defaultValue="que_hacer">
            {SECCIONES.map((s) => (
              <option key={s.valor} value={s.valor}>{s.nombre} · {s.pista}</option>
            ))}
          </select>
          <small>Decide en qué parte del menú sale y de qué color es su tarjeta.</small>
        </div>
      </div>

      <div className="acciones-fila" style={{ marginTop: 12 }}>
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Creando…' : 'Crear y enganchar'}
        </button>
      </div>

      {estado.error && <p className="forma-error">{estado.error}</p>}
      {estado.ok && <p className="forma-ok">{estado.ok}</p>}
    </form>
  );
}
