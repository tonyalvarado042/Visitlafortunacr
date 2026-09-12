import { t, type Idioma } from '@/lib/idiomas';
import type { FotoNegocio } from '@/lib/destino';

/*
 * La galería de la ficha. Sin una línea de JavaScript en el cliente: es una
 * retícula de <img>, como los plegables son <details>.
 *
 * Dos cosas que parecen detalle y no lo son:
 *
 *  - El crédito va DEBAJO de cada foto, no en una página de créditos aparte.
 *    CC BY y CC BY-SA piden que el autor y la licencia se vean junto a la
 *    imagen, y una página aparte no cumple eso.
 *  - Si la foto es genérica se dice que lo es. Mostrar una piscina cualquiera
 *    en la ficha de un hotel, sin avisar, es afirmar algo falso sobre el
 *    negocio; y esa es justo la clase de cosa que después nadie puede
 *    desmentir cuando el cliente ya reservó.
 */
export function GaleriaNegocio({ fotos, idioma }: { fotos: FotoNegocio[]; idioma: Idioma }) {
  if (!fotos.length) return null;

  const reales = fotos.filter((f) => !f.es_generica);
  // Si hay fotos reales del negocio, las genéricas sobran: ya no hacen falta
  // para llenar el hueco y solo confunden.
  const mostradas = reales.length ? reales : fotos.slice(0, 1);
  const todasGenericas = !reales.length;

  return (
    <div className="galeria">
      <h2 className="galeria-titulo">{t('fotos', idioma)}</h2>

      <div className={`galeria-reticula${mostradas.length === 1 ? ' una' : ''}`}>
        {mostradas.map((foto) => (
          <figure key={foto.url}>
            <img src={foto.url} alt={foto.texto_alternativo ?? ''} loading="lazy" decoding="async" />
            <Credito foto={foto} idioma={idioma} />
          </figure>
        ))}
      </div>
    </div>
  );
}

/*
 * Una sola línea gris debajo de la foto, del tamaño de un pie de imagen de
 * periódico. Lleva lo que pide la licencia —autor, licencia, enlace— y, si la
 * foto es de categoría, lo dice ahí mismo en vez de en un aviso aparte: un
 * párrafo en cursiva debajo se lee como una advertencia legal y hace ver peor
 * la ficha sin decir nada más de lo que dice esta línea.
 */
function Credito({ foto, idioma }: { foto: FotoNegocio; idioma: Idioma }) {
  const partes = [
    foto.es_generica ? t('foto_generica', idioma) : null,
    foto.credito ? `${t('foto_de', idioma)} ${foto.credito}` : null,
    foto.licencia,
  ].filter(Boolean);
  if (!partes.length && !foto.fuente_url) return null;

  return (
    <figcaption className="galeria-credito">
      {partes.join(' · ')}
      {foto.fuente_url && (
        <> · <a href={foto.fuente_url} target="_blank" rel="noreferrer nofollow">Wikimedia Commons</a></>
      )}
    </figcaption>
  );
}
