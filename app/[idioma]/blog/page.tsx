import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe } from '@/lib/destino';
import { guiasDe, fechaLegible } from '@/lib/blog';
import { t, type Idioma } from '@/lib/idiomas';
import { alternativas, mismasRutas } from '@/lib/seo';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';

export const dynamic = 'force-dynamic';

type Parametros = Promise<{ idioma: Idioma }>;

export async function generateMetadata({ params }: { params: Parametros }): Promise<Metadata> {
  const { idioma } = await params;
  try {
    const destino = await destinoActual();
    return {
      title: `${t('blog', idioma)} · ${destino.nombre}`,
      description: t('blog_bajada', idioma).replace('{destino}', destino.nombre),
      alternates: alternativas(idioma, mismasRutas(destino, '/blog')),
    };
  } catch {
    return {};
  }
}

export default async function Blog({ params }: { params: Parametros }) {
  const { idioma } = await params;
  const destino = await destinoActual();
  const [categorias, guias] = await Promise.all([
    categoriasDe(destino, idioma),
    guiasDe(destino, idioma),
  ]);

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual="/blog" />

      <main className="caja blog-cuerpo">
        <header className="blog-cabecera">
          <span className="exp-antetitulo">{t('blog', idioma)}</span>
          <h1>{t('blog_titulo', idioma).replace('{destino}', destino.nombre)}</h1>
          <p>{t('blog_bajada', idioma).replace('{destino}', destino.nombre)}</p>
        </header>

        {guias.length === 0 ? (
          <p className="exp-vacio">{t('blog_vacio', idioma)}</p>
        ) : (
          <div className="blog-rejilla">
            {guias.map((g) => (
              <article key={g.id} className="blog-tarjeta">
                <Link href={`/${idioma}/blog/${g.babosa}`}>
                  <div className="blog-foto">
                    {g.imagen_url
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src={g.imagen_url} alt="" loading="lazy" />
                      : <span className="exp-sin-foto" aria-hidden="true" />}
                  </div>
                  <div className="blog-tarjeta-cuerpo">
                    {g.tipo && <span className="blog-tipo">{g.tipo}</span>}
                    <h2>{g.titulo}</h2>
                    {g.entradilla && <p>{g.entradilla}</p>}
                    {g.publicado_en && (
                      <time dateTime={g.publicado_en}>{fechaLegible(g.publicado_en, idioma)}</time>
                    )}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>

      <Pie destino={destino} categorias={categorias} idioma={idioma} />
    </>
  );
}
