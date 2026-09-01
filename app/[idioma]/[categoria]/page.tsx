import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { destinoActual, categoriasDe, negociosDe } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { TarjetaNegocio } from '@/componentes/TarjetaNegocio';

export const dynamic = 'force-dynamic';

type Parametros = Promise<{ idioma: Idioma; categoria: string }>;

export async function generateMetadata({ params }: { params: Parametros }): Promise<Metadata> {
  const { idioma, categoria } = await params;
  try {
    const destino = await destinoActual();
    const cat = (await categoriasDe(destino, idioma)).find((c) => c.babosa === categoria);
    if (!cat) return {};
    return {
      title: `${cat.nombre} · ${destino.nombre}`,
      description: `${cat.total} ${t('lugares', idioma)} · ${cat.nombre} · ${destino.nombre}, ${destino.pais_nombre}`,
    };
  } catch {
    return {};
  }
}

export default async function Listado({ params }: { params: Parametros }) {
  const { idioma, categoria } = await params;
  const destino = await destinoActual();
  const categorias = await categoriasDe(destino, idioma);

  const actual = categorias.find((c) => c.babosa === categoria);
  if (!actual) notFound();

  const negocios = (await negociosDe(destino, idioma))
    .filter((n) => n.categoria_id === actual.categoria_id)
    .sort((a, b) =>
      Number(b.es_destacado) - Number(a.es_destacado) ||
      (b.promedio_calificacion ?? 0) - (a.promedio_calificacion ?? 0)
    );

  const hermanas = categorias.filter((c) => c.seccion === actual.seccion && c.total > 0);

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual={`/${categoria}`} />

      <div className="caja">
        <div className="migas">
          <Link href={`/${idioma}`}>{t('inicio', idioma)}</Link>
          <span>/</span>
          <span style={{ color: 'var(--blanco)' }}>{actual.nombre}</span>
        </div>
      </div>

      <section style={{ paddingTop: 26 }}>
        <div className="caja">
          <h1>{actual.nombre}</h1>
          <p style={{ color: 'var(--humo)', marginTop: 14 }}>
            {negocios.length} {t('lugares', idioma)} · {destino.nombre}
          </p>

          {hermanas.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 26, flexWrap: 'wrap' }}>
              {hermanas.map((c) => (
                <Link key={c.categoria_id} href={`/${idioma}/${c.babosa}`}
                      className="boton boton-linea"
                      style={c.babosa === categoria
                        ? { background: 'var(--blanco)', color: 'var(--negro)', borderColor: 'var(--blanco)' }
                        : undefined}>
                  {c.nombre} <span style={{ opacity: .5 }}>{c.total}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="rejilla" style={{ marginTop: 34 }}>
            {negocios.map((n) => <TarjetaNegocio key={n.id} negocio={n} idioma={idioma} />)}
          </div>

          {negocios.length === 0 && (
            <div className="vacio" style={{ marginTop: 34 }}>
              <h3>{actual.nombre}</h3>
              <p>{t('sin_resenas', idioma)}</p>
            </div>
          )}
        </div>
      </section>

      <Pie destino={destino} />
    </>
  );
}
