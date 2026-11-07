import Link from 'next/link';
import { notFound } from 'next/navigation';
import { miNegocio, miTour, fotosDeMiTour, traduccionesDeMiTour, misParadasDeTour, lugaresParaEnlazar, ESTADO_TOUR, MINIMO_FOTOS_TOUR } from '@/lib/comercio';
import { destinoActual } from '@/lib/destino';
import { NOMBRE_PROPIO } from '@/lib/idiomas';
import { FormularioTour } from './FormularioTour';
import { FotosTour } from '../FotosTour';
import { ParadasTour } from '../ParadasTour';
import { mandarMiTourARevision, borrarMiTour } from '../../../acciones';

export const dynamic = 'force-dynamic';

export default async function EditarMiTour({
  params,
}: {
  params: Promise<{ id: string; tour: string }>;
}) {
  const { id, tour: tourId } = await params;

  const negocio = await miNegocio(id);
  if (!negocio) notFound();

  /* `mi_tour` devuelve cero filas cuando la tour no es de quien llama, así que
     esto es un 404 y no un "prohibido" — que ya confirmaría que existe. */
  const tour = await miTour(tourId);
  if (!tour) notFound();

  const [fotos, traducciones, destino, paradas] = await Promise.all([
    fotosDeMiTour(tourId), traduccionesDeMiTour(tourId), destinoActual(),
    misParadasDeTour(tourId),
  ]);
  /* Los lugares del directorio para enlazar una parada. Va después y no en el
     mismo Promise.all porque necesita el dominio del destino. */
  const lugares = await lugaresParaEnlazar(destino.dominio);

  /* Los idiomas que el operador tiene que llenar: los que el sitio SIRVE,
     menos el principal, que es el que ya escribió arriba. Sale de la base y
     no de una lista acá: el día que el destino active un idioma más, este
     formulario lo pide solo. */
  const otrosIdiomas = destino.idiomas
    .filter((i) => i !== destino.idioma_principal)
    .map((codigo) => ({ codigo, nombre: NOMBRE_PROPIO[codigo] ?? codigo }));

  const estado = ESTADO_TOUR[tour.estado] ?? ESTADO_TOUR.borrador;
  const sinPrecio = !(tour.precio_adulto_usd > 0);

  return (
    <>
      <Link href={`/negocio/${id}/tours`} className="comercio-volver">← Mis tours</Link>

      <div className="comercio-cabecera">
        <div>
          <span className="comercio-cat">{negocio.nombre}</span>
          <h1>{tour.nombre}</h1>
        </div>
        <div className="comercio-estado-caja">
          <span className="comercio-estado" style={{ color: estado.color }}>● {estado.texto}</span>
          <small>{estado.detalle}</small>
        </div>
      </div>

      {/* El precio congelado se explica acá arriba y no escondido junto al
          campo: es la pregunta que va a hacer el operador apenas lo vea gris. */}
      {tour.se_vende && (
        <div className="aviso-info">
          <strong>Esta tour ya se reserva desde el sitio.</strong>
          <p>
            El precio quedó fijado en el acuerdo, así que no se cambia desde acá.
            Todo lo demás —la descripción, qué incluye, la foto— lo seguís
            manejando vos. Para mover el precio, escribinos.
          </p>
        </div>
      )}

      <FormularioTour
        tour={tour}
        negocioId={id}
        destinoBabosa={negocio.destino_babosa}
        negocioBabosa={negocio.babosa}
        otrosIdiomas={otrosIdiomas}
        traducciones={traducciones}
      />

      {/* La GALERÍA, fuera del formulario del tour.
          ⚠️ Fuera y no adentro: HTML no permite formularios anidados, y los
          botones de cada foto son formularios. Adentro, el navegador se los
          come y «Hacerla portada» terminaría guardando el tour.
          Antes acá solo cabía UNA foto, y eso volvía mentiroso el correo que
          le pide al operador «subí tres o cuatro». */}
      <FotosTour
        tourId={tour.id}
        destinoBabosa={negocio.destino_babosa}
        negocioBabosa={negocio.babosa}
        fotos={fotos}
        minimoFotos={MINIMO_FOTOS_TOUR}
      />

      {/* El itinerario, también FUERA del formulario del tour: cada parada
          trae sus propios botones, y HTML no permite formularios anidados. */}
      <ParadasTour tourId={tour.id} negocioId={id} paradas={paradas} lugares={lugares} />

      {/* Mandar a revisión solo desde borrador: una publicada que volviera a
          revisión se caería del sitio sola, y eso no lo decide el operador. */}
      {tour.estado === 'borrador' && (
        <form action={mandarMiTourARevision} className="tour-enviar">
          <input type="hidden" name="tour_id" value={tour.id} />
          <input type="hidden" name="negocio_id" value={id} />
          <div>
            <strong>¿Está lista?</strong>
            <span>
              {sinPrecio
                ? 'Primero ponele precio de adulto y guardá. Sin precio no se puede mandar.'
                : 'La revisamos y te avisamos por correo cuando salga publicada.'}
            </span>
          </div>
          <button className="boton" type="submit" disabled={sinPrecio}>
            Mandar a revisión
          </button>
        </form>
      )}

      {/* Borrar solo lo que todavía no vive en ninguna parte. */}
      {tour.estado !== 'publicado' && tour.total_reservas === 0 && (
        <form action={borrarMiTour} className="tour-borrar">
          <input type="hidden" name="tour_id" value={tour.id} />
          <input type="hidden" name="negocio_id" value={id} />
          <button className="boton peligro tenue" type="submit">Borrar esta tour</button>
        </form>
      )}
    </>
  );
}
