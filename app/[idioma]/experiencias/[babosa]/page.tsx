import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe } from '@/lib/destino';
import { experienciaPorBabosa } from '@/lib/experiencias';
import { htmlDeConfianza } from '@/lib/html-de-confianza';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { Pestanas } from './Pestanas';
import { FormularioConsulta } from './FormularioConsulta';

export const dynamic = 'force-dynamic';

type Parametros = Promise<{ idioma: Idioma; babosa: string }>;

export async function generateMetadata({ params }: { params: Parametros }): Promise<Metadata> {
  const { idioma, babosa } = await params;
  try {
    const destino = await destinoActual();
    const exp = await experienciaPorBabosa(destino, babosa, idioma);
    if (!exp) return {};
    return {
      title: `${exp.titulo} · ${destino.nombre}`,
      description: exp.resumen ?? exp.subtitulo ?? undefined,
      openGraph: exp.imagen_url ? { images: [exp.imagen_url] } : undefined,
    };
  } catch {
    return {};
  }
}

export default async function FichaExperiencia({ params }: { params: Parametros }) {
  const { idioma, babosa } = await params;
  const destino = await destinoActual();

  const [categorias, exp] = await Promise.all([
    categoriasDe(destino, idioma),
    experienciaPorBabosa(destino, babosa, idioma),
  ]);
  if (!exp) notFound();

  /* Una pestaña vacía no se pinta: un viaje al que todavía no le escribieron
     las atracciones no debe mostrar una solapa que no lleva a nada. */
  const solapas = [
    { clave: 'general', titulo: t('exp_tab_general', idioma), contenido: htmlDeConfianza(exp.cuerpo_html) },
    { clave: 'dias', titulo: t('exp_tab_dias', idioma), contenido: htmlDeConfianza(exp.dia_a_dia_html) },
    { clave: 'lugares', titulo: t('exp_tab_lugares', idioma), contenido: htmlDeConfianza(exp.atracciones_html) },
  ].filter((s) => s.contenido.trim().length > 0);

  const precio = exp.precio_desde_usd === null
    ? null
    : Number(exp.precio_desde_usd).toLocaleString('en-US');

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual="/experiencias" />

      <main className="exp-ficha">
        <header className="exp-hero">
          {exp.imagen_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={exp.imagen_url} alt="" className="exp-hero-foto" />
          )}
          <div className="exp-hero-velo" aria-hidden="true" />

          <div className="caja exp-hero-texto">
            <Link href={`/${idioma}/experiencias`} className="exp-volver">
              ← {t('experiencias', idioma)}
            </Link>

            {exp.zonas.length > 0 && (
              <span className="exp-hero-zonas">{exp.zonas.join(' · ')}</span>
            )}
            <h1>{exp.titulo}</h1>
            {exp.subtitulo && <p className="exp-hero-bajada">{exp.subtitulo}</p>}

            <dl className="exp-hero-datos">
              <div>
                <dt>{t('exp_hero_donde', idioma)}</dt>
                <dd>{exp.zonas.join(' · ') || destino.nombre}</dd>
              </div>
              <div>
                <dt>{t('exp_hero_cuanto', idioma)}</dt>
                <dd>
                  {exp.dias} {t('exp_dias', idioma)}
                  {exp.noches ? ` · ${exp.noches} ${t('exp_noches', idioma)}` : ''}
                </dd>
              </div>
              {precio && (
                <div>
                  <dt>{t('exp_hero_desde', idioma)}</dt>
                  <dd className="exp-hero-precio">${precio} <small>{t('exp_por_persona', idioma)}</small></dd>
                </div>
              )}
            </dl>
          </div>
        </header>

        <div className="caja exp-ficha-reja">
          <article className="exp-panel">
            {exp.ideal_para.length > 0 && (
              <div className="exp-ideal">
                <span className="exp-ideal-rotulo">{t('exp_ideal_para', idioma)}</span>
                <ul>
                  {exp.ideal_para.map((quien) => (
                    <li key={quien}>{quien}</li>
                  ))}
                </ul>
              </div>
            )}

            <Pestanas solapas={solapas} />
          </article>

          <aside className="exp-columna">
            <div className="exp-caja-consulta">
              {precio && (
                <div className="exp-caja-precio">
                  <small>{t('exp_desde', idioma)}</small>
                  <strong>${precio}</strong>
                  <small>{t('exp_por_persona', idioma)}</small>
                </div>
              )}
              <h2>{t('exp_consultar', idioma)}</h2>
              <FormularioConsulta
                idioma={idioma}
                babosa={exp.babosa}
                titulo={exp.titulo}
                personas={exp.personas}
              />
            </div>

            <p className="exp-letra-chica">{t('exp_precio_nota', idioma)}</p>

            <ul className="exp-confianza">
              <li>
                <strong>{t('exp_conf_1', idioma)}</strong>
                <span>{t('exp_conf_1_det', idioma)}</span>
              </li>
              <li>
                <strong>{t('exp_conf_2', idioma)}</strong>
                <span>{t('exp_conf_2_det', idioma)}</span>
              </li>
              <li>
                <strong>{t('exp_conf_3', idioma)}</strong>
                <span>{t('exp_conf_3_det', idioma)}</span>
              </li>
            </ul>
          </aside>
        </div>
      </main>

      <Pie destino={destino} categorias={categorias} idioma={idioma} />
    </>
  );
}
