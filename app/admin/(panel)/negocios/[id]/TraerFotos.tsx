'use client';

import { useActionState } from 'react';
import { traerFotos, type ResultadoTraer } from '../acciones';

/*
 * Traer fotos desde la web del negocio.
 *
 * Es de cliente por una sola razón: para poder mostrar QUÉ PASÓ CON CADA
 * DIRECCIÓN. Con veinte fotos, una acción de servidor que recarga y no dice
 * nada deja a cualquiera creyendo que entraron veinte cuando entraron doce.
 */

const vacio: ResultadoTraer = {};

export function TraerFotos({ id, nombre }: { id: string; nombre: string }) {
  const [estado, accion, trabajando] = useActionState(traerFotos, vacio);

  return (
    <details className="traer-fotos" style={{ marginTop: 18 }}>
      <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        + Traer fotos desde la web del negocio
      </summary>

      <form action={accion} style={{ marginTop: 12 }}>
        <input type="hidden" name="id" value={id} />

        <div className="campo">
          <label htmlFor={`tf-dir-${id}`}>Direcciones de las fotos</label>
          <textarea id={`tf-dir-${id}`} name="direcciones" rows={6} required
                    placeholder={'https://sitio.com/foto-1.jpg\nhttps://sitio.com/foto-2.jpg'} />
          <small>
            Una por línea. De a 20 como mucho: veinte fotos pesadas se pasan del
            tiempo que aguanta la función. El servidor las baja, las encoge a
            1600 px y las pasa a webp.
          </small>
        </div>

        {/* Autor y licencia NO son opcionales acá: la foto viene de otro sitio,
            así que siempre lleva enlace de origen, y el check de la base exige
            los tres juntos. */}
        <div className="campo">
          <label htmlFor={`tf-cre-${id}`}>Autor</label>
          <input id={`tf-cre-${id}`} name="credito" required defaultValue={nombre} />
        </div>
        <div className="campo">
          <label htmlFor={`tf-lic-${id}`}>Licencia</label>
          <input id={`tf-lic-${id}`} name="licencia" required
                 placeholder="Cedida por el negocio, CC BY 4.0…" />
          <small>
            Si todavía no hay cesión por escrito, escribilo tal cual. Es mejor
            que quede dicho acá a que nadie se acuerde después.
          </small>
        </div>
        <div className="campo">
          <label htmlFor={`tf-alt-${id}`}>Qué se ve (texto alternativo)</label>
          <input id={`tf-alt-${id}`} name="texto_alternativo" placeholder={nombre} />
        </div>

        <button className="boton" type="submit" disabled={trabajando}>
          {trabajando ? 'Bajando…' : 'Traer las fotos'}
        </button>

        {estado.ok && <p style={{ margin: '10px 0 0', fontSize: 13, color: '#1E7B34' }}>{estado.ok}</p>}
        {estado.error && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#B42318' }}>{estado.error}</p>}

        {/* El detalle, dirección por dirección. Lo que falló se lee entero. */}
        {estado.detalle && estado.detalle.length > 0 && (
          <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', fontSize: 12.5 }}>
            {estado.detalle.map((d) => (
              <li key={d.url} style={{ display: 'flex', gap: 8, padding: '3px 0' }}>
                <span style={{ color: d.estado === 'ok' ? '#1E7B34' : '#B42318', flexShrink: 0 }}>
                  {d.estado === 'ok' ? '✓' : '✗'}
                </span>
                <span style={{ flexGrow: 1, wordBreak: 'break-all', opacity: d.estado === 'ok' ? .6 : 1 }}>
                  {d.url.split('/').pop()}
                </span>
                {d.estado !== 'ok' && <span style={{ color: '#B42318', flexShrink: 0 }}>{d.estado}</span>}
              </li>
            ))}
          </ul>
        )}
      </form>
    </details>
  );
}
