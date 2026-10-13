'use client';

import { useActionState } from 'react';
import type { MiTourDetalle } from '@/lib/comercio';
import { EditorRico } from '@/componentes/EditorRico';
import { guardarMiTour, type EstadoComercio } from '../../../acciones';
import { FotoTour } from '../FotoTour';

const NADA: EstadoComercio = {};

const DIFICULTADES = [
  { valor: '',         texto: 'Sin indicar' },
  { valor: 'facil',    texto: 'Fácil' },
  { valor: 'moderada', texto: 'Moderada' },
  { valor: 'dificil',  texto: 'Difícil' },
];

/*
 * El formulario de una tour, del lado del operador.
 *
 * Lo que NO está acá, y es a propósito: contrato, precio neto y comisión. No
 * es que estén bloqueados — no existen en esta pantalla. Un campo deshabilitado
 * igual le cuenta al operador que hay un número, y el neto del vecino no es
 * asunto suyo.
 *
 * La descripción usa el mismo `EditorRico` que el panel del equipo: lo que se
 * guarda son MARCAS y el servidor genera cada etiqueta, así que por más que
 * alguien pegue un `<script>` sale escrito en pantalla. Ver lib/texto-rico.ts.
 */
export function FormularioTour({
  tour, negocioId, destinoBabosa, negocioBabosa,
}: {
  tour: MiTourDetalle;
  negocioId: string;
  destinoBabosa: string;
  negocioBabosa: string;
}) {
  const [estado, accion, pendiente] = useActionState(guardarMiTour, NADA);

  return (
    <form action={accion} className="forma comercio-forma">
      <input type="hidden" name="tour_id" value={tour.id} />
      <input type="hidden" name="negocio_id" value={negocioId} />

      <h2>Lo que la gente lee</h2>

      <label htmlFor="t-nom">Nombre de la tour</label>
      <input id="t-nom" name="nombre" type="text" required maxLength={120}
             defaultValue={tour.nombre} />

      <label htmlFor="t-res">Una línea que la resuma</label>
      <textarea id="t-res" name="resumen" rows={2} maxLength={300}
                defaultValue={tour.resumen ?? ''}
                placeholder="Caminata de 3 horas por los senderos del volcán, con guía." />
      <small>Es lo que sale debajo del título y en las listas.</small>

      <EditorRico
        nombre="descripcion"
        etiqueta="La descripción completa"
        valor={tour.descripcion}
        ayuda="Contá cómo es el día, qué se ve y para quién es"
        filas={10}
      />

      <h2>La foto</h2>
      <FotoTour destinoBabosa={destinoBabosa} negocioBabosa={negocioBabosa}
                valor={tour.imagen_url} />

      <h2>Qué incluye</h2>
      <label htmlFor="t-inc">Lo que va incluido</label>
      <textarea id="t-inc" name="incluye" rows={5} defaultValue={tour.incluye ?? ''}
                placeholder={'Transporte desde el hotel\nGuía bilingüe\nEntrada al parque'} />
      <small>Una cosa por línea.</small>

      <label htmlFor="t-no">Lo que no va incluido</label>
      <textarea id="t-no" name="no_incluye" rows={3} defaultValue={tour.no_incluye ?? ''}
                placeholder={'Almuerzo\nPropinas'} />
      <small>Una cosa por línea. Decirlo evita el reclamo después.</small>

      <label htmlFor="t-lle">Qué llevar</label>
      <textarea id="t-lle" name="que_llevar" rows={2} defaultValue={tour.que_llevar ?? ''}
                placeholder="Zapatos cerrados, repelente, una chaqueta por si llueve." />

      <h2>Cómo es</h2>
      <div className="comercio-par">
        <div>
          <label htmlFor="t-dur">Cuánto dura (horas)</label>
          <input id="t-dur" name="duracion_horas" type="number" step="0.5" min={0} max={240}
                 defaultValue={tour.duracion_horas ?? ''} />
        </div>
        <div>
          <label htmlFor="t-hor">A qué hora sale</label>
          <input id="t-hor" name="hora_inicio" type="time" defaultValue={tour.hora_inicio ?? ''} />
        </div>
      </div>

      <div className="comercio-par">
        <div>
          <label htmlFor="t-dif">Qué tan exigente es</label>
          <select id="t-dif" name="dificultad" defaultValue={tour.dificultad ?? ''}>
            {DIFICULTADES.map((d) => <option key={d.valor} value={d.valor}>{d.texto}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="t-eda">Edad mínima</label>
          <input id="t-eda" name="edad_minima" type="number" min={0} max={99}
                 defaultValue={tour.edad_minima ?? ''} placeholder="sin mínimo" />
        </div>
      </div>

      <div className="comercio-par">
        <div>
          <label htmlFor="t-cup">Cuánta gente entra</label>
          <input id="t-cup" name="cupo_maximo" type="number" min={1} max={999}
                 defaultValue={tour.cupo_maximo ?? ''} placeholder="sin tope" />
        </div>
        <div>
          <label htmlFor="t-idi">Idiomas del guía</label>
          <input id="t-idi" name="idiomas_guia" type="text"
                 defaultValue={(tour.idiomas_guia ?? []).join(', ')} placeholder="es, en" />
          <small>Separados por coma, de dos letras: es, en, de…</small>
        </div>
      </div>

      <label className="comercio-casilla">
        <input type="checkbox" name="recoge_en_hotel" value="1"
               defaultChecked={tour.recoge_en_hotel} />
        Pasamos a recoger por el hotel
      </label>

      <h2>Precio</h2>
      {tour.se_vende ? (
        /* Ni deshabilitado ni en gris: el número a la vista y el motivo al
           lado. Un campo apagado invita a pelearse con él. */
        <div className="tour-precio-fijo">
          <div>
            <span>Adulto</span>
            <strong>${tour.precio_adulto_usd}</strong>
          </div>
          {tour.precio_nino_usd != null && (
            <div>
              <span>Niño</span>
              <strong>${tour.precio_nino_usd}</strong>
            </div>
          )}
          <small>Fijado en el acuerdo. Para cambiarlo, escribinos.</small>
        </div>
      ) : (
        <>
          <div className="comercio-par">
            <div>
              <label htmlFor="t-pa">Precio por adulto (USD)</label>
              <input id="t-pa" name="precio_adulto_usd" type="number" step="0.01" min={0}
                     defaultValue={tour.precio_adulto_usd || ''} />
            </div>
            <div>
              <label htmlFor="t-pn">Precio por niño (USD)</label>
              <input id="t-pn" name="precio_nino_usd" type="number" step="0.01" min={0}
                     defaultValue={tour.precio_nino_usd ?? ''} placeholder="si no aplica, dejalo vacío" />
            </div>
          </div>
          <small>
            El precio al público, lo que paga la persona. Dejá el de niño vacío si
            la tour no es para niños.
          </small>
        </>
      )}

      <label htmlFor="t-can">Hasta cuántas horas antes se puede cancelar sin costo</label>
      <input id="t-can" name="cancelacion_libre_horas" type="number" min={0} max={720}
             defaultValue={tour.cancelacion_libre_horas} />

      {estado.error && <p className="forma-error" role="alert">{estado.error}</p>}
      {estado.ok && <p className="forma-ok" role="status">{estado.ok}</p>}

      <button className="boton" type="submit" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
