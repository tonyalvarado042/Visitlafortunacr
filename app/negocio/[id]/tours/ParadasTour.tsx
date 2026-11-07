import type { MiParadaDeTour } from '@/lib/comercio';
import { guardarMiParada, borrarMiParada, moverMiParada } from '../../acciones';

/*
 * El itinerario de una tour, del lado del operador.
 *
 * ⚠️ VIVE FUERA DEL FORMULARIO DEL TOUR, y eso no es cuestión de gusto: HTML
 * no permite formularios anidados. Adentro, el navegador se come los botones
 * de cada parada y «Borrar» terminaría guardando el tour entero. Es el mismo
 * motivo por el que la galería de fotos también está aparte — y el repo tiene
 * un verificador que cuenta formularios anidados justamente porque esto ya
 * costó caro una vez.
 *
 * Cada parada es su propio <form>. Se guarda una a la vez, a propósito: un
 * itinerario de ocho paradas en un solo formulario gigante pierde las ocho si
 * una falla.
 */

const TIPOS = [
  { valor: 'salida',  texto: 'Punto de salida' },
  { valor: 'parada',  texto: 'Parada (se bajan)' },
  { valor: 'paso',    texto: 'Pasan por (sin bajarse)' },
  { valor: 'regreso', texto: 'Punto de regreso' },
];

function CamposDeParada({
  parada, lugares,
}: {
  parada?: MiParadaDeTour;
  lugares: { id: string; nombre: string }[];
}) {
  const entrada = parada?.entrada_incluida;
  return (
    <>
      <div className="comercio-par">
        <div>
          <label>Qué es</label>
          <select name="tipo" defaultValue={parada?.tipo ?? 'parada'}>
            {TIPOS.map((x) => <option key={x.valor} value={x.valor}>{x.texto}</option>)}
          </select>
        </div>
        <div>
          <label>Cuánto dura (minutos)</label>
          <input name="duracion_minutos" type="number" min={0} max={1440}
                 defaultValue={parada?.duracion_minutos ?? ''} placeholder="90" />
        </div>
      </div>

      <label>Nombre de la parada</label>
      <input name="titulo" type="text" required maxLength={120}
             defaultValue={parada?.titulo ?? ''}
             placeholder="Catarata de La Fortuna" />

      <label>Contá qué se hace ahí <span className="opcional">opcional</span></label>
      <textarea name="descripcion" rows={2} defaultValue={parada?.descripcion ?? ''}
                placeholder="Bajada de 500 gradas hasta la poza. Se puede nadar." />

      <div className="comercio-par">
        <div>
          {/* El enlace al directorio es lo que hace que el itinerario trabaje
              para el sitio entero: la parada deja de ser texto y pasa a ser un
              lugar con foto, nota y reseñas. */}
          <label>¿Es un lugar del directorio? <span className="opcional">opcional</span></label>
          <select name="lugar_id" defaultValue={parada?.negocio_id ?? ''}>
            <option value="">No, es solo un punto</option>
            {lugares.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </div>
        <div>
          <label>¿La entrada va incluida?</label>
          <select name="entrada_incluida"
                  defaultValue={entrada === true ? 'si' : entrada === false ? 'no' : ''}>
            {/* Tres opciones y no una casilla: «no se dijo» y «no va incluida»
                son cosas distintas, y una casilla las junta en una sola. La
                ficha pública solo escribe «Entrada aparte» cuando el operador
                lo dijo. */}
            <option value="">No aplica</option>
            <option value="si">Sí, incluida</option>
            <option value="no">No, se paga aparte</option>
          </select>
        </div>
      </div>
    </>
  );
}

export function ParadasTour({
  tourId, negocioId, paradas, lugares,
}: {
  tourId: string;
  negocioId: string;
  paradas: MiParadaDeTour[];
  lugares: { id: string; nombre: string }[];
}) {
  return (
    <section className="comercio-paradas">
      <h2>El itinerario</h2>
      <p className="comercio-ayuda">
        Parada por parada, en orden. Es lo que más mira la gente antes de
        reservar: <strong>cuánto dura cada cosa y si la entrada va incluida</strong>.
        Si dejás esto vacío, la ficha sale sin el bloque — no se rompe, pero la
        pregunta se la hacen igual y te llega por correo.
      </p>

      {paradas.length === 0 && (
        <p className="comercio-vacio">Todavía no hay ninguna parada.</p>
      )}

      {paradas.map((p, i) => (
        <div className="comercio-parada" key={p.id}>
          <div className="comercio-parada-cabeza">
            <strong>{i + 1}. {p.titulo}</strong>
            <div className="comercio-parada-mover">
              {/* Subir y bajar en vez de arrastrar: arrastrar necesita
                  JavaScript y no funciona con teclado. Dos botones funcionan
                  siempre, en cualquier teléfono. */}
              <form action={moverMiParada}>
                <input type="hidden" name="tour_id" value={tourId} />
                <input type="hidden" name="negocio_id" value={negocioId} />
                <input type="hidden" name="parada_id" value={p.id} />
                <input type="hidden" name="hacia" value="arriba" />
                <button type="submit" disabled={i === 0} aria-label="Subir">↑</button>
              </form>
              <form action={moverMiParada}>
                <input type="hidden" name="tour_id" value={tourId} />
                <input type="hidden" name="negocio_id" value={negocioId} />
                <input type="hidden" name="parada_id" value={p.id} />
                <input type="hidden" name="hacia" value="abajo" />
                <button type="submit" disabled={i === paradas.length - 1} aria-label="Bajar">↓</button>
              </form>
            </div>
          </div>

          <form action={guardarMiParada} className="forma comercio-forma">
            <input type="hidden" name="tour_id" value={tourId} />
            <input type="hidden" name="negocio_id" value={negocioId} />
            <input type="hidden" name="parada_id" value={p.id} />
            <CamposDeParada parada={p} lugares={lugares} />
            <button className="boton" type="submit">Guardar esta parada</button>
          </form>

          <form action={borrarMiParada} className="comercio-parada-borrar">
            <input type="hidden" name="tour_id" value={tourId} />
            <input type="hidden" name="negocio_id" value={negocioId} />
            <input type="hidden" name="parada_id" value={p.id} />
            <button className="boton peligro tenue" type="submit">Borrar esta parada</button>
          </form>
        </div>
      ))}

      <details className="comercio-parada comercio-parada-nueva" open={paradas.length === 0}>
        <summary><strong>+ Agregar una parada</strong></summary>
        <form action={guardarMiParada} className="forma comercio-forma">
          <input type="hidden" name="tour_id" value={tourId} />
          <input type="hidden" name="negocio_id" value={negocioId} />
          <CamposDeParada lugares={lugares} />
          <button className="boton" type="submit">Agregar al final</button>
        </form>
      </details>
    </section>
  );
}
