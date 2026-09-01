import Link from 'next/link';
import { destinoActual, categoriasDe, negociosDe } from '@/lib/destino';
import { t, type Idioma } from '@/lib/idiomas';
import { Barra } from '@/componentes/Barra';
import { Pie } from '@/componentes/Pie';
import { TarjetaNegocio } from '@/componentes/TarjetaNegocio';
import { Planificador } from '@/componentes/Planificador';

export const dynamic = 'force-dynamic';

export default async function Portada({ params }: { params: Promise<{ idioma: Idioma }> }) {
  const { idioma } = await params;
  const destino = await destinoActual();
  const [categorias, negocios] = await Promise.all([
    categoriasDe(destino, idioma),
    negociosDe(destino, idioma),
  ]);

  const conContenido = categorias.filter((c) => c.total > 0);
  // Los destacados pagados primero, y dentro de cada grupo los mejor valorados.
  const portada = [...negocios]
    .sort((a, b) =>
      Number(b.es_destacado) - Number(a.es_destacado) ||
      (b.promedio_calificacion ?? 0) - (a.promedio_calificacion ?? 0)
    )
    .slice(0, 6);

  const intereses = conContenido
    .filter((c) => ['que_hacer', 'tours'].includes(c.seccion))
    .slice(0, 8)
    .map((c) => ({ babosa: c.babosa, nombre: c.nombre }));

  return (
    <>
      <Barra destino={destino} idioma={idioma} categorias={categorias} rutaActual="" />

      <section style={{ paddingTop: 92, paddingBottom: 64 }}>
        <div className="caja">
          <span className="rotulo">
            {[destino.nombre_largo ?? destino.nombre, destino.pais_nombre].join(' · ')}
          </span>
          <h1>{destino.marca_nombre}</h1>
          {destino.lema && (
            <p style={{ fontSize: 20, color: '#C6C4C0', maxWidth: '46ch', margin: '22px 0 0' }}>
              {destino.lema}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 30, flexWrap: 'wrap' }}>
            {conContenido.slice(0, 7).map((c) => (
              <Link key={c.categoria_id} className="boton boton-linea" href={`/${idioma}/${c.babosa}`}>
                {c.nombre} <span style={{ opacity: .5 }}>{c.total}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }}>
        <div className="caja">
          <div className="cabecera-seccion">
            <h2>{t('que_hacer', idioma)}</h2>
            <span className="enlace-mas">{negocios.length} {t('lugares', idioma)}</span>
          </div>
          <div className="rejilla">
            {portada.map((n) => <TarjetaNegocio key={n.id} negocio={n} idioma={idioma} />)}
          </div>
        </div>
      </section>

      <section id="plan" style={{ paddingTop: 0 }}>
        <div className="caja">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 400px', gap: 48, alignItems: 'center' }}>
            <div>
              <span className="rotulo">{t('armar_viaje', idioma)}</span>
              <h2>{t('que_te_mueve', idioma)}</h2>
              <p style={{ fontSize: 16.5, color: '#C2C0BC', maxWidth: '44ch', marginTop: 18 }}>
                {t('sin_costo', idioma)}
              </p>
            </div>
            <Planificador idioma={idioma} intereses={intereses} />
          </div>
        </div>
      </section>

      <Pie destino={destino} />
    </>
  );
}
