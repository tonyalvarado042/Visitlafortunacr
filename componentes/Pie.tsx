import Link from 'next/link';
import type { Destino, Categoria } from '@/lib/destino';
import { t, NOMBRE_PROPIO, type Idioma } from '@/lib/idiomas';
import { sorteoDe } from '@/lib/sorteo';

/*
 * El pie.
 *
 * Lleva TODAS las categorías con contenido, agrupadas por sección. Para qué
 * sirve, siendo honestos: Google descuenta los enlaces de pie —están en
 * todas las páginas, así que no dicen nada sobre ESTA página— pero asegura
 * que ninguna categoría quede huérfana. Cada una recibe un enlace desde todo
 * el sitio y entra al índice. No mueve posiciones por sí solo; evita que
 * páginas enteras no existan para el buscador, que es peor.
 *
 * Los enlaces van en el IDIOMA DE LA PÁGINA, con la dirección de ese idioma:
 * en inglés la categoría es "hotels", no "hoteles". Mezclarlos le dice al
 * buscador que el sitio no sabe en qué idioma está cada página.
 */

const SECCIONES = ['que_hacer', 'tours', 'donde_dormir', 'comer_beber', 'explorar', 'transporte'] as const;

export async function Pie({
  destino, categorias, idioma,
}: {
  destino: Destino;
  /* Opcionales: hay páginas (el panel del comerciante) que no las cargan y
     no tiene sentido pedirlas solo para pintar el pie. */
  categorias?: Categoria[];
  idioma?: Idioma;
}) {
  const lugar = [destino.nombre_largo ?? destino.nombre, destino.region, destino.pais_nombre]
    .filter(Boolean)
    .join(', ');

  /* El crédito sale de dst_destino, no del código. Sin texto no se pinta nada,
     y sin URL se pinta el texto sin enlace — así un destino que no quiera
     crédito simplemente deja el campo vacío.

     El enlace lleva rel="noopener": abre en pestaña nueva y sin esto la página
     de destino puede manipular la nuestra con window.opener. */
  const credito = destino.pie_credito_texto?.trim();
  const url = destino.pie_credito_url?.trim();
  const urlSegura = url && /^https?:\/\//i.test(url) ? url : null;

  const conContenido = (categorias ?? []).filter((c) => c.total > 0);
  const hayMapa = conContenido.length > 0 && idioma;

  /* La rifa en el pie es su unico enlace permanente: el aviso emergente sale
     una vez y se calla, asi que sin esto el que lo cerro no vuelve a
     encontrarla. Apagada no se pinta nada. */
  const sorteo = await sorteoDe(destino);

  return (
    <footer>
      {hayMapa && (
        <div className="pie-mapa">
          <div className="pie-columnas">
            {SECCIONES.map((seccion) => {
              const suyas = conContenido.filter((c) => c.seccion === seccion);
              if (suyas.length === 0) return null;
              return (
                <div key={seccion} className="pie-columna">
                  <h2>{t(seccion === 'comer_beber' ? 'comer' : seccion, idioma)}</h2>
                  <ul>
                    {suyas.map((c) => (
                      <li key={c.categoria_id}>
                        <Link href={`/${idioma}/${c.babosa}`}>
                          {c.nombre} <span>{c.total}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            <div className="pie-columna">
              <h2>{destino.marca_nombre}</h2>
              <ul>
                <li><Link href={`/${idioma}/blog`}>{t('blog', idioma)}</Link></li>
                <li><Link href={`/${idioma}/experiencias`}>{t('experiencias', idioma)}</Link></li>
                <li><Link href={`/${idioma}/sumar-negocio`}>{t('sumar_boton', idioma)}</Link></li>
                <li><Link href={`/${idioma}/premium`}>{t('premium_sello', idioma)}</Link></li>
                {sorteo && !sorteo.cerrado_en && (
                  <li>
                    <Link href={`/${idioma}/${sorteo.babosa}`} className="pie-rifa">
                      {t('sorteo_sello', idioma)}
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Las otras versiones del sitio. No es solo cortesía: le da al
              buscador un camino para llegar a cada idioma. */}
          <div className="pie-idiomas">
            <span>{t('menu_idioma', idioma)}</span>
            <ul>
              {destino.idiomas.map((i) => (
                <li key={i}>
                  <Link href={`/${i}`} hrefLang={i} className={i === idioma ? 'on' : ''}>
                    {NOMBRE_PROPIO[i]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="pie-caja">
        {credito && (
          <div className="credito">
            {urlSegura
              ? <a href={urlSegura} target="_blank" rel="noopener noreferrer">{credito}</a>
              : credito}
          </div>
        )}
        <div className="legal">© {new Date().getFullYear()} {destino.dominio} · {lugar}</div>
      </div>
    </footer>
  );
}
