import { t, type Idioma } from '@/lib/idiomas';
import type { FotoNegocio } from '@/lib/destino';

/*
 * La galería de la ficha, en tres piezas que viven en sitios distintos de la
 * página. Sin una línea de JavaScript en el cliente: al hacer clic la foto se
 * abre grande con `:target` — el mismo criterio con el que los plegables son
 * <details> y el menú de la barra también.
 *
 *  - `FotosArriba`: tres fotos grandes, debajo de la cabecera.
 *  - `GaleriaAbajo`: el resto en retícula, al FINAL de la columna. Arriba van
 *    las tres que venden; el álbum completo lo mira quien ya se interesó, y
 *    para eso ya bajó hasta las reseñas.
 *  - `VisoresFotos`: las fotos abiertas a pantalla completa. Van FUERA de las
 *    dos columnas, al final del documento, y eso no es orden sino necesidad:
 *    ver más abajo.
 *
 * Dos cosas que parecen detalle y no lo son:
 *
 *  - El crédito sale SOLO cuando la licencia lo exige. CC BY y CC BY-SA piden
 *    que el autor y la licencia se vean junto a la imagen. Una foto cedida
 *    por el propio negocio no pide nada, y ponerle un pie a cada una llena la
 *    galería de letra gris que no le sirve a nadie.
 *  - Si la foto es genérica se dice que lo es, siempre. Mostrar una piscina
 *    cualquiera en la ficha de un hotel, sin avisar, es afirmar algo falso
 *    sobre el negocio; y esa es justo la clase de cosa que después nadie
 *    puede desmentir cuando el cliente ya reservó.
 */

/**
 * Si la licencia obliga a mostrar el crédito junto a la imagen.
 *
 * Las Creative Commons con atribución sí. "Cedida por el negocio" no: no hay
 * licencia que cumplir, hay un permiso. La diferencia no es formal — de ella
 * depende si la galería se llena de letra chica o no.
 */
function pideCredito(licencia: string | null): boolean {
  if (!licencia) return false;
  return /\bcc[\s-]|creative\s*commons|\bby[\s-]?(sa|nc|nd)?\b|unsplash|pexels|flickr|wikimedia/i
    .test(licencia);
}

/*
 * Qué fotos se muestran y dónde se parten, en un solo lugar.
 *
 * Las tres piezas tienen que estar de acuerdo en el ORDEN, porque el enlace
 * `#foto-3` de la retícula tiene que abrir el cuarto visor y no otro. Si cada
 * una recalculara su lista a su manera, el día que cambie el criterio una
 * quedaría desfasada y los enlaces abrirían la foto equivocada — un fallo que
 * no revienta nada y que nadie nota hasta que lo nota un cliente.
 */
function reparto(fotos: FotoNegocio[]) {
  const reales = fotos.filter((f) => !f.es_generica);
  // Si hay fotos reales del negocio, las genéricas sobran: ya no hacen falta
  // para llenar el hueco y solo confunden.
  const mostradas = reales.length ? reales : fotos.slice(0, 1);

  /* Tres arriba y el resto debajo. Con menos de cuatro no se parte: dos fotos
     en la fila grande y ninguna abajo se ve como un error, no como un
     diseño. */
  const parte = mostradas.length >= 4 ? 3 : mostradas.length;
  return { mostradas, parte, arriba: mostradas.slice(0, parte), resto: mostradas.slice(parte) };
}

const enlace = (i: number) => `#foto-${i}`;

/** Las tres grandes, debajo de la cabecera. */
export function FotosArriba({ fotos, idioma }: { fotos: FotoNegocio[]; idioma: Idioma }) {
  const { arriba } = reparto(fotos);
  if (!arriba.length) return null;

  return (
    <div className="galeria" id="fotos">
      <h2 className="galeria-titulo">{t('fotos', idioma)}</h2>

      <div className={`galeria-tres${arriba.length < 3 ? ' pocas' : ''}`}>
        {arriba.map((foto, i) => (
          <a key={foto.url} href={enlace(i)} className="galeria-foto"
             aria-label={foto.texto_alternativo || t('foto_ver', idioma)}>
            <img src={foto.url} alt={foto.texto_alternativo ?? ''}
                 loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
          </a>
        ))}
      </div>
    </div>
  );
}

/** El álbum completo, al final de la columna. */
export function GaleriaAbajo({ fotos, idioma }: { fotos: FotoNegocio[]; idioma: Idioma }) {
  const { resto, parte, mostradas } = reparto(fotos);
  if (!resto.length) return null;

  return (
    <div className="galeria galeria-album" id="galeria">
      <h2 className="galeria-titulo">
        {t('fotos', idioma)} · {mostradas.length}
      </h2>

      <div className="galeria-reticula">
        {resto.map((foto, i) => (
          <a key={foto.url} href={enlace(i + parte)} className="galeria-foto"
             aria-label={foto.texto_alternativo || t('foto_ver', idioma)}>
            <img src={foto.url} alt={foto.texto_alternativo ?? ''} loading="lazy" decoding="async" />
          </a>
        ))}
      </div>
    </div>
  );
}

/*
 * Las fotos abiertas a pantalla completa.
 *
 * Van al final del DOCUMENTO, fuera de las dos columnas, y hay un motivo duro:
 * la columna izquierda lleva `position: relative; z-index: 1` para montarse
 * sobre la cabecera a sangre. Eso crea un CONTEXTO DE APILAMIENTO, y dentro de
 * un contexto de apilamiento ningún hijo puede subir por encima de su padre —
 * da igual que el visor diga `z-index: 200`: compite dentro del 1, no contra
 * el 5 de la columna derecha. El resultado era que la foto grande se abría
 * DETRÁS de la tarjeta de reservar.
 *
 * Subirle el z-index al visor no arregla nada; sacarlo del contexto sí. Los
 * enlaces `#foto-N` siguen viviendo en la galería: `:target` no mira dónde
 * está el destino, solo que el id coincida.
 *
 * Y escondidos: una imagen dentro de un `display: none` no se descarga, así
 * que las diecisiete no pesan nada hasta que alguien abre una.
 */
export function VisoresFotos({ fotos, idioma }: { fotos: FotoNegocio[]; idioma: Idioma }) {
  const { mostradas } = reparto(fotos);
  if (!mostradas.length) return null;

  return (
    <>
      {mostradas.map((foto, i) => (
        <div className="visor" id={`foto-${i}`} key={`v-${foto.url}`} role="dialog" aria-modal="true">
          <a className="visor-fondo" href="#fotos" aria-label={t('cerrar', idioma)} />
          <img src={foto.url} alt={foto.texto_alternativo ?? ''} decoding="async" />
          <Credito foto={foto} idioma={idioma} />

          <a className="visor-cerrar" href="#fotos" aria-label={t('cerrar', idioma)}>×</a>
          {i > 0 && (
            <a className="visor-ir atras" href={enlace(i - 1)} aria-label={t('foto_anterior', idioma)}>‹</a>
          )}
          {i < mostradas.length - 1 && (
            <a className="visor-ir alante" href={enlace(i + 1)} aria-label={t('foto_siguiente', idioma)}>›</a>
          )}
          <span className="visor-cuenta">{i + 1} / {mostradas.length}</span>
        </div>
      ))}
    </>
  );
}

/*
 * Una línea gris debajo de la foto abierta, del tamaño de un pie de imagen de
 * periódico. Lleva lo que pide la licencia —autor, licencia, enlace— y, si la
 * foto es de categoría, lo dice ahí mismo.
 *
 * El enlace se rotula con el DOMINIO de donde salió, no con un nombre fijo.
 * Antes decía "Wikimedia Commons" para toda foto con origen, viniera de donde
 * viniera: las de Paradise salieron del sitio de Paradise y la ficha las
 * atribuía a Wikimedia. Un rótulo escrito a mano es una afirmación que
 * envejece mal.
 */
function Credito({ foto, idioma }: { foto: FotoNegocio; idioma: Idioma }) {
  const conLicencia = pideCredito(foto.licencia);
  const partes = [
    foto.es_generica ? t('foto_generica', idioma) : null,
    conLicencia && foto.credito ? `${t('foto_de', idioma)} ${foto.credito}` : null,
    conLicencia ? foto.licencia : null,
  ].filter(Boolean);

  // Sin licencia que cumplir y sin aviso que dar, no hay pie que poner.
  if (!partes.length) return null;

  let casa: string | null = null;
  if (conLicencia && foto.fuente_url) {
    try { casa = new URL(foto.fuente_url).hostname.replace(/^www\./, ''); } catch { casa = null; }
  }

  return (
    <figcaption className="visor-credito">
      {partes.join(' · ')}
      {casa && (
        <> · <a href={foto.fuente_url!} target="_blank" rel="noreferrer nofollow">{casa}</a></>
      )}
    </figcaption>
  );
}
