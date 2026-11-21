import type { MetadataRoute } from 'next';
import { destinoActual, categoriasDe, negociosDe } from '@/lib/destino';
import { guiasDe } from '@/lib/blog';
import { experienciasDe } from '@/lib/experiencias';
import type { Idioma } from '@/lib/idiomas';
import { BABOSA_DE_SECCION, babosaDeSeccion, MINIMO_CATEGORIAS_PARA_PAGINA } from '@/lib/secciones';

export const dynamic = 'force-dynamic';

/*
 * El mapa del sitio, en todos los idiomas.
 *
 * Cada entrada lleva sus `alternates.languages`, que es la forma de declarar
 * hreflang desde el sitemap. Decirlo en los dos lugares —en la página y acá—
 * no es redundante: Google usa el sitemap para descubrir idiomas de páginas
 * que todavía no rastreó.
 *
 * Las direcciones de categorías y fichas CAMBIAN por idioma, así que se pide
 * el listado por idioma en vez de pegarle un prefijo al de español.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const destino = await destinoActual();
  const base = `https://${destino.dominio}`;
  const idiomas = destino.idiomas;

  /* Se arma un índice por idioma para poder emitir, en cada entrada, las
     direcciones hermanas de los otros idiomas. */
  const porIdioma = await Promise.all(
    idiomas.map(async (idioma: Idioma) => ({
      idioma,
      categorias: await categoriasDe(destino, idioma),
      negocios: await negociosDe(destino, idioma),
      guias: await guiasDe(destino, idioma),
      experiencias: await experienciasDe(destino, idioma),
    })),
  );

  const entradas: MetadataRoute.Sitemap = [];
  const idiomasDe = (hacer: (i: Idioma) => string | null) => {
    const mapa: Record<string, string> = {};
    for (const idioma of idiomas) {
      const ruta = hacer(idioma);
      if (ruta) mapa[idioma] = `${base}${ruta}`;
    }
    return mapa;
  };

  // La portada y las páginas fijas.
  for (const cola of ['', '/blog', '/experiencias', '/premium', '/sumar-negocio']) {
    for (const idioma of idiomas) {
      entradas.push({
        url: `${base}/${idioma}${cola}`,
        changeFrequency: cola === '' ? 'daily' : 'weekly',
        priority: cola === '' ? 1 : 0.7,
        alternates: { languages: idiomasDe((i) => `/${i}${cola}`) },
      });
    }
  }

  /* Las páginas de sección: «Comer y beber» con sus doce lugares, no solo
     «Restaurantes» con uno. Solo las que existen de verdad — una sección con
     una sola categoría con contenido redirige a esa categoría, y una
     dirección que redirige no va en el mapa del sitio. */
  const deAlguno = porIdioma[0]?.categorias ?? [];
  for (const seccion of Object.keys(BABOSA_DE_SECCION)) {
    const conContenido = deAlguno.filter((c) => c.seccion === seccion && c.total > 0);
    if (conContenido.length < MINIMO_CATEGORIAS_PARA_PAGINA) continue;
    for (const idioma of idiomas) {
      const babosa = babosaDeSeccion(seccion, idioma);
      if (!babosa) continue;
      entradas.push({
        url: `${base}/${idioma}/${babosa}`,
        changeFrequency: 'weekly',
        priority: 0.85,
        alternates: { languages: idiomasDe((i) => {
          const b = babosaDeSeccion(seccion, i);
          return b ? `/${i}/${b}` : null;
        }) },
      });
    }
  }

  for (const { idioma, categorias, negocios, guias, experiencias } of porIdioma) {
    for (const c of categorias) {
      if (c.total === 0) continue;
      entradas.push({
        url: `${base}/${idioma}/${c.babosa}`,
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: {
          languages: idiomasDe((i) =>
            porIdioma.find((p) => p.idioma === i)
              ?.categorias.find((x) => x.categoria_id === c.categoria_id)
              ?.babosa ? `/${i}/${porIdioma.find((p) => p.idioma === i)!.categorias.find((x) => x.categoria_id === c.categoria_id)!.babosa}` : null),
        },
      });
    }

    for (const n of negocios) {
      entradas.push({
        url: `${base}/${idioma}/${n.categoria_babosa}/${n.babosa}`,
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }

    for (const g of guias) {
      entradas.push({
        url: `${base}/${idioma}/blog/${g.babosa}`,
        lastModified: g.publicado_en ? new Date(g.publicado_en) : undefined,
        changeFrequency: 'monthly',
        priority: 0.75,
      });
    }

    for (const e of experiencias) {
      entradas.push({
        url: `${base}/${idioma}/experiencias/${e.babosa}`,
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  }

  return entradas;
}
