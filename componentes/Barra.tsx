import Link from 'next/link';
import { LogoVLF } from './Marca';
import { NOMBRE_PROPIO, t, type Idioma } from '@/lib/idiomas';
import type { Destino, Categoria } from '@/lib/destino';

const SECCIONES = ['que_hacer', 'tours', 'donde_dormir', 'comer_beber', 'explorar', 'transporte'] as const;

export function Barra({
  destino, idioma, categorias, rutaActual, sobreHero = false,
}: {
  destino: Destino;
  idioma: Idioma;
  categorias: Categoria[];
  rutaActual: string;
  /** En la portada la barra flota sobre el hero y se vuelve sólida al bajar. */
  sobreHero?: boolean;
}) {
  // Una sección solo entra al menú si tiene al menos un negocio publicado:
  // un menú lleno de secciones vacías hace que un destino nuevo se vea hueco.
  const conContenido = new Set(categorias.filter((c) => c.total > 0).map((c) => c.seccion));
  const primeraDe = (seccion: string) =>
    categorias.find((c) => c.seccion === seccion && c.total > 0)?.babosa;

  const nombre = destino.marca_nombre.replace(/\s+/g, '');
  const corte = nombre.toLowerCase().lastIndexOf('cr');
  const base = corte > 0 ? nombre.slice(0, corte) : nombre;
  const cola = corte > 0 ? nombre.slice(corte) : '';

  return (
    <header className={sobreHero ? 'barra sobre-hero' : 'barra'} id="barra">
      <Link className="logo" href={`/${idioma}`}>
        <LogoVLF tamano={32} sigla={destino.marca_sigla ?? 'VLF'} />
        <span className="texto">{base}<i>{cola}</i></span>
      </Link>

      <nav className="menu">
        {SECCIONES.filter((s) => conContenido.has(s)).map((seccion) => (
          <Link key={seccion} href={`/${idioma}/${primeraDe(seccion)}`}>
            {t(seccion === 'comer_beber' ? 'comer' : seccion, idioma)}
          </Link>
        ))}
        <Link href={`/${idioma}#plan`}>{t('planifica', idioma)}</Link>
      </nav>

      <div className="acciones">
        {/* En pantalla ancha, pastillas: el idioma se ve y se cambia de un clic.
            En el teléfono no caben cinco, así que se pliegan en un desplegable
            y el botón de armar el viaje no se sale de la pantalla. */}
        <nav className="idiomas" aria-label="Idioma">
          {destino.idiomas.map((codigo) => (
            <Link key={codigo} href={`/${codigo}${rutaActual}`}
                  className={codigo === idioma ? 'on' : 'off'}
                  aria-current={codigo === idioma}
                  title={NOMBRE_PROPIO[codigo]}>
              {codigo.toUpperCase()}
            </Link>
          ))}
        </nav>

        <details className="selector-idioma">
          <summary aria-label="Idioma">
            {idioma.toUpperCase()}
            <svg width="9" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
              <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="lista">
            {destino.idiomas.map((codigo) => (
              <Link key={codigo} href={`/${codigo}${rutaActual}`} aria-current={codigo === idioma}>
                {NOMBRE_PROPIO[codigo]}
              </Link>
            ))}
          </div>
        </details>

        <Link className="boton armar" href={`/${idioma}#plan`}>{t('armar_viaje', idioma)}</Link>
      </div>
    </header>
  );
}
