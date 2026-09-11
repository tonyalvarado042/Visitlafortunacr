import Link from 'next/link';
import { TarjetaNegocio } from './TarjetaNegocio';
import { t, lugares, type Idioma } from '@/lib/idiomas';
import type { Negocio, Categoria } from '@/lib/destino';

/* Lo que se ve en la portada cuando hay una búsqueda. No tiene estado: los
   filtros son enlaces y todo vive en la URL, así que la búsqueda se puede
   compartir y el botón atrás del navegador funciona. */

export function Resultados({
  negocios, categorias, idioma, consulta, categoriaActiva,
}: {
  /** Ya filtrados por texto, sin filtrar por categoría. */
  negocios: Negocio[];
  categorias: Categoria[];
  idioma: Idioma;
  consulta: string;
  categoriaActiva: string;
}) {
  // El conteo de cada pastilla es dentro de la búsqueda actual, no del
  // directorio entero: decir "Cataratas 3" cuando solo una coincide engaña.
  const cuenta = new Map<string, number>();
  for (const n of negocios) cuenta.set(n.categoria_babosa, (cuenta.get(n.categoria_babosa) ?? 0) + 1);

  const conResultados = categorias.filter((c) => cuenta.has(c.babosa));
  const visibles = categoriaActiva
    ? negocios.filter((n) => n.categoria_babosa === categoriaActiva)
    : negocios;

  const enlace = (babosa: string) => {
    const p = new URLSearchParams();
    if (consulta) p.set('q', consulta);
    else p.set('ver', 'todo');
    if (babosa) p.set('cat', babosa);
    return `/${idioma}?${p}`;
  };

  return (
    <section className="zona" id="resultados">
      <div className="caja">
        <div className="cabecera-seccion">
          <div>
            <span className="rotulo">{t(consulta ? 'resultados' : 'todo_el_directorio', idioma)}</span>
            <h2>
              {visibles.length} {lugares(visibles.length, idioma)}
              {consulta && <> · <em style={{ fontStyle: 'normal', color: 'var(--naranja)' }}>{consulta}</em></>}
            </h2>
          </div>
          <Link className="enlace-mas" href={`/${idioma}`}>✕ {t('limpiar', idioma)}</Link>
        </div>

        {conResultados.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 34, flexWrap: 'wrap' }}>
            <Link href={enlace('')} className="boton boton-linea"
                  style={!categoriaActiva ? { background: 'var(--blanco)', color: 'var(--negro)', borderColor: 'var(--blanco)' } : undefined}>
              {t('todas', idioma)} <span style={{ opacity: .5 }}>{negocios.length}</span>
            </Link>
            {conResultados.map((c) => (
              <Link key={c.categoria_id} href={enlace(c.babosa)} className="boton boton-linea"
                    style={c.babosa === categoriaActiva ? { background: 'var(--blanco)', color: 'var(--negro)', borderColor: 'var(--blanco)' } : undefined}>
                {c.nombre} <span style={{ opacity: .5 }}>{cuenta.get(c.babosa)}</span>
              </Link>
            ))}
          </div>
        )}

        {visibles.length > 0 ? (
          <div className="rejilla">
            {visibles.map((n) => <TarjetaNegocio key={n.id} negocio={n} idioma={idioma} />)}
          </div>
        ) : (
          <div className="vacio">
            <h3>{t('sin_resultados', idioma)}</h3>
            <p>{t('sin_resultados_pista', idioma)}</p>
          </div>
        )}
      </div>
    </section>
  );
}
