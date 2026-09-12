import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe, negocioPorBabosa, notasExternasDe, seccionesDe, horarioDe, etiquetasDe, SIMBOLO_PRECIO } from '@/lib/destino';
import { nota, resenasDe } from '@/lib/resenas';
import { resenas as resenasPalabra, t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { IconoVerificado } from '@/componentes/Marca';
import { Volcanes } from '@/componentes/Volcanes';
import { Calificar } from '@/componentes/Calificar';

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
      alternates: { canonical: `/${idioma}/${n.categoria_babosa}/${n.babosa}` },
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

  const [categorias, externas, propias, secciones, horario, etiquetas] = await Promise.all([
    categoriasDe(destino, idioma),
    notasExternasDe(negocio.id),
    resenasDe(negocio.id),
    seccionesDe(negocio.id, idioma),
    horarioDe(negocio.id),
    etiquetasDe(negocio.id, idioma),
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
  const mapa = negocio.latitud && negocio.longitud
    ? `https://www.google.com/maps/search/?api=1&query=${negocio.latitud},${negocio.longitud}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${negocio.nombre} ${destino.nombre}`)}`;

  // Solo las reseñas propias entran en el marcado. Presentar las notas de
  // Google como nuestras sería engañar al buscador.
  const marcado = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: negocio.nombre,
    description: negocio.descripcion ?? undefined,
    telephone: negocio.telefono ?? undefined,
    url: negocio.sitio_web ?? undefined,
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

      <section style={{ paddingTop: 26, paddingBottom: 34 }}>
        <div className="caja">
          <div className="meta" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <span className="etiqueta-cat">{negocio.categoria_nombre}</span>
            {verificado
              ? <span className="sello"><IconoVerificado />{t('verificado', idioma)}</span>
              : <span className="sello sello-tenue">{t('por_confirmar', idioma)}</span>}
          </div>
          <h1>{negocio.nombre}</h1>
          {negocio.direccion && (
            <p style={{ color: 'var(--humo)', marginTop: 14 }}>{negocio.direccion}</p>
          )}
        </div>
      </section>

      <div className="caja">
        <div className="ficha-cuerpo">
          <div>
            {negocio.descripcion && (
              <>
                <h2 style={{ fontSize: 24, marginBottom: 14 }}>{t('sobre', idioma)} {negocio.nombre}</h2>
                <p style={{ fontSize: 17, lineHeight: 1.65, color: '#D6D4D0' }}>{negocio.descripcion}</p>
              </>
            )}
            {negocio.como_llegar && (
              <p style={{ fontSize: 15, color: 'var(--humo)', marginTop: 18 }}>{negocio.como_llegar}</p>
            )}

            {generales.length > 0 && (
              <div className="pastillas">
                {generales.map((e) => <span key={e.babosa}>{e.nombre}</span>)}
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
                  <p className="cuantas" style={{ margin: 0 }}>{t('escribi_primera', idioma)}</p>
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

            <div className="bloque">
              <div className="titulo">{t('otras_plataformas', idioma)}</div>
              {externas.length > 0 ? externas.map((e) => (
                <div key={e.plataforma}>
                  <div className="fila-externa">
                    <span className="fuente" style={{ textTransform: 'capitalize' }}>{e.plataforma}</span>
                    <span className="nota">{e.calificacion ? nota(e.calificacion, idioma) : '—'}</span>
                    <span className="conteo">{e.total_resenas?.toLocaleString(idioma) ?? ''}</span>
                    <a href={e.url_fuente} target="_blank" rel="noopener noreferrer nofollow"
                       style={{ color: 'var(--naranja)', fontWeight: 700, fontSize: 13 }}>↗</a>
                  </div>

                  {/* El texto ajeno se muestra como cita: con el nombre del
                      autor tal cual aparece en la fuente y el enlace a la
                      reseña original. Sin eso no es cita, es apropiación. */}
                  {e.extractos.map((x) => (
                    <blockquote className="extracto" key={x.url_original + x.autor_nombre}>
                      <div className="quien">
                        <strong>{x.autor_nombre}</strong>
                        {x.calificacion && <span className="nota-ajena">{x.calificacion}/5</span>}
                        <span style={{ textTransform: 'capitalize' }}>{e.plataforma}</span>
                        {x.publicada_en && (
                          <span>{new Date(x.publicada_en).toLocaleDateString(idioma, { year: 'numeric', month: 'long' })}</span>
                        )}
                      </div>
                      <p>{x.texto}</p>
                      <a href={x.url_original} target="_blank" rel="noopener noreferrer nofollow">
                        {t('ver_en', idioma)} {e.plataforma} ↗
                      </a>
                    </blockquote>
                  ))}
                </div>
              )) : (
                <p style={{ color: 'var(--humo)', fontSize: 14, margin: 0 }}>
                  {t('sin_externas', idioma)}
                </p>
              )}
              {externas.some((e) => e.plataforma === 'google' && e.extractos.length > 0) && (
                <p className="atribucion">{t('datos_de_google', idioma)}</p>
              )}
            </div>
          </div>

          <aside>
            <div className="bloque">
              <div className="titulo">{t('contacto', idioma)}</div>

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

            {negocio.rango_precio && (
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

      <Pie destino={destino} />
    </>
  );
}
