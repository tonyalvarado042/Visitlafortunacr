import Link from 'next/link';
import { t, type Idioma } from '@/lib/idiomas';
import type { ParadaDeTour } from '@/lib/destino';

/*
 * El itinerario de una tour: qué se hace, parada por parada.
 *
 * Es lo que pidió Tony el 7 de noviembre de 2026 señalando una ficha de
 * GetYourGuide: *«hazlo bien como ellos»*. Lo que hace que funcione no es la
 * lista — es que cada parada dice **cuánto dura** y **si la entrada va
 * incluida**. Esas dos son las preguntas que alguien se hace antes de pagar, y
 * la ficha que no las contesta las manda a un correo que nadie responde.
 *
 * ⚠️ LO QUE ELLOS NO PUEDEN HACER Y ACÁ SÍ: una parada puede SER una ficha del
 * directorio. Las aguas termales de la parada 3 son un negocio publicado, con
 * su foto, su nota y sus reseñas. Para ellos es texto; acá es un enlace. Eso
 * convierte el itinerario de un tour en una puerta al resto del sitio, que es
 * justo lo que un directorio quiere. Ver `dst_tour_parada.negocio_id`.
 *
 * La línea vertical que une los números se dibuja con un `::before` sobre el
 * `<li>` y no con un elemento aparte: así nunca se despega del número, pase lo
 * que pase con el alto del texto de al lado.
 */

function duracion(minutos: number, idioma: Idioma): string {
  if (minutos < 60) return `${minutos} ${t('minutos_corto', idioma)}`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0
    ? `${h} ${t('hora_corto', idioma)}`
    : `${h} ${t('hora_corto', idioma)} ${m} ${t('minutos_corto', idioma)}`;
}

const ETIQUETA_TIPO: Record<string, 'parada_salida' | 'parada_paso' | 'parada_regreso' | null> = {
  salida: 'parada_salida',
  paso: 'parada_paso',
  regreso: 'parada_regreso',
  /* `parada` no lleva etiqueta: es el caso normal y ponerle «Parada» a las
     seis filas que ya están numeradas es ruido. */
  parada: null,
};

export function ItinerarioDelTour({
  paradas, idioma,
}: {
  paradas: ParadaDeTour[];
  idioma: Idioma;
}) {
  if (!paradas.length) return null;

  /* Los números cuentan SOLO las paradas de verdad. La salida, el regreso y
     los «pasás por» no llevan número: numerar el punto de recogida como «1»
     hace que la primera cosa que se hace sea la 2, y se lee mal. */
  let n = 0;

  return (
    <div className="bloque tour-itinerario" style={{ marginTop: 30 }}>
      <div className="titulo">{t('itinerario_titulo', idioma)}</div>
      <ol>
        {paradas.map((p) => {
          const numerada = p.tipo === 'parada';
          if (numerada) n += 1;
          const etiqueta = ETIQUETA_TIPO[p.tipo];
          const enlace = p.negocio_babosa && p.negocio_categoria
            ? `/${idioma}/${p.negocio_categoria}/${p.negocio_babosa}`
            : null;

          return (
            <li key={p.id} className={numerada ? undefined : 'suave'}>
              <span className="parada-numero" aria-hidden="true">
                {numerada ? n : <span className="parada-punto" />}
              </span>

              <div className="parada-cuerpo">
                {etiqueta && <span className="parada-tipo">{t(etiqueta, idioma)}</span>}

                <strong>
                  {enlace ? <Link href={enlace}>{p.titulo}</Link> : p.titulo}
                </strong>

                {(p.duracion_minutos != null || p.entrada_incluida != null) && (
                  <div className="parada-marcas">
                    {p.duracion_minutos != null && (
                      <span>{duracion(p.duracion_minutos, idioma)}</span>
                    )}
                    {/* El `false` se MUESTRA, no se esconde. «Entrada aparte»
                        es dinero que alguien no contó, y enterarse en la
                        entrada del parque es peor que leerlo acá. */}
                    {p.entrada_incluida === true && (
                      <span className="si">{t('parada_entrada_si', idioma)}</span>
                    )}
                    {p.entrada_incluida === false && (
                      <span className="no">{t('parada_entrada_no', idioma)}</span>
                    )}
                  </div>
                )}

                {p.descripcion && <p>{p.descripcion}</p>}

                {enlace && (
                  <Link className="parada-ficha" href={enlace}>
                    {p.negocio_foto && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.negocio_foto} alt="" loading="lazy" decoding="async" />
                    )}
                    <span>{t('parada_ver_ficha', idioma)} →</span>
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
