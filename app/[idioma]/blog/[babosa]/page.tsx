import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe } from '@/lib/destino';
import { guiaPorBabosa, guiasDe, fechaLegible, lateralDe, categoriasDeGuias } from '@/lib/blog';
import { htmlDeConfianza } from '@/lib/html-de-confianza';
import { alternativas, rutasDeGuia } from '@/lib/seo';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { LateralBlog } from '@/componentes/LateralBlog';

export const dynamic = 'force-dynamic';

type Parametros = Promise<{ idioma: Idioma; babosa: string }>;

export async function generateMetadata({ params }: { params: Parametros }): Promise<Metadata> {
  const { idioma, babosa } = await params;
  try {
    const destino = await destinoActual();
    const guia = await guiaPorBabosa(destino, babosa, idioma);
    if (!guia) return {};
    return {
      title: guia.meta_titulo ?? `${guia.titulo} · ${destino.nombre}`,
      description: guia.meta_desc ?? guia.entradilla ?? undefined,
      alternates: alternativas(idioma, await rutasDeGuia(guia.grupo)),
      openGraph: {
        type: 'article',
        title: guia.titulo,
        description: guia.entradilla ?? undefined,
        publishedTime: guia.publicado_en ?? undefined,
        modifiedTime: guia.actualizado_en ?? undefined,
        ...(guia.imagen_url ? { images: [guia.imagen_url] } : {}),
      },
    };
  } catch {
    return {};
  }
}

export default async function Articulo({ params }: { params: Parametros }) {
  const { idioma, babosa } = await params;
  const destino = await destinoActual();

  const [categorias, guia] = await Promise.all([
    categoriasDe(destino, idioma),
    guiaPorBabosa(destino, babosa, idioma),
  ]);
  if (!guia) notFound();

  /* Las guias se piden UNA vez y sirven para dos cosas: las de "seguir
     leyendo" y las categorias de la columna. */
  const todas = await guiasDe(destino, idioma);
  const otras = todas.filter((g) => g.id !== guia.id).slice(0, 3);
  const piezas = await lateralDe(destino, idioma);
  const cuerpo = htmlDeConfianza(guia.cuerpo);

  /* Article en datos estructurados. Es lo que deja que el artículo aparezca
     como pieza propia y no como "una página más del sitio", y lo que leen
     las IA cuando buscan quién respondió una pregunta. */
  const marcado = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guia.titulo,
    description: guia.entradilla ?? undefined,
    image: guia.imagen_url ?? undefined,
    datePublished: guia.publicado_en ?? undefined,
    dateModified: guia.actualizado_en ?? guia.publicado_en ?? undefined,
    inLanguage: guia.idioma,
    author: { '@type': 'Organization', name: destino.marca_nombre },
    publisher: {
      '@type': 'Organization',
      name: destino.marca_nombre,
      ...(destino.logo_url ? { logo: { '@type': 'ImageObject', url: `https://${destino.dominio}${destino.logo_url}` } } : {}),
    },
    mainEntityOfPage: `https://${destino.dominio}/${idioma}/blog/${guia.babosa}`,
  };

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual="/blog" />

      <script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(marcado) }} />

      <main className="blog-articulo">
        <div className="caja">
          <Link href={`/${idioma}/blog`} className="comercio-volver">← {t('blog', idioma)}</Link>

          {/* Las dos columnas arrancan ACA, no despues de la foto.
              Las tenia empezando debajo de la cabecera y de la foto grande,
              con el argumento de que el titulo manda a lo ancho. El argumento
              era bonito y el resultado era malo: la columna de la derecha
              empezaba a 1058px del borde de arriba, o sea mas de una pantalla
              abajo. Una columna que hay que ir a buscar no acompana al
              articulo; para quien lee, sale "abajo". */}
          <div className="blog-cuerpo">
            <div className="blog-principal">
              <header className="blog-articulo-cabecera">
                {guia.tipo && <span className="blog-tipo">{guia.tipo}</span>}
                <h1>{guia.titulo}</h1>
                {guia.entradilla && <p className="blog-entradilla">{guia.entradilla}</p>}
                {guia.publicado_en && (
                  <time dateTime={guia.publicado_en} className="blog-fecha">
                    {fechaLegible(guia.publicado_en, idioma)}
                  </time>
                )}
              </header>

              {guia.imagen_url && (
                <div className="blog-foto-grande">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={guia.imagen_url} alt="" />
                </div>
              )}

              <article className="exp-prosa blog-prosa" dangerouslySetInnerHTML={{ __html: cuerpo }} />
            </div>
            <LateralBlog
              idioma={idioma}
              categorias={categoriasDeGuias(todas)}
              piezas={piezas}
              tituloPiezas={destino.lateral_titulo ?? null}
              tipoActivo={guia.tipo ?? undefined}
            />
          </div>

          {otras.length > 0 && (
            <section className="blog-otras">
              <h2>{t('blog_seguir', idioma)}</h2>
              <ul>
                {otras.map((o) => (
                  <li key={o.id}>
                    <Link href={`/${idioma}/blog/${o.babosa}`}>{o.titulo}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>

      <Pie destino={destino} categorias={categorias} idioma={idioma} />
    </>
  );
}
