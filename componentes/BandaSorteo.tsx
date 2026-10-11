import Link from 'next/link';
import { t, type Idioma } from '@/lib/idiomas';
import { premioEnPlata, cuandoSeSortea } from '@/lib/sorteo-formato';
import { FormularioSorteo } from './FormularioSorteo';
import type { Sorteo } from '@/lib/sorteo';

/*
 * La rifa en la portada.
 *
 * Va DESPUÉS de los destacados, no antes. No es estética: los destacados son
 * lo que se le cobra a los negocios, y si la rifa les pasa por encima, el
 * plan que se vende en $500 queda de segundo en su propia portada. Una
 * pantalla más abajo la rifa junta casi lo mismo; el que paga no.
 *
 * El formulario está AQUÍ y no es un botón que lleva a otra página. Cada
 * pantalla de por medio se come la mitad de la gente, y lo único que hace
 * falta son dos campos.
 */
export function BandaSorteo({
  sorteo, idioma,
}: {
  sorteo: Sorteo;
  idioma: Idioma;
}) {
  if (sorteo.cerrado_en) return null;

  const premio = premioEnPlata(sorteo.premio_usd, idioma);
  const cuando = cuandoSeSortea(sorteo.fecha_sorteo, sorteo.cuando_texto, idioma);

  return (
    <section className="banda-sorteo">
      {sorteo.imagen_url
        /* eslint-disable-next-line @next/next/no-img-element */
        ? <img className="banda-foto" src={sorteo.imagen_url} alt="" loading="lazy" />
        : <span className="exp-sin-foto banda-foto" aria-hidden="true" />}
      <span className="banda-velo" aria-hidden="true" />

      <div className="caja banda-reja">
        <div className="banda-texto">
          <span className="destacados-sello">{t('sorteo_sello', idioma)}</span>
          <h2>{sorteo.titulo}</h2>

          {premio && (
            <p className="banda-premio">
              <strong>{premio}</strong>
              {/* El titulo y no la nota: al lado de la cifra grande,
                  "valorada en mas de $1.000" repite el mismo numero. "4 dias
                  y 3 noches" agrega algo. */}
              <span>{sorteo.premio_titulo ?? sorteo.premio_nota}</span>
            </p>
          )}

          {sorteo.incluye.length > 0 && (
            <ul className="banda-incluye">
              {sorteo.incluye.slice(0, 4).map((linea) => (
                <li key={linea}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12.5 4.5 4.5L19 7" />
                  </svg>
                  {linea}
                </li>
              ))}
            </ul>
          )}

          <p className="banda-cuando">
            {cuando && <span>{t('sorteo_cuando', idioma)}: <strong>{cuando}</strong></span>}
            {sorteo.ganadores === 1 && <span>{t('sorteo_un_ganador', idioma)}</span>}
            {sorteo.en_vivo && <span>{t('sorteo_en_vivo', idioma)}</span>}
          </p>

          <Link className="banda-bases" href={`/${idioma}/${sorteo.babosa}`}>
            {t('sorteo_ver_todo', idioma)} &rarr;
          </Link>
        </div>

        <div className="banda-caja">
          <FormularioSorteo sorteo={sorteo} idioma={idioma} origen="pagina" />
        </div>
      </div>
    </section>
  );
}
