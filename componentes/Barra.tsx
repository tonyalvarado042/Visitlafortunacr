import Link from 'next/link';
import { LogoVLF } from './Marca';
import { NOMBRE_PROPIO, t, type Idioma } from '@/lib/idiomas';
import type { Destino, Categoria } from '@/lib/destino';

const SECCIONES = ['que_hacer', 'tours', 'donde_dormir', 'comer_beber', 'explorar', 'transporte'] as const;

export function Barra({
  destino, idioma, categorias, rutaActual,
}: {
  destino: Destino;
  idioma: Idioma;
  categorias: Categoria[];
  rutaActual: string;
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
    <header className="barra">
      <Link className="logo" href={`/${idioma}`}>
        <LogoVLF tamano={32} sigla={destino.marca_sigla ?? 'VLF'} />
        <span className="texto">{base}<i>{cola}</i></span>
      </Link>

      <nav className="menu">
        {SECCIONES.filter((s) => conContenido.has(s)).map((seccion) => (
          <Link key={seccion} href={`/${idioma}/${primeraDe(seccion)}`}>
            {t(seccion, idioma)}
          </Link>
        ))}
      </nav>

      <div className="acciones">
        <details className="selector-idioma">
          <summary>
            {idioma.toUpperCase()}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          <div className="lista">
            {destino.idiomas.map((codigo) => (
              <Link key={codigo} href={`/${codigo}${rutaActual}`} aria-current={codigo === idioma}>
                {NOMBRE_PROPIO[codigo]}
              </Link>
            ))}
          </div>
        </details>
        <Link className="boton" href={`/${idioma}#plan`}>{t('armar_viaje', idioma)}</Link>
      </div>
    </header>
  );
}
