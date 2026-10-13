import Link from 'next/link';
import { notFound } from 'next/navigation';
import { miNegocio, misTours, ESTADO_TOUR } from '@/lib/comercio';
import { NuevaTour } from './NuevaTour';

/*
 * Las tours del operador, en su propio portal.
 *
 * Hasta hoy esto solo existía en el panel del equipo: un operador con doce
 * tours tenía que mandarlas por correo y alguien las tecleaba. El contenido
 * —qué es la tour, qué incluye, la foto— es suyo y lo conoce él; lo que no es
 * suyo es el precio una vez firmado, el contrato y la comisión, y nada de eso
 * aparece acá.
 *
 * Nace en BORRADOR y la publica el equipo. Igual que la ficha: lo que sale al
 * sitio lo revisa alguien antes.
 */

export const dynamic = 'force-dynamic';

export default async function MisTours({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // miNegocio sale de mis_negocios, que ya filtra por quién llama: si no es
  // suyo no aparece, y esto es un 404.
  const negocio = await miNegocio(id);
  if (!negocio) notFound();

  const tours = await misTours(id);

  return (
    <>
      <Link href={`/negocio/${id}`} className="comercio-volver">← {negocio.nombre}</Link>

      <div className="comercio-cabecera">
        <div>
          <span className="comercio-cat">{negocio.nombre}</span>
          <h1>Mis tours</h1>
        </div>
      </div>

      <p className="comercio-sub" style={{ marginTop: -8 }}>
        Cargá acá lo que vendés. Cada tour nace en borrador: la ves solo vos
        hasta que la mandés a revisión y el equipo la publique.
      </p>

      {tours.length === 0 ? (
        <div className="comercio-vacio">
          <p>Todavía no cargaste ninguna tour.</p>
        </div>
      ) : (
        <div className="tour-tarjetas">
          {tours.map((t) => {
            const estado = ESTADO_TOUR[t.estado] ?? ESTADO_TOUR.borrador;
            return (
              <Link key={t.id} href={`/negocio/${id}/tours/${t.id}`} className="tour-tarjeta">
                <div className="tour-tarjeta-foto">
                  {t.imagen_url
                    ? <img src={t.imagen_url} alt="" loading="lazy" decoding="async" />
                    : <span>Sin foto</span>}
                </div>
                <div className="tour-tarjeta-datos">
                  <h2>{t.nombre}</h2>
                  {t.resumen && <p>{t.resumen}</p>}
                  <div className="tour-tarjeta-pie">
                    <span className="comercio-estado" style={{ color: estado.color }}>
                      ● {estado.texto}
                    </span>
                    <strong>
                      {t.precio_adulto_usd > 0 ? `$${t.precio_adulto_usd}` : 'sin precio'}
                    </strong>
                    {t.total_reservas > 0 && (
                      <span className="gris">{t.total_reservas} reserva{t.total_reservas === 1 ? '' : 's'}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <NuevaTour negocioId={id} />
    </>
  );
}
