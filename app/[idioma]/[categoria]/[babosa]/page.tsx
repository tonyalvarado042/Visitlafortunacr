import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe, negocioPorBabosa, notasExternasDe, SIMBOLO_PRECIO } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { IconoVerificado } from '@/componentes/Marca';

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

  const [categorias, externas] = await Promise.all([
    categoriasDe(destino, idioma),
    notasExternasDe(negocio.id),
  ]);

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

            <div className="bloque" style={{ marginTop: 34 }}>
              <div className="titulo">{t('otras_plataformas', idioma)}</div>
              {externas.length > 0 ? externas.map((e) => (
                <div className="fila-externa" key={e.plataforma}>
                  <span className="fuente" style={{ textTransform: 'capitalize' }}>{e.plataforma}</span>
                  <span className="nota">{e.calificacion?.toFixed(1).replace('.', ',') ?? '—'}</span>
                  <span className="conteo">{e.total_resenas?.toLocaleString(idioma) ?? ''}</span>
                  <a href={e.url_fuente} target="_blank" rel="noopener noreferrer nofollow"
                     style={{ color: 'var(--naranja)', fontWeight: 700, fontSize: 13 }}>↗</a>
                </div>
              )) : (
                <p style={{ color: 'var(--humo)', fontSize: 14, margin: 0 }}>
                  {t('sin_resenas', idioma)}
                </p>
              )}
              <div className="fila-externa">
                <span className="fuente" style={{ color: 'var(--naranja)' }}>{destino.marca_sigla}</span>
                <span className="conteo">
                  {negocio.total_resenas > 0
                    ? `${negocio.promedio_calificacion?.toFixed(1).replace('.', ',')} · ${negocio.total_resenas}`
                    : t('sin_resenas', idioma)}
                </span>
                <span style={{ color: 'var(--naranja)', fontWeight: 700, fontSize: 13 }}>
                  {t('escribi_primera', idioma)} →
                </span>
              </div>
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
