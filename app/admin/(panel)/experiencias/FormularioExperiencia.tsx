'use client';

import { useActionState } from 'react';
import { guardarExperiencia, type Estado } from './acciones';

const NADA: Estado = {};

export type ExperienciaEditable = {
  id: string | null;
  titulo: string;
  babosa: string;
  subtitulo: string | null;
  resumen: string | null;
  cuerpo_html: string | null;
  dias: number | null;
  noches: number | null;
  personas: number | null;
  precio_desde_usd: number | null;
  imagen_url: string | null;
  zonas: string[];
  incluye: string[];
  no_incluye: string[];
  orden: number;
  es_publico: boolean;
};

export function FormularioExperiencia({ exp }: { exp: ExperienciaEditable }) {
  const [estado, accion, pendiente] = useActionState(guardarExperiencia, NADA);

  return (
    <form action={accion} className="campos" style={{ gridTemplateColumns: '1fr' }}>
      {exp.id && <input type="hidden" name="id" value={exp.id} />}

      {estado.error && <div className="aviso mal">{estado.error}</div>}
      {estado.ok && <div className="aviso ok">{estado.ok}</div>}

      <div className="campo">
        <label htmlFor="titulo">Título</label>
        <input id="titulo" name="titulo" type="text" required defaultValue={exp.titulo}
               placeholder="Arenal y Manuel Antonio" />
      </div>

      <div className="campo">
        <label htmlFor="subtitulo">Bajada</label>
        <input id="subtitulo" name="subtitulo" type="text" defaultValue={exp.subtitulo ?? ''}
               placeholder="Volcán, catarata y Pacífico en siete días" />
      </div>

      <div className="campo">
        <label htmlFor="babosa">Dirección</label>
        <input id="babosa" name="babosa" type="text" defaultValue={exp.babosa}
               placeholder="arenal-y-manuel-antonio" />
        <small>Lo que va después de /experiencias/. Vacío, sale del título.</small>
      </div>

      <div className="campos" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="campo">
          <label htmlFor="dias">Días</label>
          <input id="dias" name="dias" type="number" min={1} max={60} required defaultValue={exp.dias ?? 7} />
        </div>
        <div className="campo">
          <label htmlFor="noches">Noches</label>
          <input id="noches" name="noches" type="number" min={0} max={60} defaultValue={exp.noches ?? ''} />
        </div>
        <div className="campo">
          <label htmlFor="personas">Personas base</label>
          <input id="personas" name="personas" type="number" min={1} max={20} defaultValue={exp.personas ?? 2} />
        </div>
        <div className="campo">
          <label htmlFor="precio_desde_usd">Desde (USD, por persona)</label>
          <input id="precio_desde_usd" name="precio_desde_usd" type="number" min={0} step="0.01"
                 defaultValue={exp.precio_desde_usd ?? ''} />
        </div>
      </div>

      <div className="campo">
        <label htmlFor="zonas">Zonas</label>
        <input id="zonas" name="zonas" type="text" defaultValue={exp.zonas.join(', ')}
               placeholder="Arenal, Manuel Antonio" />
        <small>Separadas por coma. Salen en la tarjeta.</small>
      </div>

      <div className="campo">
        <label htmlFor="imagen_url">Foto de portada</label>
        <input id="imagen_url" name="imagen_url" type="url" defaultValue={exp.imagen_url ?? ''}
               placeholder="https://…" />
      </div>

      <div className="campo">
        <label htmlFor="resumen">Resumen</label>
        <textarea id="resumen" name="resumen" rows={3} defaultValue={exp.resumen ?? ''} />
        <small>Para el buscador y las redes. No se pinta en la ficha: eso lo hace el cuerpo.</small>
      </div>

      <div className="campo">
        <label htmlFor="cuerpo_html">El viaje, en HTML</label>
        <textarea id="cuerpo_html" name="cuerpo_html" rows={26} spellCheck={false}
                  defaultValue={exp.cuerpo_html ?? PLANTILLA}
                  style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, lineHeight: 1.6 }} />
        <small>
          Todo el viaje va acá: día a día, dónde duermen, qué incluye y qué no.
          Sirven <code>&lt;h2&gt;</code>, <code>&lt;h3&gt;</code>, <code>&lt;p&gt;</code>,
          <code>&lt;ul&gt;</code>/<code>&lt;li&gt;</code>, <code>&lt;strong&gt;</code>,
          <code>&lt;em&gt;</code>, <code>&lt;a&gt;</code>, <code>&lt;img&gt;</code>,
          <code>&lt;blockquote&gt;</code> y <code>&lt;table&gt;</code>. Poné
          <code> class=&quot;entrada&quot;</code> en el primer párrafo para que salga grande.
          El sitio le quita <code>&lt;script&gt;</code> y los <code>on…</code> antes de pintarlo.
        </small>
      </div>

      <div className="campos" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="campo">
          <label htmlFor="incluye">Qué incluye</label>
          <textarea id="incluye" name="incluye" rows={6} defaultValue={exp.incluye.join('\n')} />
          <small>Uno por línea. Es aparte del cuerpo, para poder listarlo en otro lado.</small>
        </div>
        <div className="campo">
          <label htmlFor="no_incluye">Qué no incluye</label>
          <textarea id="no_incluye" name="no_incluye" rows={6} defaultValue={exp.no_incluye.join('\n')} />
          <small>Uno por línea.</small>
        </div>
      </div>

      <div className="campos" style={{ gridTemplateColumns: '140px 1fr' }}>
        <div className="campo">
          <label htmlFor="orden">Orden</label>
          <input id="orden" name="orden" type="number" min={0} max={999} defaultValue={exp.orden} />
        </div>
        <div className="campo" style={{ justifyContent: 'flex-end' }}>
          <label>
            <input type="checkbox" name="es_publico" value="1" defaultChecked={exp.es_publico} />
            {' '}Publicada (se ve en el sitio)
          </label>
        </div>
      </div>

      <button className="boton" type="submit" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}

const PLANTILLA = `<p class="entrada">De qué se trata el viaje, en dos o tres líneas.</p>

<h2>Día a día</h2>

<h3>Día 1 · Llegada</h3>
<p>Qué pasa ese día.</p>

<h2>Dónde duermen</h2>

<h3>Zona · N noches</h3>
<p>El hotel y por qué ese y no otro.</p>

<h2>Qué incluye</h2>
<ul>
  <li>…</li>
</ul>

<h2>Qué no incluye</h2>
<ul>
  <li>Vuelo internacional</li>
  <li>Seguro de viaje</li>
</ul>`;
