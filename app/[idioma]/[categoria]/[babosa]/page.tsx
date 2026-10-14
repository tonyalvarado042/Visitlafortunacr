import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe, negocioPorBabosa, notasExternasDe, seccionesDe, horarioDe, etiquetasDe, fotosDe, toursDe, razonesDe, combinaCon, SIMBOLO_PRECIO } from '@/lib/destino';
import { nota, resenasDe } from '@/lib/resenas';
import { resenas as resenasPalabra, t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { IconoVerificado } from '@/componentes/Marca';
import { Volcanes } from '@/componentes/Volcanes';
import { Calificar } from '@/componentes/Calificar';
import { ReservarProducto } from '@/componentes/ReservarProducto';
import { productosReservables, complementosDeNegocio, cuponAlSalir } from '@/lib/reservas';
import { CuponAlSalir } from '@/componentes/CuponAlSalir';
import { FotosArriba, GaleriaAbajo, VisoresFotos } from '@/componentes/GaleriaNegocio';
import { TiraAtributos } from '@/componentes/TiraAtributos';
import { PruebaSocial } from '@/componentes/PruebaSocial';
import { VideoNegocio, BotonVerVideo } from '@/componentes/VideoNegocio';
import { ContactoTapado } from './ContactoTapado';
import { taparContacto } from '@/lib/contacto-tapado';
import { alternativas, rutasDeNegocio } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Parametros = Promise<{ idioma: Idioma; categoria: string; babosa: string }>;

export async function generateMetadata({ params }: { params: Parametros }): Promise<Metadata> {
  const { idioma, babosa } = await params;
  try {
    const destino = await destinoActual();
    const n = await negocioPorBabosa(destino, babosa, idioma);
    if (!n) return {};
    return {
      title: n.nombre,
      description: n.resumen ?? undefined,
      alternates: alternativas(idioma, await rutasDeNegocio(n.id)),
    };
  } catch {
    return {};
  }
}

export default async function Ficha({ params }: { params: Parametros }) {
  const { idioma, babosa } = await params;
  const destino = await destinoActual();
  const negocio = await negocioPorBabosa(destino, babosa, idioma);
  if (!negocio) notFound();

  const [categorias, externas, propias, secciones, horario, etiquetas, fotos, tours, razones, combina] = await Promise.all([
    categoriasDe(destino, idioma),
    notasExternasDe(negocio.id),
    resenasDe(negocio.id),
    seccionesDe(negocio.id, idioma),
    horarioDe(negocio.id),
    etiquetasDe(negocio.id, idioma),
    fotosDe(negocio.id, idioma),
    toursDe(negocio.id),
    razonesDe(negocio.id, idioma),
    combinaCon(negocio.id, idioma),
  ]);

  // El nombre del día sale de Intl y no del diccionario: son 7 palabras por 5
  // idiomas que el navegador ya sabe decir. El 4 de enero de 2026 es domingo.
  const nombreDia = (dia: number) =>
    new Date(Date.UTC(2026, 0, 4 + dia)).toLocaleDateString(idioma, { weekday: 'long', timeZone: 'UTC' });
  const hhmm = (hora: string | null) => (hora ?? '').slice(0, 5);

  // El contenido de una sección es texto plano, una línea por punto: se pega
  // desde el panel sin pelear con JSON. Aquí se parte para armar la lista.
  const lineas = (texto: string) => texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Las de accesibilidad tienen su propia sección plegable; el resto son
  // pastillas sueltas bajo la descripción.
  const accesibles = etiquetas.filter((e) => e.grupo === 'accesibilidad');
  const generales = etiquetas.filter((e) => e.grupo !== 'accesibilidad');

  const verificado = negocio.estado_verificacion === 'verificado' || negocio.estado_verificacion === 'reclamado';
  /* El widget de reserva. Si el modulo del destino esta apagado, esto
     devuelve lista vacia SIN tocar la base y la ficha queda exactamente
     como hoy. Ver los tres interruptores en lib/reservas.ts. */
  const reservables = await productosReservables(destino, babosa, idioma);
  const complementos = reservables.length ? await complementosDeNegocio(destino, babosa) : [];
  /* Solo donde se puede reservar: ofrecerle un cupón a quien mira una ficha
     que no vende es ofrecerle algo que no va a poder usar. */
  const cuponSalida = reservables.length ? await cuponAlSalir(destino) : null;

  const mapa = negocio.latitud && negocio.longitud
    ? `https://www.google.com/maps/search/?api=1&query=${negocio.latitud},${negocio.longitud}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${negocio.nombre} ${destino.nombre}`)}`;

  /* Si el destino tapa el contacto, lo tapa de verdad: ni en el HTML ni en el
     marcado. Dejar el telefono en el JSON-LD mientras la pantalla lo tapa es
     poner el muro y la llave al lado. */
  const tapar = destino.contacto_bloqueado !== false;

  /* La foto de la cabecera sale de la galeria: la portada si la hay, si no la
     primera. Sin foto no se pinta el hero — una cabecera a sangre con un
     degradado vacio se ve peor que la version normal. */
  const esDestacado = negocio.es_destacado === true;
  const fotoHero = fotos.find((f) => f.es_portada)?.url ?? fotos[0]?.url ?? null;

  // Solo las reseñas propias entran en el marcado. Presentar las notas de
  // Google como nuestras sería engañar al buscador.
  const marcado = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: negocio.nombre,
    description: negocio.descripcion ?? undefined,
    telephone: tapar ? undefined : (negocio.telefono ?? undefined),
    url: tapar ? undefined : (negocio.sitio_web ?? undefined),
    address: { '@type': 'PostalAddress', streetAddress: negocio.direccion ?? undefined,
               addressLocality: destino.nombre, addressCountry: destino.pais_nombre },
    ...(negocio.total_resenas > 0 && negocio.promedio_calificacion
      ? { aggregateRating: { '@type': 'AggregateRating',
            ratingValue: negocio.promedio_calificacion, reviewCount: negocio.total_resenas } }
      : {}),
  };

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias}
             rutaActual={`/${negocio.categoria_babosa}/${negocio.babosa}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(marcado) }} />

      <div className="caja">
        <div className="migas">
          <Link href={`/${idioma}`}>{t('inicio', idioma)}</Link>
          <span>/</span>
          <Link href={`/${idioma}/${negocio.categoria_babosa}`}>{negocio.categoria_nombre}</Link>
          <span>/</span>
          <span style={{ color: 'var(--blanco)' }}>{negocio.nombre}</span>
        </div>
      </div>

      {/* El destacado estrena cabecera: la foto a sangre detras del titulo, la
          misma que usan las experiencias. Es la diferencia que se ve de una y
          lo que hace que el plan se note sin explicarlo. */}
      <section className={esDestacado ? 'ficha-hero' : undefined}
               style={esDestacado ? undefined : { paddingTop: 26, paddingBottom: 34 }}>
        {esDestacado && fotoHero && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoHero} alt="" className="ficha-hero-foto" />
            <div className="ficha-hero-velo" aria-hidden="true" />
          </>
        )}
        <div className={esDestacado ? 'caja ficha-hero-texto' : 'caja'}>
          <div className="meta" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            {esDestacado && <span className="cintillo cintillo-suelto">{t('destacado_cintillo', idioma)}</span>}
            <span className="etiqueta-cat">{negocio.categoria_nombre}</span>
            {verificado
              ? <span className="sello"><IconoVerificado />{t('verificado', idioma)}</span>
              : <span className="sello sello-tenue">{t('por_confirmar', idioma)}</span>}
          </div>
          <h1>{negocio.nombre}</h1>
          {negocio.direccion && (
            <p style={{ color: 'var(--humo)', marginTop: 14 }}>{negocio.direccion}</p>
          )}
          {/* Arriba del todo para el que entro justamente a ver el video; el
              video en si vive mas abajo, despues de las fotos. */}
          {negocio.video_url && <BotonVerVideo idioma={idioma} />}
        </div>
      </section>

      <div className="caja">
        {/* `ficha-con-hero` solo cuando hay cabecera a sangre: es lo que deja
            que la tarjeta de reserva se monte sobre la foto. Sin foto no hay
            nada sobre lo que montarse. */}
        <div className={`ficha-cuerpo${esDestacado && fotoHero ? ' ficha-con-hero' : ''}`}>
          <div className="ficha-principal">
            {/* Los hechos primero. Quien compara tres termales no lee el
                párrafo de ninguna: busca si hay parqueo, si hay restaurante y
                a qué hora cierra. */}
            <TiraAtributos etiquetas={generales} horario={horario} idioma={idioma} />

            <FotosArriba fotos={fotos} idioma={idioma} />

            {negocio.video_url && (
              <VideoNegocio
                url={negocio.video_url}
                portada={negocio.video_portada_url}
                nombre={negocio.nombre}
                idioma={idioma}
              />
            )}

            {negocio.descripcion && (
              <>
                <h2 style={{ fontSize: 24, marginBottom: 14 }}>{t('sobre', idioma)} {negocio.nombre}</h2>
                <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--txt-0)' }}>{negocio.descripcion}</p>
              </>
            )}
            {negocio.como_llegar && (
              <p style={{ fontSize: 15, color: 'var(--humo)', marginTop: 18 }}>{negocio.como_llegar}</p>
            )}

            {/* Por qué ESTA y no otra. Es la única pregunta que importa cuando
                alguien compara tres termales, y la descripción no la responde:
                un párrafo no se compara. Si el negocio no tiene razones
                escritas, el bloque no sale. */}
            {razones.length > 0 && (
              <section className="razones">
                <div className="razones-cabeza">
                  <span className="razones-rotulo">{t('razones_rotulo', idioma)}</span>
                  <h2>{t('razones_titulo', idioma)} {negocio.nombre}</h2>
                </div>
                <div className="razones-tarjetas">
                  {razones.map((r) => (
                    <article key={r.id}>
                      {r.foto_url && (
                        <img src={r.foto_url} alt="" loading="lazy" decoding="async" />
                      )}
                      <div className="razon-texto">
                        <h3>{r.titulo}</h3>
                        {r.texto && <p>{r.texto}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* Qué incluye y qué no. Sale del producto con contrato, así que en
                un negocio donde no vendemos el bloque sencillamente no existe —
                mejor eso que inventarle una lista. */}
            {reservables[0] && (reservables[0].incluye.length > 0 || reservables[0].no_incluye.length > 0) && (
              <div className="incluye-cajas">
                {reservables[0].incluye.length > 0 && (
                  <div className="bloque incluye-si">
                    <div className="titulo">{t('tour_incluye', idioma)}</div>
                    <ul className="tour-marcas">
                      {reservables[0].incluye.map((x) => (
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
                {reservables[0].no_incluye.length > 0 && (
                  <div className="bloque">
                    <div className="titulo">{t('tour_no_incluye', idioma)}</div>
                    <ul className="tour-marcas apagada">
                      {reservables[0].no_incluye.map((x) => (
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

            {/* Plegables con <details>, como la hamburguesa de la barra: sin
                una línea de JavaScript en el cliente, y el navegador se
                encarga del teclado y del lector de pantalla. */}
            {(secciones.length > 0 || accesibles.length > 0) && (
              <div className="plegables">
                {secciones.map((sec, i) => (
                  <details className="plegable" key={sec.clave} open={i === 0}>
                    <summary>{t(`sec_${sec.clave}`, idioma)}</summary>
                    <div className="dentro">
                      {lineas(sec.contenido).length > 1 ? (
                        <ul>
                          {lineas(sec.contenido).map((linea, j) => <li key={j}>{linea}</li>)}
                        </ul>
                      ) : (
                        <p>{sec.contenido.trim()}</p>
                      )}
                    </div>
                  </details>
                ))}

                {accesibles.length > 0 && !secciones.some((x) => x.clave === 'accesibilidad') && (
                  <details className="plegable">
                    <summary>{t('sec_accesibilidad', idioma)}</summary>
                    <div className="dentro">
                      <ul>{accesibles.map((e) => <li key={e.babosa}>{e.nombre}</li>)}</ul>
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Lo que este operador lleva a la gente.
                Un operador tiene varias tours y hasta hoy no se veía ni una:
                vivían solo para la IA y el planificador. Acá quien ya está
                mirando la ficha ve qué más le pueden armar. */}
            {tours.length > 0 && (
              <div className="bloque bloque-tours" style={{ marginTop: 34 }}>
                <div className="titulo">
                  {t('sus_tours', idioma)} · {tours.length}
                </div>
                <ul className="lista-tours">
                  {tours.map((tu) => (
                    <li key={tu.id}>
                      <Link className="tour-fila" href={`/${idioma}/tour/${tu.babosa}`}>
                      {tu.imagen_url
                        ? <img src={tu.imagen_url} alt="" loading="lazy" decoding="async" />
                        : <span className="tour-sin-foto" aria-hidden="true" />}
                      <div className="tour-texto">
                        <strong>{tu.nombre}</strong>
                        {tu.resumen && <p>{tu.resumen}</p>}
                        <div className="tour-datos">
                          {tu.duracion_horas != null && <span>{tu.duracion_horas} h</span>}
                          {tu.hora_inicio && <span>sale {tu.hora_inicio.slice(0, 5)}</span>}
                          {tu.dificultad && <span>{tu.dificultad}</span>}
                          {tu.recoge_en_hotel && <span>recoge en el hotel</span>}
                        </div>
                      </div>
                      <div className="tour-precio">
                        <span className="desde">{t('desde', idioma)}</span>
                        <strong>${Number(tu.precio_adulto_usd).toFixed(0)}</strong>
                        <span className="quien">{t('por_adulto', idioma)}</span>
                      </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* La prueba social sube: es el dato que más pesa cuando alguien
                está decidiendo y vivía al final, en una tabla. */}
            <PruebaSocial externas={externas} idioma={idioma} />

            {/* El álbum completo va ANTES de las calificaciones: primero se
                ve el lugar, después lo que opinan de él. Arriba quedan las
                tres fotos que venden. */}
            <GaleriaAbajo fotos={fotos} idioma={idioma} />

            {/* Las reseñas propias van primero y aparte: son las únicas que
                cuentan para el promedio y para el marcado. Lo de Google y
                Booking va debajo, citado y enlazado a su fuente. */}
            <div className="bloque" style={{ marginTop: 34 }}>
              <div className="titulo">{t('resenas_titulo', idioma)}</div>

              <div className="resumen-nota">
                {negocio.total_resenas > 0 && negocio.promedio_calificacion ? (
                  <>
                    <div className="cifra-nota">{nota(negocio.promedio_calificacion, idioma)}</div>
                    <div>
                      <Volcanes nota={negocio.promedio_calificacion} tamano={20}
                                etiqueta={`${nota(negocio.promedio_calificacion, idioma)} ${t('de_cinco', idioma)}`} />
                      <div className="cuantas">
                        {negocio.total_resenas} {resenasPalabra(negocio.total_resenas, idioma)}
                      </div>
                    </div>
                  </>
                ) : (
                  /* Sin resenas, el bloque mantiene LA MISMA forma: la raya en
                     lugar de la nota y los cinco volcanes vacios. Antes caia a
                     una linea de texto gris de 204px de alto al lado de los
                     1086px de las citas de Google, y se leia como si las
                     resenas propias no existieran. */
                  <>
                    <div className="cifra-nota sin-nota">&mdash;</div>
                    <div>
                      <Volcanes nota={0} tamano={20} etiqueta={t('escribi_primera', idioma)} />
                      <div className="cuantas">{t('escribi_primera', idioma)}</div>
                    </div>
                  </>
                )}
              </div>

              <Calificar negocioId={negocio.id} negocioNombre={negocio.nombre} idioma={idioma} />

              {propias.map((r) => (
                <article className="resena" key={r.id}>
                  <div className="quien">
                    <Volcanes nota={r.calificacion} tamano={13}
                              etiqueta={`${r.calificacion} ${t('de_cinco', idioma)}`} />
                    <strong>{r.autor}</strong>
                    <span>
                      {new Date(r.visitado_el ?? r.creado_en).toLocaleDateString(idioma, { year: 'numeric', month: 'long' })}
                    </span>
                  </div>
                  {r.titulo && <h4>{r.titulo}</h4>}
                  <p>{r.cuerpo}</p>
                  {r.respuesta_negocio && (
                    <div className="respuesta">
                      <span>{t('respuesta_negocio', idioma)}</span>
                      <p>{r.respuesta_negocio}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>

            {/* Dónde queda y cómo llegar. La dirección de Google ya estaba
                armada arriba: con coordenadas si las hay, y con el nombre si
                no. Un mapa incrustado cargaría un rastreador de Google en cada
                ficha, y eso no se paga con lo que aporta. */}
            <div className="mapa-caja">
              <div className="mapa-texto">
                <span className="titulo">{t('donde_queda', idioma)}</span>
                <strong>{negocio.direccion || destino.nombre}</strong>
                {negocio.como_llegar && <p>{negocio.como_llegar}</p>}
              </div>
              <a className="boton" href={mapa} target="_blank" rel="noopener noreferrer">
                {t('como_llegar', idioma)} →
              </a>
            </div>

            {/* Con qué más. La gente que va a las termales casi nunca va solo
                a las termales: va a comer, necesita transporte, hace el tour el
                mismo día. Lo elige el equipo a mano — calcularlo por categoría
                recomendaría al competidor de al lado. */}
            {combina.length > 0 && (
              <section className="combina">
                <h2>{t('combina_titulo', idioma)}</h2>
                <div className="combina-tarjetas">
                  {combina.map((c) => (
                    <Link key={c.id} href={`/${idioma}/${c.categoria_babosa ?? ''}/${c.babosa}`}>
                      {c.foto_url
                        ? <img src={c.foto_url} alt="" loading="lazy" decoding="async" />
                        : <span className="combina-sin-foto" aria-hidden="true" />}
                      <span className="combina-texto">
                        {c.categoria_nombre && <span className="combina-que">{c.categoria_nombre}</span>}
                        <strong>{c.nombre}</strong>
                        {c.motivo && <span className="combina-motivo">{c.motivo}</span>}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* La atribución se queda: Google la pide cuando se citan sus
                reseñas, y se citan arriba, en la prueba social. */}
            {externas.some((e) => e.plataforma === 'google' && e.extractos.length > 0) && (
              <p className="atribucion">{t('datos_de_google', idioma)}</p>
            )}

          </div>

          {/* La columna de la derecha, y PEGADA: baja con la página para que
              reservar nunca quede fuera de pantalla. Antes el widget vivía al
              final de la columna izquierda —debajo de la galería, el video, la
              descripción y los plegables— y había que bajar media pantalla
              para encontrarlo. El comentario de arriba decía "va ARRIBA del
              todo" y no era cierto. Ahora sí. */}
          {/* `ficha-vende` baja el contacto debajo del horario. No es capricho:
              cuando nosotros vendemos, lo primero que tiene que ver quien
              quiere ir es cómo reservar, no el teléfono del negocio. Donde no
              vendemos, el teléfono ES el servicio y va de primero. El orden se
              cambia con CSS y no duplicando este bloque: dos copias del mismo
              formulario se desincronizan a la segunda semana. */}
          <aside className={`ficha-lado${reservables.length > 0 ? ' ficha-vende' : ''}`}>
            {/* UNA tarjeta, no una por producto. Con dos pases eran dos fechas,
                dos contadores de personas y dos botones de enviar para el
                mismo negocio, el mismo día y la misma gente; en el teléfono el
                segundo quedaba a dos pantallas. El pase se elige adentro. */}
            {reservables.length > 0 && (
              <div className="ficha-reservar" id="reservar">
                <ReservarProducto productos={reservables} complementos={complementos}
                                  descuentoHasta={destino.descuento_lanzamiento_hasta} idioma={idioma} />
              </div>
            )}

            <div className="bloque bloque-contacto">
              <div className="titulo">{t('contacto', idioma)}</div>

              {/* El contacto va TAPADO hasta que la persona deja sus datos, como
                  hace encuentra24. Lo que baja al navegador es solo la pista:
                  el numero entero llega despues, por la accion. Si viniera en
                  el HTML con una nube encima, se leeria con ver-codigo. */}
              {tapar ? (
                <ContactoTapado
                  negocioId={negocio.id}
                  idioma={idioma}
                  tapado={taparContacto(negocio)}
                  comoLlegar={mapa}
                  textoComoLlegar={t('como_llegar', idioma)}
                />
              ) : (
                <>
                  {negocio.telefono && (
                    <a className="linea-contacto" href={`tel:${negocio.telefono}`}>
                      <span className="dato">{negocio.telefono}</span>
                      <span className="que">{t('llamar', idioma)}</span>
                    </a>
                  )}
                  {negocio.telefono_whatsapp && (
                    <a className="linea-contacto" target="_blank" rel="noopener noreferrer"
                       href={`https://wa.me/${negocio.telefono_whatsapp.replace(/\D/g, '')}`}>
                      <span className="dato">{negocio.telefono_whatsapp}</span>
                      <span className="que">WhatsApp</span>
                    </a>
                  )}
                  {negocio.sitio_web && (
                    <a className="linea-contacto" href={negocio.sitio_web} target="_blank" rel="noopener noreferrer">
                      <span className="dato" style={{ wordBreak: 'break-all' }}>
                        {negocio.sitio_web.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </span>
                      <span className="que">{t('sitio_web', idioma)}</span>
                    </a>
                  )}
                  {negocio.email && (
                    <a className="linea-contacto" href={`mailto:${negocio.email}`}>
                      <span className="dato" style={{ wordBreak: 'break-all', fontSize: 14 }}>{negocio.email}</span>
                    </a>
                  )}

                  <a className="boton" href={mapa} target="_blank" rel="noopener noreferrer"
                     style={{ display: 'block', marginTop: 18, padding: 13 }}>
                    {t('como_llegar', idioma)}
                  </a>
                </>
              )}
            </div>

            {horario.length > 0 && (
              <div className="bloque">
                <div className="titulo">{t('horario', idioma)}</div>
                <table className="horario">
                  <tbody>
                    {horario.map((h) => (
                      <tr key={h.dia_semana}>
                        <td>{nombreDia(h.dia_semana)}</td>
                        <td>{h.esta_cerrado ? t('cerrado', idioma) : `${hhmm(h.abre_a)} – ${hhmm(h.cierra_a)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* El rango de precio se calla cuando hay tarifas de verdad: el
                widget ya muestra $47 adulto y $33 niño justo arriba, y repetir
                "$$ · sobre $47" en la misma columna es ruido. Sin reserva, el
                rango sigue siendo lo único que hay. */}
            {negocio.rango_precio && reservables.length === 0 && (
              <div className="bloque">
                <div className="titulo">{t('precio', idioma)}</div>
                <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-.03em' }}>
                  {SIMBOLO_PRECIO[negocio.rango_precio]}
                  {negocio.precio_desde_usd && (
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--humo)', marginLeft: 10 }}>
                      {t('sobre', idioma)} ${negocio.precio_desde_usd}
                    </span>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Fuera de las columnas a propósito: la izquierda es un contexto de
          apilamiento y ahí dentro el visor no puede subir sobre la tarjeta de
          reservar. Lo explica entero GaleriaNegocio.tsx. */}
      <VisoresFotos fotos={fotos} idioma={idioma} />

      {/* En el teléfono la columna de la derecha cae al final, así que el
          widget queda debajo de todo. Esta barra lo trae de vuelta: fija
          abajo, con el precio y un enlace al formulario. Es un <a> y nada
          más — ni una línea de JavaScript.

          Dice la tarifa de adulto con su nombre, no "desde": con adulto a $47
          y niño a $33, un "desde $33" es cierto y engañoso a la vez. Es el
          mismo error que ya se arregló dentro del widget. */}
      {reservables.length > 0 && (
        <a className="barra-reservar" href="#reservar">
          <span className="cuanto">
            {reservables[0].tarifas.length > 0 ? (
              <>
                <strong>${reservables[0].tarifas[0].precio}</strong>
                <span>{reservables[0].tarifas[0].nombre}</span>
              </>
            ) : (
              <span>{t('reserva_consultar', idioma)}</span>
            )}
          </span>
          <span className="boton">{t('reserva_pedir', idioma)}</span>
        </a>
      )}

      {cuponSalida && <CuponAlSalir cupon={cuponSalida} idioma={idioma} />}

      <Pie destino={destino} categorias={categorias} idioma={idioma} />
    </>
  );
}
