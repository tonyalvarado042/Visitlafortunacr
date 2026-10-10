import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { relativo } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaExperiencias() {
  const { destino, db } = await contextoPanel('experiencias');

  /* Solo las del equipo. Los itinerarios que la IA arma para un viajero viven
     en esta misma tabla y no son contenido del sitio: son suyos. */
  const { data } = await db
    .from('dst_itinerario')
    .select('id, titulo, babosa, dias, noches, precio_desde_usd, es_publico, zonas, orden, actualizado_en')
    .eq('destino_id', destino.id)
    .eq('generado_por', 'equipo')
    .order('orden')
    .order('actualizado_en', { ascending: false });

  const lista = data ?? [];
  const publicadas = lista.filter((e) => e.es_publico).length;

  return (
    <>
      <Cabecera
        titulo="Experiencias"
        sub={`${lista.length} armadas · ${publicadas} publicadas`}
      />

      <div className="lado">
        <div className="tarjeta desliza">
          {!lista.length ? (
            <Vacio texto="Todavía no hay experiencias. Son los viajes de varios días que el visitante consulta: no se compran en el sitio, abren un lead y un asesor contesta." />
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Viaje</th><th>Zonas</th><th>Largo</th>
                  <th className="num">Desde</th><th>Estado</th><th>Tocada</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link className="fuerte" href={`/admin/experiencias/${e.id}`}>{e.titulo}</Link>
                      <div className="gris">/{e.babosa}</div>
                    </td>
                    <td>{(e.zonas ?? []).join(' · ') || <span className="gris">—</span>}</td>
                    <td>{e.dias} días{e.noches ? ` · ${e.noches} noches` : ''}</td>
                    <td className="num">
                      {e.precio_desde_usd
                        ? `$${Number(e.precio_desde_usd).toLocaleString('en-US')}`
                        : <span className="gris">—</span>}
                    </td>
                    <td>
                      <Etiqueta color={e.es_publico ? '#66BB2E' : '#9CA3AF'}>
                        {e.es_publico ? 'publicada' : 'borrador'}
                      </Etiqueta>
                    </td>
                    <td className="gris">{relativo(e.actualizado_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="tarjeta">
            <h2>Nueva experiencia</h2>
            <p className="gris" style={{ fontSize: 13, lineHeight: 1.55 }}>
              Un viaje de varios días con hoteles, tours y traslados ya escogidos.
              El cuerpo se escribe en HTML, como un artículo: ahí va el día a día,
              dónde duermen, qué incluye y qué no.
            </p>
            <Link className="boton" href="/admin/experiencias/nueva" style={{ marginTop: 14 }}>
              Armar una
            </Link>
          </div>

          <div className="tarjeta">
            <h2>Cómo se vende</h2>
            <p className="gris" style={{ fontSize: 13, lineHeight: 1.6 }}>
              El botón del sitio <strong>no cobra</strong>: abre una consulta que cae
              en Leads con su etapa. Un asesor revisa disponibilidad real y contesta
              con el precio firme. Por eso el precio se muestra como «desde».
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
