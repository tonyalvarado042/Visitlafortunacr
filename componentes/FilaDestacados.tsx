import Link from 'next/link';
import type { Destacado } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';

/*
 * La fila de destacados de la portada.
 *
 * Es lo que se compra con el plan premium, así que tiene que notarse: si
 * "destacado" no se ve distinto en ninguna pantalla, el plan no se vende
 * solo.
 *
 * Se desliza en lugar de envolverse. Una rejilla de diez tarjetas se come la
 * portada entera y deja de ser un destaque; una fila que se arrastra ocupa un
 * alto fijo y se entiende que hay más a la derecha.
 *
 * Sin JavaScript: es scroll del navegador con ajuste por tarjeta. Funciona
 * con el dedo, con la rueda y con el teclado, que es más de lo que suele dar
 * un carrusel hecho a mano.
 */
export function FilaDestacados({
  destacados, idioma,
}: {
  destacados: Destacado[];
  idioma: Idioma;
}) {
  if (destacados.length === 0) return null;

  return (
    <section className="destacados">
      <div className="caja destacados-rotulo">
        <div>
          <span className="destacados-sello">{t('destacados_sello', idioma)}</span>
          <h2>{t('destacados_titulo', idioma)}</h2>
        </div>
        <p>{t('destacados_bajada', idioma)}</p>
      </div>

      <div className="destacados-pista">
        <ul>
          {destacados.map((n) => (
            <li key={n.id}>
              <Link href={`/${idioma}/${n.categoria_babosa}/${n.babosa}`} className="destacado">
                <div className="destacado-foto">
                  {n.foto_portada_url
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={n.foto_portada_url} alt="" loading="lazy" />
                    : <span className="exp-sin-foto" aria-hidden="true" />}
                  <span className="cintillo">{t('destacado_cintillo', idioma)}</span>
                  {n.video_url && (
                    <span className="destacado-video" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5.5v13l11-6.5z" />
                      </svg>
                      {t('ver_video', idioma)}
                    </span>
                  )}
                </div>
                <div className="destacado-cuerpo">
                  <span className="destacado-cat">{n.categoria_nombre}</span>
                  <h3>{n.nombre}</h3>
                  {n.resumen && <p>{n.resumen}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
