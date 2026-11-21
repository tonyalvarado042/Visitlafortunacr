'use client';

import { useActionState } from 'react';
import { editarCategoria, guardarTraduccionesDeCategoria, type Estado } from '../acciones';

const SECCIONES: { valor: string; nombre: string; pista: string }[] = [
  { valor: 'que_hacer',    nombre: 'Qué hacer',     pista: 'lugares visitables: cataratas, termales, parques' },
  { valor: 'tours',        nombre: 'Tours',         pista: 'lo que vende un operador: aventura, naturaleza' },
  { valor: 'donde_dormir', nombre: 'Dónde dormir',  pista: 'hoteles, lodges, hostales' },
  { valor: 'comer_beber',  nombre: 'Comer y beber', pista: 'restaurantes, sodas, bares' },
  { valor: 'explorar',     nombre: 'Explorar',      pista: 'lo que no cabe en las otras' },
  { valor: 'transporte',   nombre: 'Transporte',    pista: 'shuttles, traslados, alquiler' },
];

/*
 * Editar la categoría en el catálogo: nombre, dirección y sección.
 *
 * Hasta el 21 de noviembre de 2026 no se podía. Una errata en el nombre
 * —«Gimnacios»— se quedaba ahí para siempre, y mover una categoría de
 * sección había que hacerlo en la base.
 */
export function EditarCategoria({
  id, nombre, babosa, seccion, conContenido,
}: {
  id: string; nombre: string; babosa: string; seccion: string;
  /** Cuántos negocios y tours tiene adentro, para avisar antes de mudarla. */
  conContenido: number;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(editarCategoria, {});

  return (
    <form action={enviar} className="tarjeta">
      <h2>En el catálogo <small>nombre, dirección y sección</small></h2>

      <input type="hidden" name="categoria_id" value={id} />

      <div className="campos">
        <div className="campo">
          <label htmlFor="ec-nombre">Nombre</label>
          <input id="ec-nombre" name="nombre" defaultValue={nombre} required />
          <small>El nombre en español, que es el idioma principal del destino.</small>
        </div>

        <div className="campo">
          <label htmlFor="ec-babosa">Dirección</label>
          <input id="ec-babosa" name="babosa" defaultValue={babosa} />
          <small>
            Hoy es <code>/es/{babosa}</code>. Si la cambiás, la vieja{' '}
            <strong>no deja de funcionar</strong>: queda redirigiendo a la nueva, así
            los enlaces compartidos y lo que Google ya tiene indexado siguen llegando.
          </small>
        </div>

        <div className="campo">
          <label htmlFor="ec-seccion">Sección</label>
          <select id="ec-seccion" name="seccion" defaultValue={seccion}>
            {SECCIONES.map((s) => (
              <option key={s.valor} value={s.valor}>{s.nombre} · {s.pista}</option>
            ))}
          </select>
          <small>
            Decide en qué parte del menú sale y de qué color es su tarjeta.
            {conContenido > 0 && (
              <> Cambiarla mueve de sección a <strong>los {conContenido} lugares</strong> que tiene adentro.</>
            )}
          </small>
        </div>
      </div>

      <div className="acciones-fila" style={{ marginTop: 12 }}>
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {estado.error && <p className="forma-error">{estado.error}</p>}
      {estado.ok && <p className="forma-ok">{estado.ok}</p>}
    </form>
  );
}

/*
 * Los otros idiomas.
 *
 * ⚠️ EL ORIGINAL VA AL LADO DE CADA CAMPO, y no es decoración: es el mismo
 * patrón que la ficha de una tour. Traducir mirando una pantalla vacía
 * obliga a abrir otra pestaña para ver qué decía, y así es como terminan
 * traducciones que no corresponden al texto original.
 */
export function TraducirCategoria({
  id, nombre, babosa, idiomas, nombreDeIdioma, actual,
}: {
  id: string;
  /** El original, para tenerlo al lado. */
  nombre: string;
  babosa: string;
  /** Los idiomas del destino sin el principal. */
  idiomas: string[];
  nombreDeIdioma: Record<string, string>;
  /** Lo que ya está cargado: { en: { nombre, babosa } }. */
  actual: Record<string, { nombre: string; babosa: string }>;
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(guardarTraduccionesDeCategoria, {});
  const hechos = idiomas.filter((i) => actual[i]?.nombre).length;

  return (
    <form action={enviar} className="tarjeta">
      <h2>
        Otros idiomas{' '}
        <small>{hechos} de {idiomas.length} traducidos</small>
      </h2>

      <input type="hidden" name="categoria_id" value={id} />

      {hechos < idiomas.length && (
        <p className="forma-nota">
          Lo que falte acá <strong>sale en español</strong> en ese idioma. No se rompe
          nada — solo que un visitante en inglés lee «{nombre}» donde esperaba su idioma.
        </p>
      )}

      {idiomas.map((i) => (
        <details key={i} open={!actual[i]?.nombre}>
          <summary>
            {nombreDeIdioma[i] ?? i.toUpperCase()}
            {actual[i]?.nombre
              ? <span className="gris"> · {actual[i].nombre}</span>
              : <span className="gris"> · sin traducir</span>}
          </summary>

          <div className="campos" style={{ marginTop: 10 }}>
            <div className="campo">
              <label htmlFor={`tr-nombre-${i}`}>Nombre</label>
              <input id={`tr-nombre-${i}`} name={`nombre_${i}`}
                     defaultValue={actual[i]?.nombre ?? ''} placeholder={nombre} />
              <small>En español: <strong>{nombre}</strong>. Vacío = se muestra el español.</small>
            </div>

            <div className="campo">
              <label htmlFor={`tr-babosa-${i}`}>Dirección</label>
              <input id={`tr-babosa-${i}`} name={`babosa_${i}`}
                     defaultValue={actual[i]?.babosa ?? ''} placeholder={babosa} />
              <small>
                En español: <code>/{babosa}</code>. La que pongas acá queda en{' '}
                <code>/{i}/…</code> y la anterior redirige. Vacío = no se toca.
              </small>
            </div>
          </div>
        </details>
      ))}

      <div className="acciones-fila" style={{ marginTop: 12 }}>
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar las traducciones'}
        </button>
      </div>

      {estado.error && <p className="forma-error">{estado.error}</p>}
      {estado.ok && <p className="forma-ok">{estado.ok}</p>}
    </form>
  );
}
