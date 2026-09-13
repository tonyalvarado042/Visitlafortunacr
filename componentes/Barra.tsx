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

  /* Los mismos enlaces se pintan dos veces: en el menú de pantalla ancha y en
     el desplegable. Se arman una sola vez para que no se puedan desincronizar. */
  const enlaces = [
    ...SECCIONES.filter((s) => conContenido.has(s)).map((seccion) => ({
      clave: seccion as string,
      href: `/${idioma}/${primeraDe(seccion)}`,
      texto: t(seccion === 'comer_beber' ? 'comer' : seccion, idioma),
    })),
    { clave: 'plan', href: `/${idioma}#plan`, texto: t('planifica', idioma) },
  ];

  return (
    <header className={sobreHero ? 'barra sobre-hero' : 'barra'} id="barra">
      <Link className="logo" href={`/${idioma}`}>
        {/* El emblema oficial del destino, de dst_destino.logo_url. Un destino
            que todavía no subió el suyo cae al dibujado, que no necesita
            archivo — así ninguno se queda sin marca en la barra.
            El tamaño lo manda el CSS y no el atributo: width/height van solo
            para que el navegador reserve el espacio y la barra no salte. */}
        {destino.logo_url
          ? <img src={destino.logo_url} width={40} height={40}
                 alt={destino.marca_nombre} />
          : <LogoVLF tamano={40} sigla={destino.marca_sigla ?? 'VLF'} />}
        <span className="texto">{base}<i>{cola}</i></span>
      </Link>

      <nav className="menu">
        {enlaces.map((e) => (
          <Link key={e.clave} href={e.href}>{e.texto}</Link>
        ))}
      </nav>

      <div className="acciones">
        {/* En pantalla ancha, pastillas: el idioma se ve y se cambia de un clic.
            Por debajo de 1400px las cinco ya no caben junto al menú, así que se
            pliegan en un desplegable y el botón no se sale de la pantalla. */}
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

        {/* Por debajo de 1120px el menú de arriba no cabe y se apaga. Sin esto,
            tablet y teléfono se quedaban sin navegación. Mismo <details> que
            el idioma: nada de JavaScript, y la barra sigue siendo de servidor. */}
        <details className="menu-plegado">
          <summary aria-label={t('menu', idioma)}>
            <svg width="17" height="12" viewBox="0 0 17 12" fill="none" aria-hidden="true">
              <path d="M1 1h15M1 6h15M1 11h15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="lista">
            {enlaces.map((e) => (
              <Link key={e.clave} href={e.href}>{e.texto}</Link>
            ))}
          </div>
        </details>
      </div>
    </header>
  );
}
