import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe, tourPorBabosa } from '@/lib/destino';
import { tourReservable } from '@/lib/reservas';
import { ReservarProducto } from '@/componentes/ReservarProducto';
import { textoRicoAHtml } from '@/lib/texto-rico';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';

/*
 * La página de una tour.
 *
 * Hasta hoy las tours existían solo para el agente de IA y el planificador: no
 * tenían dirección propia, así que no se podían enlazar, ni compartir, ni
 * encontrar en Google. Una tour que no se puede enlazar no se vende.
 *
 * El segmento es `tour` literal y no cae en `[categoria]`: en el App Router un
 * tramo fijo le gana a uno dinámico, así que /es/tour/x nunca se confunde con
 * la ficha de un negocio.
 *
 * Si la tour tiene CONTRATO ACTIVO se reserva acá mismo, con el mismo widget
 * de las fichas. Si no lo tiene, la tour sigue existiendo como catálogo y el
 * botón manda a la ficha del operador: un botón que promete lo que no hace
 * cuesta más que no tenerlo.
 *
 * Quién decide eso es la base (`tour_reservable`), no esta página. Acá no hay
 * ninguna regla de negocio que se pueda desincronizar.
 */

export const dynamic = 'force-dynamic';

type Parametros = Promise<{ idioma: Idioma; babosa: string }>;

export async function generateMetadata({ params }: { params: Parametros }): Promise<Metadata> {
  const { babosa } = await params;
  try {
    const destino = await destinoActual();
    const tour = await tourPorBabosa(destino, babosa);
    if (!tour) return {};
    return { title: tour.nombre, description: tour.resumen ?? undefined };
  } catch {
    return {};
  }
}

/* Las listas de "incluye" y "no incluye" se escriben una por línea. */
const enLineas = (texto: string | null) =>
  (texto ?? '').split('\n').map((x) => x.trim()).filter(Boolean);

export default async function PaginaTour({ params }: { params: Parametros }) {
  const { idioma, babosa } = await params;
  const destino = await destinoActual();
  const tour = await tourPorBabosa(destino, babosa);
  if (!tour) notFound();

  const categorias = await categoriasDe(destino, idioma);
  const vendible = await tourReservable(destino, babosa, idioma);
  const incluye = enLineas(tour.incluye);
  const noIncluye = enLineas(tour.no_incluye);
  const cuerpo = textoRicoAHtml(tour.descripcion);

  const datos: { que: string; valor: string }[] = [
    ...(tour.duracion_horas != null ? [{ que: t('tour_duracion', idioma), valor: `${tour.duracion_horas} h` }] : []),
    ...(tour.hora_inicio ? [{ que: t('tour_salida', idioma), valor: tour.hora_inicio.slice(0, 5) }] : []),
    ...(tour.dificultad ? [{ que: t('tour_dificultad', idioma), valor: tour.dificultad }] : []),
    ...(tour.edad_minima != null ? [{ que: t('tour_edad', idioma), valor: `${tour.edad_minima}+` }] : []),
    ...(tour.cupo_maximo != null ? [{ que: t('tour_cupo', idioma), valor: `${tour.cupo_maximo}` }] : []),
    ...(tour.idiomas_guia?.length ? [{ que: t('tour_idiomas', idioma), valor: tour.idiomas_guia.join(', ').toUpperCase() }] : []),
  ];

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual="" />

      <main>
        {/* Con foto, la cabecera va a sangre y el texto en blanco encima.
            SIN foto NO se puede reusar `.ficha-hero-texto`: esa clase pinta de
            blanco porque da por hecho que hay una foto oscura debajo, y sin
            ella el título queda blanco sobre blanco — invisible, no feo. */}
        <section className={tour.imagen_url ? 'ficha-hero' : 'tour-cabecera'}>
          {tour.imagen_url && (
            <>
              <img className="ficha-hero-foto" src={tour.imagen_url} alt="" />
              <div className="ficha-hero-velo" />
            </>
          )}
          <div className={`caja ${tour.imagen_url ? 'ficha-hero-texto' : 'tour-cabecera-texto'}`}>
            <div className="migas">
              <Link href={`/${idioma}`}>{t('inicio', idioma)}</Link>
              <span>/</span>
              {/* Un OPERADOR no tiene ficha: su nombre va como texto. Enlazarlo
                  seria mandar a un 404, y mostrarlo igual importa — la gente
                  quiere saber quien lleva la tour. */}
              {tour.negocio ? (
                <>
                  {tour.negocio.es_operador ? (
                    <span>{tour.negocio.nombre}</span>
                  ) : (
                    <Link href={`/${idioma}/${tour.negocio.categoria_babosa ?? 'tours'}/${tour.negocio.babosa}`}>
                      {tour.negocio.nombre}
                    </Link>
                  )}
                  <span>/</span>
                </>
              ) : null}
              <span style={{ color: 'var(--blanco)' }}>{tour.nombre}</span>
            </div>
            <h1>{tour.nombre}</h1>
            {tour.resumen && <p className="ficha-sub">{tour.resumen}</p>}
          </div>
        </section>

        <div className="caja">
          <div className="ficha-cuerpo">
            <div className="ficha-principal">

              {datos.length > 0 && (
                <ul className="tour-ficha-datos">
                  {datos.map((d) => (
                    <li key={d.que}>
                      <span>{d.que}</span>
                      <strong>{d.valor}</strong>
                    </li>
                  ))}
                  {tour.recoge_en_hotel && (
                    <li>
                      <span>{t('tour_recoge', idioma)}</span>
                      <strong>{t('si', idioma)}</strong>
                    </li>
                  )}
                </ul>
              )}

              {cuerpo && (
                /* El HTML lo generó `textoRicoAHtml` a partir de marcas: no se
                   parsea HTML de nadie, se escribe acá. Ver lib/texto-rico.ts. */
                <div className="blog-prosa" style={{ marginTop: 28 }}
                     dangerouslySetInnerHTML={{ __html: cuerpo }} />
              )}

              {(incluye.length > 0 || noIncluye.length > 0) && (
                <div className="tour-listas">
                  {incluye.length > 0 && (
                    <div className="bloque">
                      <div className="titulo">{t('tour_incluye', idioma)}</div>
                      <ul className="tour-marcas">
                        {incluye.map((x) => (
                          <li key={x}>
                            <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true">
                              <circle cx="10" cy="10" r="8.6" fill="var(--verde)" />
                              <path d="M6 10.3l2.6 2.5L14 7.6" fill="none" stroke="#fff"
                                    strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            {x}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {noIncluye.length > 0 && (
                    <div className="bloque">
                      <div className="titulo">{t('tour_no_incluye', idioma)}</div>
                      <ul className="tour-marcas apagada">
                        {noIncluye.map((x) => (
                          <li key={x}>
                            <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true">
                              <circle cx="10" cy="10" r="8.6" fill="none" stroke="var(--humo)" strokeWidth="1.7" />
                              <path d="M7 7l6 6M13 7l-6 6" stroke="var(--humo)" strokeWidth="1.9" strokeLinecap="round" />
                            </svg>
                            {x}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {tour.que_llevar && (
                <div className="bloque" style={{ marginTop: 16 }}>
                  <div className="titulo">{t('tour_llevar', idioma)}</div>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{tour.que_llevar}</p>
                </div>
              )}
            </div>

            <aside className="ficha-lado">
              <div className="ficha-reservar">
                {vendible ? (
                  <ReservarProducto producto={vendible} idioma={idioma} esTour />
                ) : (
                <div className="reservar">
                  <div className="reservar-cabeza">
                    <div>
                      <h2>{t('tour_precio', idioma)}</h2>
                      {tour.negocio && <p className="reservar-que">{tour.negocio.nombre}</p>}
                    </div>
                    <div className="reservar-precio">
                      <ul className="reservar-tarifas">
                        <li>
                          <span>{t('reserva_adulto_uno', idioma)}</span>
                          <strong>${Number(tour.precio_adulto_usd).toFixed(0)}</strong>
                        </li>
                        {tour.precio_nino_usd != null && (
                          <li>
                            <span>{t('reserva_nino_uno', idioma)}</span>
                            <strong>${Number(tour.precio_nino_usd).toFixed(0)}</strong>
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Sin contrato no se reserva acá. Si el operador tiene ficha,
                      se manda ahí; si no la tiene, no hay a dónde mandar y el
                      botón no sale — un botón que no lleva a ninguna parte es
                      peor que ninguno. */}
                  {tour.negocio && !tour.negocio.es_operador && (
                    <Link className="boton"
                          href={`/${idioma}/${tour.negocio.categoria_babosa ?? 'tours'}/${tour.negocio.babosa}#reservar`}
                          style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>
                      {t('tour_consultar', idioma)}
                    </Link>
                  )}

                  <small className="reservar-letra" style={{ marginTop: 12, display: 'block' }}>
                    {t('tour_cancelacion', idioma)} {tour.cancelacion_libre_horas} h.
                  </small>
                  {tour.negocio && (
                    <small className="reservar-presta">
                      {t('reserva_quien_presta', idioma)}:{' '}
                      <strong>{tour.negocio.nombre}</strong>
                    </small>
                  )}
                </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Pie destino={destino} />
    </>
  );
}
