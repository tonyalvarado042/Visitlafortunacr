import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe, tourPorBabosa } from '@/lib/destino';
import { fichasDelDirectorio, alAzarDelDirectorio } from '@/lib/directorio';
import { TarjetaNegocio } from '@/componentes/TarjetaNegocio';
import { FotosArriba, GaleriaAbajo, VisoresFotos } from '@/componentes/GaleriaNegocio';
import { tourReservable } from '@/lib/reservas';
import { ReservarProducto } from '@/componentes/ReservarProducto';
import { BloqueResenas } from '@/componentes/BloqueResenas';
import { resenasDeTour } from '@/lib/resenas';
import { VideoNegocio } from '@/componentes/VideoNegocio';
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
  const { idioma, babosa } = await params;
  try {
    const destino = await destinoActual();
    /* El idioma también acá, y no solo en la página: el título y la
       descripción de esta función son lo que se lee en Google y lo que sale
       al compartir el enlace. Una ficha traducida con el título en español en
       el buscador se pierde justo donde se decide el clic. */
    const tour = await tourPorBabosa(destino, babosa, idioma);
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
  const tour = await tourPorBabosa(destino, babosa, idioma);

  /* Las reseñas de ESTA tour. Se piden solo si la tour existe —si no, la
     página va al 404 unas líneas más abajo y la consulta se habría tirado. */
  const resenasPropias = tour ? await resenasDeTour(tour.id) : [];
  const negocioIdDeLaTour = tour?.negocio_id ?? '';

  /* Las fotos del tour se mapean al tipo de las fichas para poder reusar la
     MISMA galería: tres grandes arriba, la tira con el «+N» más abajo y el
     visor a pantalla completa, todo sin una línea de JavaScript en el cliente.
     Escribir una galería aparte para tours sería mantener dos. */
  const fotos = (tour?.fotos ?? []).map((f) => ({
    url: f.url,
    texto_alternativo: (idioma === 'es' ? f.texto_alternativo_es : f.texto_alternativo_en)
      ?? f.texto_alternativo_es,
    credito: f.credito,
    licencia: f.licencia,
    fuente_url: f.fuente_url,
    /* Un tour no tiene fotos genéricas de categoría: las suyas son suyas. */
    es_generica: false,
    es_portada: f.es_portada,
  }));
  /* La portada: la primera de la galería, y si no hay galería la foto vieja.
     Ese respaldo importa mientras quede algún tour cargado antes de que
     existiera la galería. */
  const portada = fotos[0]?.url ?? tour?.imagen_url ?? null;
  if (!tour) notFound();

  const categorias = await categoriasDe(destino, idioma);
  const vendibleCrudo = await tourReservable(destino, babosa, idioma);
  /* ⚠️ El nombre del operador NO VIAJA AL NAVEGADOR. No alcanzaba con no
     pintarlo: `ReservarProducto` corre en el cliente, así que todo lo que se
     le pasa termina serializado en el HTML. El nombre se leía con ver-código
     aunque en pantalla no estuviera. Lo que no se debe revelar no se manda. */
  const vendible = vendibleCrudo
    ? { ...vendibleCrudo, negocio_nombre: '' }
    : null;
  /* Lo que se ofrece abajo. Sale del directorio UNIFICADO, así que mezcla
     tours y negocios: quien mira una clase de cocina puede querer otro tour,
     pero también el restaurante de al lado.

     Primero los de la misma categoría —quien mira cuadraciclos quiere ver
     cuadraciclos— y el resto detrás, para no dejar la sección vacía cuando la
     categoría tiene una sola cosa. */
  /* AL AZAR, y mezclando negocios con tours — lo pidió Tony así: «debe ser
     random de negocios y tours». Es para descubrir, no para recomendar algo
     parecido: quien ya está mirando este tour no necesita ver cuatro casi
     iguales.
     La página es `force-dynamic`, así que cambia en cada visita. */
  const relacionadas = alAzarDelDirectorio(
    (await fichasDelDirectorio(destino, idioma, categorias))
      .filter((f) => !(f.tipo === 'tour' && f.id === tour.id)),
    4,
  );
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
      {/* La babosa de una tour es UNA sola para todos los idiomas, así que
          acá el prefijo alcanza. Lo que estaba mal era mandar `""`: cambiar
          de idioma te sacaba de la tour y te dejaba en la portada. */}
      <Barra destino={destino} idioma={idioma} categorias={categorias}
             rutaActual={`/tour/${tour.babosa}`} />

      <main>
        {/* Con foto, la cabecera va a sangre y el texto en blanco encima.
            SIN foto NO se puede reusar `.ficha-hero-texto`: esa clase pinta de
            blanco porque da por hecho que hay una foto oscura debajo, y sin
            ella el título queda blanco sobre blanco — invisible, no feo. */}
        <section className={portada ? 'ficha-hero' : 'tour-cabecera'}>
          {portada && (
            <>
              <img className="ficha-hero-foto" src={portada} alt="" />
              <div className="ficha-hero-velo" />
            </>
          )}
          <div className={`caja ${portada ? 'ficha-hero-texto' : 'tour-cabecera-texto'}`}>
            <div className="migas">
              <Link href={`/${idioma}`}>{t('inicio', idioma)}</Link>
              <span>/</span>
              {/* ⚠️ Un OPERADOR no se nombra acá tampoco. Antes salía como
                  texto suelto —no tiene ficha, así que enlazarlo daría 404— y
                  el comentario viejo decía que mostrarlo «importa». Importa lo
                  contrario: quien lee el nombre lo busca y reserva directo.
                  Un NEGOCIO con ficha sí va, y enlazado: ahí el negocio es lo
                  que la persona está buscando, y ya está listado entero con su
                  teléfono. */}
              {tour.negocio && !tour.negocio.es_operador ? (
                <>
                  <Link href={`/${idioma}/${tour.negocio.categoria_babosa ?? 'tours'}/${tour.negocio.babosa}`}>
                    {tour.negocio.nombre}
                  </Link>
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
          {/* `ficha-con-hero` es lo que sube la columna derecha -132px sobre
              la foto a sangre, igual que en la ficha de un negocio. Sin esta
              clase la caja del precio arrancaba EXACTAMENTE donde terminaba
              la imagen —medido: hero hasta 572px, caja desde 572px— y se veía
              pegada. Solo con foto: sin hero no hay sobre qué montarse. */}
          <div className={`ficha-cuerpo${portada ? ' ficha-con-hero' : ''}`}>
            <div className="ficha-principal">

              {/* Las tres grandes. La misma galería de las fichas de negocio:
                  no hay una segunda escrita para tours. */}
              <FotosArriba fotos={fotos} idioma={idioma} />

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

              {/* El video, DESPUES de la descripcion y no antes: primero se
                  lee de que se trata el tour, despues se mira. Mismo orden que
                  en la ficha de negocio, por la misma razon.
                  Se reusa VideoNegocio: ya resuelve YouTube, Vimeo y archivo
                  del bucket, asi que el tour no necesita su propio reproductor. */}
              {tour.video_url && (
                <VideoNegocio
                  url={tour.video_url}
                  portada={tour.video_portada_url}
                  nombre={tour.nombre}
                  idioma={idioma}
                />
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

              {/* La tira con el «+N». Arriba van las tres que venden; esta
                  dice «hay más, mirá». Se calla sola si no sobran fotos. */}
              <GaleriaAbajo fotos={fotos} idioma={idioma} />

              {/* Las reseñas DE ESTA TOUR, no las del operador.
                  Es la diferencia que importa y la que hace GetYourGuide: la
                  nota de un operador con diez tours no dice nada de la que uno
                  está mirando. El bloque es el MISMO componente que usa la
                  ficha de un negocio — ver componentes/BloqueResenas.tsx.
                  Y va debajo de las fotos a propósito: quien llegó hasta acá
                  ya sabe qué es la tour y lo que le falta es que alguien más
                  se la recomiende. */}
              {tour.negocio && (
                <BloqueResenas
                  idioma={idioma}
                  total={tour.total_resenas}
                  promedio={tour.promedio_calificacion}
                  resenas={resenasPropias}
                  negocioId={negocioIdDeLaTour}
                  negocioNombre={tour.nombre}
                  tourId={tour.id}
                  estilo={{ marginTop: 34 }}
                />
              )}
            </div>

            <aside className="ficha-lado">
              <div className="ficha-reservar">
                {vendible ? (
                  <ReservarProducto producto={vendible} descuentoHasta={destino.descuento_lanzamiento_hasta}
                                    leyenda={destino.leyenda_precio} idioma={idioma} esTour />
                ) : (
                <div className="reservar">
                  <div className="reservar-cabeza">
                    <div>
                      <h2>{t('tour_precio', idioma)}</h2>
                      {/* ⚠️ NO VA EL NOMBRE DEL OPERADOR. Decía el nombre, y
                          eso es regalarle el cliente: quien lo lee lo busca en
                          Google y reserva directo con él. Se dice QUÉ es y no
                          CUÁL. La ficha de un NEGOCIO sí lleva nombre — ahí el
                          negocio ES lo que la persona está buscando. */}
                      <p className="reservar-que">{t('tour_quien_opera', idioma)}</p>
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
                      {/* La letra chica. Sin esto la ficha muestra «$101» y
                          el viajero paga $114 (+13% de IVA), o cree que es
                          por persona cuando el cuadraciclo se cobra por
                          vehículo. Un precio que no es el precio es peor que
                          no mostrar precio. */}
                      {tour.precio_nota && (
                        <p className="reservar-nota">{tour.precio_nota}</p>
                      )}
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
                  {/* Mismo motivo: qué, no cuál. Y se promete decir cuál al
                      confirmar, que es lo que vuelve honesta la reserva en vez
                      de solo opaca. */}
                  <small className="reservar-presta">
                    {t('tour_quien_confirma', idioma)}
                  </small>
                </div>
                )}
              </div>

            </aside>
          </div>

          {/* RECOMENDADAS, abajo y a lo ancho — como el «combinalo con» de la
              ficha de un negocio. Empezó en la columna de al lado, y Tony
              pidió abajo: ahí caben las tarjetas de verdad, las mismas del
              directorio, en vez de filas chicas.

              Mezcla tours Y negocios a propósito. Quien está mirando una
              clase de cocina puede querer otro tour, pero también el
              restaurante de al lado: el directorio es uno solo.

              ⚠️ NO dice de quién es cada tour. El operador no se nombra en la
              ficha pública — ver la nota de la caja de precio. */}
          {relacionadas.length > 0 && (
            <section className="combina" style={{ marginTop: 8 }}>
              <h2>{t('tour_otras', idioma)}</h2>
              <div className="rejilla" style={{ marginTop: 18 }}>
                {relacionadas.map((r) => (
                  <TarjetaNegocio key={`${r.tipo}-${r.id}`} negocio={r} idioma={idioma} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* El visor va FUERA de las dos columnas y al final del documento: se
          abre con `:target`, y dentro de un contenedor con `overflow` o
          `transform` el pantalla-completa queda recortado por el padre. */}
      <VisoresFotos fotos={fotos} idioma={idioma} />

      <Pie destino={destino} />
    </>
  );
}
