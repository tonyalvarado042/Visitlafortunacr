import Link from 'next/link';
import { LogoVLF } from './Marca';
import { MenuPerfil } from './MenuPerfil';
import { NOMBRE_PROPIO, t, type Idioma } from '@/lib/idiomas';
import { pareceHaberSesion } from '@/lib/sesion-ligera';
import { destacadoDelMenu, type Destino, type Categoria } from '@/lib/destino';

/*
 * La barra.
 *
 * Antes eran NUEVE enlaces sueltos y cinco pastillas de idioma: pedía 1605px
 * de ancho y la hamburguesa aparecía apenas en 1120. Entre esos dos números
 * —justo donde está una pantalla de portátil— el menú se salía de la pantalla
 * sin plegarse.
 *
 * Y el problema no era el ancho de hoy: era que el menú no dejaba de crecer
 * nunca. Cada sección nueva lo empujaba un poco más al borde hasta romperlo
 * otra vez. Ahora son cinco enlaces fijos, el idioma es un desplegable, y las
 * catorce categorías viven dentro del panel de "Qué hacer", que sí puede
 * crecer sin tocar la barra.
 *
 * Sin JavaScript: es <details>, el mismo patrón del selector de idioma. La
 * barra sigue siendo un componente de servidor y funciona con teclado sin que
 * haya que escribirlo.
 */

/* Qué secciones entran al panel. "Dónde dormir" y "Comer" quedan afuera a
   propósito: son decisiones distintas de "qué hago mañana" y se merecen su
   enlace directo. */
const EN_EL_PANEL = ['que_hacer', 'tours', 'explorar', 'transporte'] as const;

/* Renglones que caben en una columna del panel: un título cuenta como uno.
   Siete es lo que entra sin que el panel pase el alto del hero. */
const RENGLONES = 7;

type Grupo = { titulo: string; items: Categoria[] };

/**
 * Reparte las categorías en columnas de alto parejo.
 *
 * Nueve categorías en una columna al lado de una de dos se ve torcido, así que
 * un grupo largo se parte y la continuación va SIN título: queda pegada a su
 * columna y se lee como lo que es. Al revés, los grupos cortos se apilan en
 * una sola columna en vez de dejar tres columnas casi vacías.
 */
function enColumnas(grupos: Grupo[]): Grupo[][] {
  const columnas: Grupo[][] = [];
  let actual: Grupo[] = [];
  let usado = 0;

  for (const grupo of grupos) {
    let items = grupo.items;
    let titulo = grupo.titulo;

    while (items.length > 0) {
      /* Si en la columna no queda espacio ni para el título y dos renglones,
         mejor empezar otra: un título solo al pie de una columna no sirve. */
      if (RENGLONES - usado - 1 < 2 && actual.length > 0) {
        columnas.push(actual);
        actual = [];
        usado = 0;
      }
      const cabe = Math.min(items.length, RENGLONES - usado - 1);
      actual.push({ titulo, items: items.slice(0, cabe) });
      usado += cabe + 1;
      items = items.slice(cabe);
      titulo = ''; // lo que sobra es continuación, no otra sección
      if (usado >= RENGLONES) {
        columnas.push(actual);
        actual = [];
        usado = 0;
      }
    }
  }
  if (actual.length > 0) columnas.push(actual);
  return columnas;
}

export async function Barra({
  destino, idioma, categorias, rutaActual, sobreHero = false,
}: {
  destino: Destino;
  idioma: Idioma;
  categorias: Categoria[];
  rutaActual: string;
  /** En la portada la barra flota sobre el hero y se vuelve sólida al bajar. */
  sobreHero?: boolean;
}) {
  /* Si hay sesión se mira por la cookie y no contra Supabase: la barra se
     pinta en TODAS las páginas y validar el token aquí le agregaría una
     llamada de red a cada carga del sitio. Ver lib/sesion-ligera.ts. */
  const conSesion = await pareceHaberSesion();

  /* Lo que ocupa la columna destacada del panel. Lo elige Tony en Ajustes;
     si lo apuntado no existe, vuelve null y la columna no se pinta. */
  const destacado = await destacadoDelMenu(destino, idioma);

  const nombre = destino.marca_nombre.replace(/\s+/g, '');
  const corte = nombre.toLowerCase().lastIndexOf('cr');
  const base = corte > 0 ? nombre.slice(0, corte) : nombre;
  const cola = corte > 0 ? nombre.slice(corte) : '';

  // Una categoría sin negocios publicados no entra: un menú lleno de enlaces
  // a páginas vacías hace que un destino nuevo se vea hueco.
  const conContenido = categorias.filter((c) => c.total > 0);
  const deSeccion = (seccion: string) => conContenido.filter((c) => c.seccion === seccion);
  const primeraDe = (seccion: string) => {
    const c = deSeccion(seccion)[0];
    return c ? `/${idioma}/${c.babosa}` : null;
  };

  const columnas = enColumnas(
    EN_EL_PANEL
      .map((seccion) => ({ titulo: t(seccion, idioma), items: deSeccion(seccion) }))
      .filter((g) => g.items.length > 0),
  );

  /* Los enlaces sueltos de la barra. "Qué hacer" no está acá: es el panel. */
  const enlaces = ([
    { clave: 'donde_dormir', href: primeraDe('donde_dormir'), texto: t('donde_dormir', idioma) },
    { clave: 'comer', href: primeraDe('comer_beber'), texto: t('comer', idioma) },
    { clave: 'experiencias', href: `/${idioma}/experiencias`, texto: t('experiencias', idioma) },
    { clave: 'blog', href: `/${idioma}/blog`, texto: t('blog', idioma) },
  ] as { clave: string; href: string | null; texto: string }[])
    .filter((e): e is { clave: string; href: string; texto: string } => e.href !== null);

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
        {columnas.length > 0 && (
          <details className="mega">
            <summary>
              {t('que_hacer', idioma)}
              <svg width="9" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </summary>

            <div className="mega-panel">
              <div className="caja mega-reja">
                <div className="mega-cols">
                {columnas.map((columna, i) => (
                  <div key={`col-${i}`} className="mega-columna">
                    {columna.map((grupo, j) => (
                      <div key={`g-${i}-${j}`} className={grupo.titulo ? undefined : 'sigue'}>
                        {grupo.titulo && <h2>{grupo.titulo}</h2>}
                        <ul>
                          {grupo.items.map((c) => (
                            <li key={c.categoria_id}>
                              <Link href={`/${idioma}/${c.babosa}`}>
                                {c.nombre} <span>{c.total}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
                </div>

                {destacado && (
                  <Link className="mega-destacado" href={destacado.ruta}>
                    <span className="mega-foto">
                      {destacado.imagen_url
                        /* eslint-disable-next-line @next/next/no-img-element */
                        ? <img src={destacado.imagen_url} alt="" loading="lazy" />
                        : <span className="exp-sin-foto" aria-hidden="true" />}
                      <span className="cintillo">{t('destacado_cintillo', idioma)}</span>
                    </span>
                    <strong>{destacado.titulo}</strong>
                    {destacado.bajada && <span className="mega-bajada">{destacado.bajada}</span>}
                    <span className="mega-ir">{t('ver_mas', idioma)} &rarr;</span>
                  </Link>
                )}
              </div>
            </div>
          </details>
        )}

        {enlaces.map((e) => (
          <Link key={e.clave} href={e.href}>{e.texto}</Link>
        ))}
      </nav>

      <div className="acciones">
        {/* El idioma, siempre desplegable. Las cinco pastillas sueltas comían
            207px de barra para algo que casi nadie toca dos veces, y eran la
            mitad del desborde. */}
        <details className="selector-idioma">
          <summary aria-label={t('menu_idioma', idioma)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="1.9" aria-hidden="true">
              <circle cx="12" cy="12" r="9.2" />
              <path d="M2.8 12h18.4M12 2.8c2.4 2.6 3.6 5.8 3.6 9.2s-1.2 6.6-3.6 9.2c-2.4-2.6-3.6-5.8-3.6-9.2S9.6 5.4 12 2.8z" />
            </svg>
            {idioma.toUpperCase()}
            <svg width="9" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
              <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="lista">
            {destino.idiomas.map((codigo) => (
              <Link key={codigo} href={`/${codigo}${rutaActual}`} hrefLang={codigo}
                    aria-current={codigo === idioma}>
                {NOMBRE_PROPIO[codigo]}
              </Link>
            ))}
          </div>
        </details>

        {/* La llamada a la acción: pastilla entera, como pidió Tony. En
            pantalla angosta el texto se acorta en vez de desaparecer. */}
        <Link className="boton armar" href={`/${idioma}#plan`}>
          <span className="armar-largo">{t('armar_viaje', idioma)}</span>
          <span className="armar-corto">{t('armar_viaje_corto', idioma)}</span>
        </Link>

        {conSesion && <MenuPerfil idioma={idioma} />}

        {/* En tablet y teléfono el panel de cuatro columnas no entra: el menú
            entero se pliega acá, con "Qué hacer" abierto de entrada porque es
            la sección con las categorías y la razón por la que alguien abre
            el menú. */}
        <details className="menu-plegado">
          <summary aria-label={t('menu', idioma)}>
            <svg width="17" height="12" viewBox="0 0 17 12" fill="none" aria-hidden="true">
              <path d="M1 1h15M1 6h15M1 11h15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </summary>

          <div className="lista lista-movil">
            {columnas.length > 0 && (
              <details className="plegado-grupo" open>
                <summary>
                  {t('que_hacer', idioma)}
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </summary>
                <div className="plegado-cuerpo">
                  {columnas.flat().map((grupo, i) => (
                    <div key={`m-${i}`}>
                      {grupo.titulo && <h3>{grupo.titulo}</h3>}
                      <div className="plegado-pastillas">
                        {grupo.items.map((c) => (
                          <Link key={c.categoria_id} href={`/${idioma}/${c.babosa}`}>
                            {c.nombre} <span>{c.total}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {enlaces.map((e) => (
              <Link key={e.clave} href={e.href} className="plegado-enlace">{e.texto}</Link>
            ))}

            {destacado && (
              <Link className="plegado-destacado" href={destacado.ruta}>
                {destacado.imagen_url
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={destacado.imagen_url} alt="" loading="lazy" />
                  : <span className="exp-sin-foto" aria-hidden="true" />}
                <span>
                  <em>{t('destacado_cintillo', idioma)}</em>
                  <strong>{destacado.titulo}</strong>
                </span>
              </Link>
            )}

            <div className="plegado-idiomas">
              {destino.idiomas.map((codigo) => (
                <Link key={codigo} href={`/${codigo}${rutaActual}`} hrefLang={codigo}
                      className={codigo === idioma ? 'on' : undefined}>
                  {codigo.toUpperCase()}
                </Link>
              ))}
            </div>

            <Link className="boton plegado-armar" href={`/${idioma}#plan`}>
              {t('armar_viaje', idioma)}
            </Link>
          </div>
        </details>
      </div>
    </header>
  );
}
