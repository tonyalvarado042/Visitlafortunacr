import Link from 'next/link';
import { t, type Idioma } from '@/lib/idiomas';
import type { PiezaLateral } from '@/lib/blog';

/*
 * La columna de la derecha del blog.
 *
 * Dos cosas, en este orden: las categorías —que salen solas de lo que hay
 * publicado— y un bloque de piezas elegidas a mano desde el panel. Es el área
 * de widgets de un CMS: se arma una vez y sale en todos los artículos.
 *
 * Si no hay ni categorías ni piezas, no se pinta NADA. Una columna vacía al
 * lado del texto no es neutra: deja un hueco que se lee como que algo se
 * rompió, y encima angosta el artículo para nada.
 */
export function LateralBlog({
  idioma, categorias, piezas, tituloPiezas, tipoActivo,
}: {
  idioma: Idioma;
  categorias: { tipo: string; total: number }[];
  piezas: PiezaLateral[];
  tituloPiezas: string | null;
  tipoActivo?: string;
}) {
  if (!categorias.length && !piezas.length) return null;

  return (
    <aside className="blog-lateral">
      {categorias.length > 0 && (
        <div className="bloque">
          <div className="titulo">{t('blog_categorias', idioma)}</div>
          <ul className="lateral-categorias">
            {categorias.map((c) => (
              <li key={c.tipo}>
                <Link href={`/${idioma}/blog?tipo=${encodeURIComponent(c.tipo)}`}
                      aria-current={c.tipo === tipoActivo ? 'page' : undefined}>
                  <span>{c.tipo}</span>
                  <span className="cuantas">{c.total}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {piezas.length > 0 && (
        <div className="bloque">
          <div className="titulo">{tituloPiezas || t('blog_tambien', idioma)}</div>
          <div className="lateral-piezas">
            {piezas.map((p) => {
              /* El enlace externo se abre aparte y lleva nofollow: lo de
                 'enlace' lo escribe una persona y puede apuntar a cualquier
                 lado. Lo nuestro navega normal. */
              const fuera = p.tipo === 'enlace' && /^https?:\/\//i.test(p.url ?? '');
              const dentro = (
                <>
                  {p.imagen_url
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={p.imagen_url} alt="" loading="lazy" decoding="async" />
                    : <span className="lateral-sin-foto" aria-hidden="true" />}
                  <span className="lateral-texto">
                    <strong>{p.titulo}</strong>
                    {p.texto && <span>{p.texto}</span>}
                  </span>
                </>
              );

              if (!p.url) return <div className="lateral-pieza" key={p.id}>{dentro}</div>;

              return fuera ? (
                <a className="lateral-pieza" key={p.id} href={p.url}
                   target="_blank" rel="noopener noreferrer nofollow">{dentro}</a>
              ) : (
                <Link className="lateral-pieza" key={p.id} href={p.url}>{dentro}</Link>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
