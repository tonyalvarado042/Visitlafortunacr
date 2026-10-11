import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe } from '@/lib/destino';
import { sorteoDe } from '@/lib/sorteo';
import { cuandoSeSortea, premioEnPlata, marcarPendientes } from '@/lib/sorteo-formato';
import { esIdioma, t, type Idioma } from '@/lib/idiomas';
import { alternativas, mismasRutas } from '@/lib/seo';
import { htmlDeConfianza } from '@/lib/html-de-confianza';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { FormularioSorteo } from '@/componentes/FormularioSorteo';

export const dynamic = 'force-dynamic';

/*
 * La página de la rifa.
 *
 * El aviso emergente junta correos; esta página es la que convence. Lleva lo
 * mismo que pediría cualquiera antes de dejar sus datos: qué se gana, cuándo
 * se sortea, cuántos ganan, cómo se sortea y las bases completas.
 *
 * Si el sorteo está apagado la página no existe, salvo con ?vista=1, que es
 * la vista previa para mirar cómo queda antes de soltarla.
 */

type Props = {
  params: Promise<{ idioma: string }>;
  searchParams: Promise<{ vista?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { idioma } = await params;
  if (!esIdioma(idioma)) return {};
  const destino = await destinoActual();
  const sorteo = await sorteoDe(destino);
  if (!sorteo) return {};
  return {
    title: sorteo.titulo,
    description: sorteo.gancho ?? undefined,
    alternates: alternativas(idioma, mismasRutas(destino, `/${sorteo.babosa}`)),
    openGraph: {
      title: sorteo.titulo,
      description: sorteo.gancho ?? undefined,
      images: sorteo.imagen_url ? [sorteo.imagen_url] : undefined,
    },
  };
}

export default async function PaginaRifa({ params, searchParams }: Props) {
  const { idioma } = await params;
  if (!esIdioma(idioma)) notFound();

  const { vista } = await searchParams;
  const vistaPrevia = vista === '1';

  const destino = await destinoActual();
  const [sorteo, categorias] = await Promise.all([
    sorteoDe(destino, vistaPrevia),
    categoriasDe(destino, idioma),
  ]);
  if (!sorteo) notFound();

  const cuando = cuandoSeSortea(sorteo.fecha_sorteo, sorteo.cuando_texto, idioma);
  const premio = premioEnPlata(sorteo.premio_usd, idioma);
  const cerrado = !!sorteo.cerrado_en;

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias}
             rutaActual={`/${sorteo.babosa}`} />

      {!sorteo.esta_activo && (
        <p className="sorteo-apagado">{t('sorteo_apagado', idioma)}</p>
      )}

      <header className="rifa-hero">
        {sorteo.imagen_url
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img className="rifa-hero-foto" src={sorteo.imagen_url} alt="" />
          : <span className="exp-sin-foto rifa-hero-foto" aria-hidden="true" />}
        <span className="rifa-hero-velo" aria-hidden="true" />

        <div className="caja rifa-hero-texto">
          <span className="sello-gran">{t('sorteo_gran', idioma)}</span>
          <h1>{sorteo.titulo}</h1>
          {sorteo.gancho && <p className="rifa-gancho">{sorteo.gancho}</p>}
          {premio && (
            <p className="rifa-premio">
              <strong>{premio}</strong>
              <span>
                {sorteo.premio_titulo}
                {sorteo.premio_nota && <em>{sorteo.premio_nota}</em>}
              </span>
            </p>
          )}
        </div>
      </header>

      <main className="caja rifa-cuerpo">
        <div className="rifa-datos">
          {cuando && (
            <div className="rifa-dato">
              <span>{t('sorteo_cuando', idioma)}</span>
              <strong>{cuando}</strong>
            </div>
          )}
          <div className="rifa-dato">
            <span>{t('sorteo_cuantos', idioma)}</span>
            <strong>
              {sorteo.ganadores === 1
                ? t('sorteo_un_ganador', idioma)
                : `${sorteo.ganadores} ${t('sorteo_ganadores_n', idioma)}`}
            </strong>
          </div>
          {sorteo.en_vivo && (
            <div className="rifa-dato">
              <span>{t('sorteo_como', idioma)}</span>
              <strong>{t('sorteo_en_vivo', idioma)}</strong>
            </div>
          )}
          {/* El conteo solo cuando ya hay gente: "0 apuntados" espanta en vez
              de animar, y una cifra inflada sería mentira. */}
          {sorteo.participantes > 0 && (
            <div className="rifa-dato">
              <span>&nbsp;</span>
              <strong>{sorteo.participantes.toLocaleString(idioma)} {t('sorteo_participantes', idioma)}</strong>
            </div>
          )}
        </div>

        {sorteo.incluye.length > 0 && (
          /* Arriba de las bases y fuera de ellas: lo que incluye el premio es
             el argumento, no la letra chica. Enterrado entre las condiciones
             no lo lee nadie. */
          <section className="rifa-incluye">
            <h2>{t('sorteo_incluye', idioma)}</h2>
            <ul>
              {sorteo.incluye.map((linea) => (
                <li key={linea}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12.5 4.5 4.5L19 7" />
                  </svg>
                  {linea}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="rifa-columnas">
          <div className="rifa-texto">
            {sorteo.en_vivo && (
              <p className="rifa-vivo">
                {t('sorteo_en_vivo_nota', idioma)}
                {sorteo.enlace_vivo && (
                  <>
                    {' '}
                    <a href={sorteo.enlace_vivo} target="_blank" rel="noopener noreferrer">
                      {t('sorteo_ver_en_vivo', idioma)} ↗
                    </a>
                  </>
                )}
              </p>
            )}

            {cerrado ? (
              <div className="rifa-cerrado">
                <h2>{t('sorteo_cerrado', idioma)}</h2>
                {sorteo.ganador_nombre && (
                  <p><strong>{t('sorteo_ganador', idioma)}:</strong> {sorteo.ganador_nombre}</p>
                )}
                {sorteo.ganador_nota && <p>{sorteo.ganador_nota}</p>}
              </div>
            ) : null}

            {sorteo.bases_html && (
              <section className="rifa-bases blog-prosa" id="bases">
                <div dangerouslySetInnerHTML={{ __html: marcarPendientes(htmlDeConfianza(sorteo.bases_html)) }} />
              </section>
            )}
          </div>

          {!cerrado && (
            <aside className="rifa-caja">
              <div className="rifa-caja-dentro">
                <h2>{t('sorteo_participar', idioma)}</h2>
                <FormularioSorteo sorteo={sorteo} idioma={idioma} origen="pagina" />
              </div>
            </aside>
          )}
        </div>
      </main>

      <Pie destino={destino} idioma={idioma} categorias={categorias} />
    </>
  );
}
