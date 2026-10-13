import { nota } from '@/lib/resenas';
import { resenas as resenasPalabra, t, type Idioma } from '@/lib/idiomas';

/*
 * Lo que dice la gente que fue, arriba y a la vista.
 *
 * Antes esto vivía al final de la ficha, en una tabla con una fila por
 * plataforma y las citas apiladas debajo. Es el dato que más pesa cuando
 * alguien está decidiendo y estaba enterrado donde casi nadie llega.
 *
 * LA REGLA QUE NO SE NEGOCIA: la nota grande es el PROMEDIO REAL y el conteo
 * es el TOTAL REAL, siempre, y el enlace a verlas todas en la fuente no se
 * quita nunca. Se pueden destacar citas; no se puede dar a entender una nota
 * que no es. Filtrar para que solo se vean las de cinco estrellas es *review
 * gating*: Google lo castiga en el perfil del negocio y en varios países es
 * publicidad engañosa.
 *
 * Las tres que salen son las DESTACADAS por el equipo y, si no alcanzan, las
 * más recientes. Destacar es ordenar, no esconder: lo que no sube sigue en la
 * fuente, a un clic del enlace de arriba, y la nota publicada es la de todas.
 */

type Extracto = {
  autor_nombre: string;
  calificacion: number | null;
  texto: string;
  publicada_en: string | null;
  url_original: string;
  destacado: boolean;
};

type Externa = {
  plataforma: string;
  calificacion: number | null;
  total_resenas: number | null;
  url_fuente: string;
  extractos: Extracto[];
};

/** Cinco volcanes llenos o vacíos, para una cita ajena. */
function Volcancitos({ cuantos }: { cuantos: number }) {
  return (
    <span className="cita-volcanes" role="img" aria-label={`${cuantos} de 5`}>
      {[1, 2, 3, 4, 5].map((v) => (
        <svg key={v} width="13" height="13" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 3.4l8 13.2H2z" fill={v <= cuantos ? 'var(--naranja)' : 'var(--borde-4)'} />
        </svg>
      ))}
    </span>
  );
}

export function PruebaSocial({ externas, idioma }: { externas: Externa[]; idioma: Idioma }) {
  /* La fuente principal es la que más reseñas tiene: ahí está el número que
     significa algo. Las otras siguen enlazadas más abajo. */
  const principal = [...externas]
    .filter((e) => e.calificacion != null && (e.total_resenas ?? 0) > 0)
    .sort((a, b) => (b.total_resenas ?? 0) - (a.total_resenas ?? 0))[0];

  /* Primero las destacadas por el equipo, después las más recientes. Un orden,
     nunca un filtro: las que no suben siguen estando en la fuente, y el enlace
     para verlas todas está justo arriba. */
  const citas = externas
    .flatMap((e) => e.extractos.map((x) => ({ ...x, plataforma: e.plataforma })))
    .sort((a, b) => {
      if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
      return (b.publicada_en ?? '').localeCompare(a.publicada_en ?? '');
    })
    .slice(0, 3);

  if (!principal && !citas.length) return null;

  const otras = externas.filter((e) => e !== principal && e.calificacion != null);

  return (
    <section className="prueba-social">
      <div className="prueba-cabeza">
        <h2>{t('prueba_social_titulo', idioma)}</h2>

        {principal && (
          <div className="prueba-cifras">
            <div>
              <span className="prueba-nota">{nota(principal.calificacion!, idioma)}</span>
              <span className="prueba-pie">
                {t('de_cinco_en', idioma)} <span className="prueba-fuente">{principal.plataforma}</span>
              </span>
            </div>
            <span className="prueba-raya" aria-hidden="true" />
            <div>
              <span className="prueba-cuantas">{principal.total_resenas?.toLocaleString(idioma)}</span>
              <span className="prueba-pie">{resenasPalabra(principal.total_resenas ?? 0, idioma)}</span>
            </div>
          </div>
        )}

        {principal && (
          <a className="prueba-enlace" href={principal.url_fuente}
             target="_blank" rel="noopener noreferrer nofollow">
            {t('ver_todas_en', idioma)} {principal.plataforma} ↗
          </a>
        )}

        {otras.length > 0 && (
          <div className="prueba-otras">
            {otras.map((e) => (
              <a key={e.plataforma} href={e.url_fuente} target="_blank" rel="noopener noreferrer nofollow">
                <span style={{ textTransform: 'capitalize' }}>{e.plataforma}</span>
                <strong>{nota(e.calificacion!, idioma)}</strong>
              </a>
            ))}
          </div>
        )}
      </div>

      {citas.length > 0 && (
        <div className="prueba-citas">
          {citas.map((x) => (
            <blockquote key={x.url_original + x.autor_nombre}>
              {x.calificacion != null && <Volcancitos cuantos={x.calificacion} />}
              <p>{x.texto.length > 190 ? `${x.texto.slice(0, 190).trimEnd()}…` : x.texto}</p>
              <footer>
                <strong>{x.autor_nombre}</strong>
                <span style={{ textTransform: 'capitalize' }}>
                  {x.plataforma}
                  {x.publicada_en && (
                    <> · {new Date(x.publicada_en).toLocaleDateString(idioma, { year: 'numeric', month: 'long' })}</>
                  )}
                </span>
                {/* El enlace a la original. Sin eso no es cita, es apropiación. */}
                <a href={x.url_original} target="_blank" rel="noopener noreferrer nofollow">
                  {t('ver_en', idioma)} {x.plataforma} ↗
                </a>
              </footer>
            </blockquote>
          ))}
        </div>
      )}
    </section>
  );
}
