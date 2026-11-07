import { Volcanes } from '@/componentes/Volcanes';
import { Calificar } from '@/componentes/Calificar';
import { nota, type Resena } from '@/lib/resenas';
import { resenas as resenasPalabra, t, type Idioma } from '@/lib/idiomas';

/*
 * El bloque de reseñas. UNO solo, para la ficha de un negocio y para la de una
 * tour.
 *
 * ⚠️ POR QUÉ ES UN COMPONENTE Y NO DOS COPIAS.
 *
 * Esto vivía escrito a mano dentro de la página del negocio. El 7 de noviembre
 * de 2026 las tours también empezaron a tener reseñas, y copiar cuarenta
 * líneas de JSX habría dejado dos bloques que se parecen hasta que alguien
 * arregla uno. Es la misma razón por la que `lib/intereses.ts` y
 * `lib/traducciones-de-tour.ts` existen: donde hay dos copias, hay una que se
 * queda vieja sin avisar.
 *
 * Tony lo dijo más corto: «todo el sitio es de negocios y tours». Lo que vale
 * para uno tiene que valer para el otro.
 */
export function BloqueResenas({
  idioma, total, promedio, resenas, negocioId, negocioNombre, tourId, estilo,
}: {
  idioma: Idioma;
  total: number;
  promedio: number | null;
  resenas: Resena[];
  negocioId: string;
  /** Lo que se le muestra a quien escribe: el nombre de la tour si la hay. */
  negocioNombre: string;
  /** Con tour, la reseña es de ESA tour. Sin él, del negocio entero. */
  tourId?: string;
  estilo?: React.CSSProperties;
}) {
  return (
    <div className="bloque" style={estilo}>
      <div className="titulo">{t('resenas_titulo', idioma)}</div>

      <div className="resumen-nota">
        {total > 0 && promedio ? (
          <>
            <div className="cifra-nota">{nota(promedio, idioma)}</div>
            <div>
              <Volcanes nota={promedio} tamano={20}
                        etiqueta={`${nota(promedio, idioma)} ${t('de_cinco', idioma)}`} />
              <div className="cuantas">{total} {resenasPalabra(total, idioma)}</div>
            </div>
          </>
        ) : (
          /* Sin reseñas, el bloque mantiene LA MISMA forma: la raya en lugar
             de la nota y los cinco volcanes vacíos. Antes caía a una línea de
             texto gris y se leía como si las reseñas propias no existieran. */
          <>
            <div className="cifra-nota sin-nota">&mdash;</div>
            <div>
              <Volcanes nota={0} tamano={20} etiqueta={t('escribi_primera', idioma)} />
              <div className="cuantas">{t('escribi_primera', idioma)}</div>
            </div>
          </>
        )}
      </div>

      <Calificar negocioId={negocioId} negocioNombre={negocioNombre}
                 idioma={idioma} tourId={tourId} />

      {resenas.map((r) => (
        <article className="resena" key={r.id}>
          <div className="quien">
            <Volcanes nota={r.calificacion} tamano={13}
                      etiqueta={`${r.calificacion} ${t('de_cinco', idioma)}`} />
            <strong>{r.autor}</strong>
            <span>
              {new Date(r.visitado_el ?? r.creado_en)
                .toLocaleDateString(idioma, { year: 'numeric', month: 'long' })}
            </span>
          </div>
          {r.titulo && <h4>{r.titulo}</h4>}
          <p>{r.cuerpo}</p>
          {r.respuesta_negocio && (
            <div className="respuesta">
              <span>{t('respuesta_negocio', idioma)}</span>
              <p>{r.respuesta_negocio}</p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
