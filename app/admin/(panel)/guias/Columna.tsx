'use client';

import { useState } from 'react';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import {
  agregarALaColumna, quitarDeLaColumna, moverEnLaColumna, prenderApagarEnLaColumna,
} from './acciones';

/*
 * La columna de la derecha del blog, desde el panel.
 *
 * Es de cliente por una sola cosa: el formulario de agregar cambia de campos
 * según el tipo. Elegir "negocio" tiene que mostrar la lista de negocios, y
 * "enlace" un título y una dirección. Mostrar los cuatro juegos a la vez es
 * pedirle a quien lo usa que adivine cuáles llenar.
 */

export type PiezaAdmin = {
  id: string;
  tipo: string;
  esta_activo: boolean;
  orden: number;
  titulo: string | null;
  url: string | null;
  negocio: { nombre: string } | null;
  experiencia: { titulo: string } | null;
  guia: { titulo: string } | null;
};

const COMO_SE_LLAMA = (p: PiezaAdmin) =>
  p.negocio?.nombre ?? p.experiencia?.titulo ?? p.guia?.titulo ?? p.titulo ?? '(sin nombre)';

export function Columna({
  piezas, negocios, experiencias, guias,
}: {
  piezas: PiezaAdmin[];
  negocios: { id: string; nombre: string }[];
  experiencias: { id: string; titulo: string }[];
  guias: { id: string; titulo: string }[];
}) {
  const [tipo, setTipo] = useState<'negocio' | 'experiencia' | 'guia' | 'enlace'>('negocio');

  const lista = tipo === 'negocio' ? negocios.map((n) => ({ id: n.id, nombre: n.nombre }))
    : tipo === 'experiencia' ? experiencias.map((e) => ({ id: e.id, nombre: e.titulo }))
    : tipo === 'guia' ? guias.map((g) => ({ id: g.id, nombre: g.titulo }))
    : [];

  return (
    <>
      {piezas.length === 0 ? (
        <p className="gris" style={{ fontSize: 13, margin: '0 0 14px' }}>
          Todavía no hay nada. Lo que agregués acá sale en la columna de la derecha
          de <strong>todos</strong> los artículos del blog.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {piezas.map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
              border: '1px solid var(--borde)', borderRadius: 5,
              opacity: p.esta_activo ? 1 : .5,
            }}>
              <form action={moverEnLaColumna} style={{ display: 'contents' }}>
                <input type="hidden" name="id" value={p.id} />
                <input name="orden" type="number" defaultValue={p.orden} aria-label="Orden"
                       style={{ width: 56, flexShrink: 0 }} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
              </form>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--humo)', width: 86, flexShrink: 0 }}>
                {p.tipo}
              </span>
              <span style={{ flexGrow: 1, fontSize: 13.5, minWidth: 0 }}>{COMO_SE_LLAMA(p)}</span>

              <form action={prenderApagarEnLaColumna}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="encender" value={p.esta_activo ? '0' : '1'} />
                <BotonAccion clase="boton chico secundario">
                  {p.esta_activo ? 'Apagar' : 'Encender'}
                </BotonAccion>
              </form>
              <form action={quitarDeLaColumna}>
                <input type="hidden" name="id" value={p.id} />
                <BotonAccion clase="boton chico tenue" confirmar="Se quita de la columna del blog.">
                  Quitar
                </BotonAccion>
              </form>
            </div>
          ))}
        </div>
      )}

      <details>
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>+ Agregar algo a la columna</summary>
        <form action={agregarALaColumna} className="campos" style={{ marginTop: 12, gridTemplateColumns: '1fr' }}>
          <div className="campo">
            <label htmlFor="col-tipo">Qué es</label>
            <select id="col-tipo" name="tipo" value={tipo}
                    onChange={(e) => setTipo(e.target.value as typeof tipo)}>
              <option value="negocio">Un negocio</option>
              <option value="experiencia">Una experiencia</option>
              <option value="guia">Otro artículo</option>
              <option value="enlace">Un enlace escrito a mano</option>
            </select>
          </div>

          {tipo !== 'enlace' ? (
            <div className="campo">
              <label htmlFor="col-ent">Cuál</label>
              <select id="col-ent" name="entidad_id" required defaultValue="">
                <option value="" disabled>Elegí uno…</option>
                {lista.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
              <small>El título y la foto salen de su ficha. Si cambia allá, cambia acá.</small>
            </div>
          ) : (
            <>
              <div className="campo"><label htmlFor="col-tit">Título</label><input id="col-tit" name="titulo" required /></div>
              <div className="campo"><label htmlFor="col-url">Dirección</label><input id="col-url" name="url" required placeholder="https://…" /></div>
              <div className="campo"><label htmlFor="col-txt">Una línea</label><input id="col-txt" name="texto" /></div>
              <div className="campo"><label htmlFor="col-img">Foto (URL)</label><input id="col-img" name="imagen_url" placeholder="https://…" /></div>
            </>
          )}

          <div className="campo"><label htmlFor="col-ord">Orden</label><input id="col-ord" name="orden" type="number" defaultValue={piezas.length} style={{ width: 90 }} /></div>
          <BotonAccion>Agregar</BotonAccion>
        </form>
      </details>
    </>
  );
}
