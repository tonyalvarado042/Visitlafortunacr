'use client';

import { useState } from 'react';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { traducirSorteo } from './acciones';

/*
 * Las traducciones de la rifa.
 *
 * Existe porque faltaba, y faltar le costó a Tony media tarde: cambió el
 * premio al español y el inglés y el portugués siguieron diciendo lo viejo,
 * sin ninguna pantalla donde arreglarlo. La traducción TAPA a la columna
 * —así funciona `texto_en`—, así que un campo traducido y sin pantalla es un
 * texto que no se puede cambiar desde ningún lado.
 *
 * Es de cliente solo para el selector de idioma: mostrar los siete campos de
 * los cuatro idiomas a la vez son veintiocho cajas de texto en una pantalla.
 */

type Trad = { campo: string; idioma: string; texto: string };

const CAMPOS: { campo: string; etiqueta: string; largo?: boolean; ayuda?: string }[] = [
  { campo: 'titulo',        etiqueta: 'Título' },
  { campo: 'gancho',        etiqueta: 'Gancho', largo: true },
  { campo: 'premio_titulo', etiqueta: 'Qué se gana' },
  { campo: 'premio_nota',   etiqueta: 'Nota del premio' },
  { campo: 'cuando_texto',  etiqueta: 'Cuándo (texto)' },
  { campo: 'incluye',       etiqueta: 'Qué incluye', largo: true, ayuda: 'Una línea por punto, igual que en español.' },
  { campo: 'bases_html',    etiqueta: 'Las bases (HTML)', largo: true },
];

export function Traducciones({
  sorteoId, idiomas, principal, traducciones, base, esAdmin,
}: {
  sorteoId: string;
  idiomas: string[];
  principal: string;
  traducciones: Trad[];
  base: Record<string, string>;
  esAdmin: boolean;
}) {
  const otros = idiomas.filter((i) => i !== principal);
  const [idioma, setIdioma] = useState(otros[0] ?? '');
  if (!otros.length) return null;

  const valor = (campo: string) =>
    traducciones.find((t) => t.idioma === idioma && t.campo === campo)?.texto ?? '';

  return (
    <>
      <div className="acciones-fila" style={{ marginBottom: 16 }}>
        {otros.map((i) => (
          <button key={i} type="button"
                  className={`boton chico ${i === idioma ? '' : 'secundario'}`}
                  onClick={() => setIdioma(i)}>
            {i.toUpperCase()}
          </button>
        ))}
      </div>

      {CAMPOS.map(({ campo, etiqueta, largo, ayuda }) => {
        const puesto = valor(campo);
        return (
          <form action={traducirSorteo} key={`${idioma}-${campo}`} className="campos"
                style={{ gridTemplateColumns: '1fr', marginBottom: 18 }}>
            <input type="hidden" name="sorteo_id" value={sorteoId} />
            <input type="hidden" name="campo" value={campo} />
            <input type="hidden" name="idioma" value={idioma} />
            <div className="campo ancho">
              <label htmlFor={`tr-${idioma}-${campo}`}>
                {etiqueta} <small style={{ opacity: .6 }}>· {idioma.toUpperCase()}</small>
              </label>
              {largo
                ? <textarea id={`tr-${idioma}-${campo}`} name="texto" rows={campo === 'bases_html' ? 8 : 3}
                            defaultValue={puesto} disabled={!esAdmin} />
                : <input id={`tr-${idioma}-${campo}`} name="texto"
                         defaultValue={puesto} disabled={!esAdmin} />}
              {/* El original siempre a la vista: traducir a ciegas es como se
                  llega a que el inglés prometa cuatro días y el español cinco. */}
              <small>
                <strong>{principal.toUpperCase()}:</strong>{' '}
                {base[campo] ? base[campo].slice(0, 160) : <em>vacío</em>}
                {ayuda ? ` · ${ayuda}` : ''}
                {!puesto && ' · Vacío = se muestra el original.'}
              </small>
            </div>
            {esAdmin && <BotonAccion clase="boton chico secundario">Guardar</BotonAccion>}
          </form>
        );
      })}
    </>
  );
}
