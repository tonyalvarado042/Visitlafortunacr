import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe } from '@/lib/destino';
import { experienciaPorBabosa } from '@/lib/experiencias';
import { htmlDeConfianza } from '@/lib/html-de-confianza';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
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

  const cuerpo = htmlDeConfianza(exp.cuerpo_html);

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual="/experiencias" />

      <main className="exp-ficha">
        <div className="caja">
          <Link href={`/${idioma}/experiencias`} className="comercio-volver">
            ← {t('experiencias', idioma)}
          </Link>

          <header className="exp-ficha-cabecera">
            <div>
              {exp.zonas.length > 0 && <span className="exp-antetitulo">{exp.zonas.join(' · ')}</span>}
              <h1>{exp.titulo}</h1>
              {exp.subtitulo && <p className="exp-ficha-subtitulo">{exp.subtitulo}</p>}
              <p className="exp-dato">
                {exp.dias} {t('exp_dias', idioma)}
                {exp.noches ? ` · ${exp.noches} ${t('exp_noches', idioma)}` : ''}
              </p>
            </div>

            {exp.precio_desde_usd !== null && (
              <div className="exp-ficha-precio">
                <small>{t('exp_desde', idioma)}</small>
                <strong>${Number(exp.precio_desde_usd).toLocaleString('en-US')}</strong>
                <small>{t('exp_por_persona', idioma)}</small>
              </div>
            )}
          </header>

          <div className="exp-ficha-reja">
            {/* El cuerpo lo escribe el equipo en HTML desde el panel. Pasa por
                htmlDeConfianza, que le quita script y manejadores de evento. */}
            <article className="exp-prosa" dangerouslySetInnerHTML={{ __html: cuerpo }} />

            <aside className="exp-columna">
              <div className="exp-caja-consulta">
                <h2>{t('exp_consultar', idioma)}</h2>
                <FormularioConsulta
                  idioma={idioma}
                  babosa={exp.babosa}
                  titulo={exp.titulo}
                  personas={exp.personas}
                />
              </div>
              <p className="exp-letra-chica">{t('exp_precio_nota', idioma)}</p>
            </aside>
          </div>
        </div>
      </main>

      <Pie destino={destino} />
    </>
  );
}
