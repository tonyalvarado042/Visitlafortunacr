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
        {/* Pastillas, no desplegable: el idioma se ve y se cambia de un clic. */}
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
        <Link className="boton" href={`/${idioma}#plan`}>{t('armar_viaje', idioma)}</Link>
      </div>
    </header>
  );
}
