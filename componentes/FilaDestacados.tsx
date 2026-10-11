import Link from 'next/link';
import type { Destacado } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';
import { PistaDestacados } from './PistaDestacados';

/*
 * La fila de destacados de la portada.
 *
 * Es lo que se compra con el plan premium, así que tiene que notarse: si
 * "destacado" no se ve distinto en ninguna pantalla, el plan no se vende
 * solo.
 *
 * Anda sola, despacio, y se detiene apenas alguien se le acerca. Quién la
 * mueve y por qué está en PistaDestacados.tsx.
 *
 * Las tarjetas se pintan DOS VECES, y eso es a propósito: es lo que deja que
 * el bucle no dé el salto feo al llegar al final. Las copias van
 * `aria-hidden` y sin paso de teclado —quien navega con tabulador recorre
 * diez tarjetas, no veinte— pero SÍ se puede hacer clic en ellas: la mitad
 * del tiempo la tarjeta que se ve es una copia, y una tarjeta premium que no
 * abre al tocarla sería peor que no tener carrusel.
 *
 * Van en UNA SOLA <ul>, no en dos listas una al lado de la otra. Eran dos, y
 * en iPhone las tarjetas se montaban unas sobre otras justo en la unión de
 * las dos — dos listas dentro de un flex, dentro de otro flex, dentro de un
 * `overflow-x`: tres cajas flexibles anidadas que cada motor puede medir un
 * poco distinto, y el desacuerdo aparece exactamente ahí. Con una sola lista
 * no hay unión: la separación entre CUALQUIER par de tarjetas sale del mismo
 * `gap` de la misma caja. Deja de depender de a quién le toque medir.
 *
 * Para buscadores no cambia nada: las tarjetas ya estaban en el HTML del
 * servidor y ahí siguen. Lo único que se mueve es la posición del scroll,
 * que ningún rastreador mira.
 */
export function FilaDestacados({
  destacados, idioma,
}: {
  destacados: Destacado[];
  idioma: Idioma;
}) {
  if (destacados.length === 0) return null;

  const tarjetas = (copia: boolean) =>
    destacados.map((n) => (
        <li key={`${copia ? 'c' : 'o'}-${n.id}`} {...(copia ? { 'aria-hidden': true } : {})}>
          <Link href={`/${idioma}/${n.categoria_babosa}/${n.babosa}`} className="destacado"
                tabIndex={copia ? -1 : undefined}>
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
    ));

  return (
    <section className="destacados">
      <div className="caja destacados-rotulo">
        <div>
          <span className="destacados-sello">{t('destacados_sello', idioma)}</span>
          <h2>{t('destacados_titulo', idioma)}</h2>
        </div>
        <p>{t('destacados_bajada', idioma)}</p>
      </div>

      <PistaDestacados>
        {tarjetas(false)}
        {tarjetas(true)}
      </PistaDestacados>

    </section>
  );
}
