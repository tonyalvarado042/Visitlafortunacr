import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe } from '@/lib/destino';
import { experienciasDe } from '@/lib/experiencias';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';

export const dynamic = 'force-dynamic';

type Parametros = Promise<{ idioma: Idioma }>;

export async function generateMetadata({ params }: { params: Parametros }): Promise<Metadata> {
  const { idioma } = await params;
  try {
    const destino = await destinoActual();
    return {
      title: `${t('exp_titulo', idioma)} · ${destino.nombre}`,
      description: t('exp_bajada', idioma),
    };
  } catch {
    return {};
  }
}

export default async function Experiencias({ params }: { params: Parametros }) {
  const { idioma } = await params;
  const destino = await destinoActual();
  const [categorias, experiencias] = await Promise.all([
    categoriasDe(destino, idioma),
    experienciasDe(destino, idioma),
  ]);

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual="/experiencias" />

      <main className="caja exp-cuerpo">
        <header className="exp-cabecera">
          <span className="exp-antetitulo">{t('experiencias', idioma)}</span>
          <h1>{t('exp_titulo', idioma)}</h1>
          <p>{t('exp_bajada', idioma)}</p>
        </header>

        {experiencias.length === 0 ? (
          <p className="exp-vacio">{t('exp_nada', idioma)}</p>
        ) : (
          <div className="exp-rejilla">
            {experiencias.map((e) => (
              <article key={e.id} className="exp-tarjeta">
                <div className="exp-tarjeta-foto">
                  {e.imagen_url
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={e.imagen_url} alt="" loading="lazy" />
                    : <span className="exp-sin-foto" aria-hidden="true" />}
                  {e.zonas.length > 0 && (
                    <span className="exp-zonas">{e.zonas.join(' · ')}</span>
                  )}
                </div>

                <div className="exp-tarjeta-cuerpo">
                  <h2>{e.titulo}</h2>
                  {e.subtitulo && <p className="exp-subtitulo">{e.subtitulo}</p>}

                  <p className="exp-dato">
                    {e.dias} {t('exp_dias', idioma)}
                    {e.noches ? ` · ${e.noches} ${t('exp_noches', idioma)}` : ''}
                  </p>

                  <div className="exp-tarjeta-pie">
                    {e.precio_desde_usd !== null && (
                      <span className="exp-precio">
                        <small>{t('exp_desde', idioma)}</small>
                        <strong>${Number(e.precio_desde_usd).toLocaleString('en-US')}</strong>
                        <small>{t('exp_por_persona', idioma)}</small>
                      </span>
                    )}
                    <Link href={`/${idioma}/experiencias/${e.babosa}`} className="boton">
                      {t('exp_ver', idioma)}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <Pie destino={destino} />
    </>
  );
}
