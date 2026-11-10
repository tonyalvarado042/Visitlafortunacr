import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { relativo } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';

/*
 * Los planes que armó la IA, todos juntos.
 *
 * Tony, 10 de noviembre de 2026: *«¿dónde puedo ver los correos que salen y
 * los planes que creó la IA?»*. Los correos sí tenían dónde —Conversaciones y
 * la ficha del lead— pero los planes NO: solo se llegaba a uno entrando al
 * lead de la persona que lo pidió, y únicamente si el plan colgaba de ESA
 * solicitud. Un plan hecho para alguien que escribió dos veces quedaba
 * invisible. Ya pasó.
 *
 * ⚠️ ESTA PANTALLA NO ES UNA LISTA, ES UN CONTROL DE CALIDAD.
 * Las columnas «del catálogo» y «dónde dormir» están porque un plan se ve
 * bien y puede estar vacío por dentro: paradas de texto libre que no llevan a
 * ninguna ficha, o ningún lugar donde quedarse. El plan que recibió una
 * viajera el 9 de noviembre tenía diez paradas y cero alojamiento, y eso no
 * se veía en ninguna parte. Acá se ve de un vistazo.
 */
export const dynamic = 'force-dynamic';

type Parada = {
  itinerario_id: string;
  negocio_id: string | null;
  tour_id: string | null;
  negocio: { categoria: { seccion: string } | { seccion: string }[] | null } | null;
};

const uno = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);

export default async function PaginaPlanes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const { destino, db } = await contextoPanel('planes');

  let consulta = db
    .from('dst_itinerario')
    .select('id, titulo, babosa, dias, empieza_el, personas, tipo_viajero, total_usd, idioma, es_publico, generado_por, creado_en, viajero_id, solicitud_id, viajero:dst_viajero(nombre, apellidos, email)')
    .eq('destino_id', destino.id)
    .order('creado_en', { ascending: false })
    .limit(200);
  const limpio = q?.replace(/[,()%*]/g, ' ').trim();
  if (limpio) consulta = consulta.ilike('titulo', `%${limpio}%`);
  const { data, error } = await consulta;

  /* Las paradas de todos los planes de la lista, de un viaje. Una consulta por
     plan serían doscientas: la lista entera se cae de lenta y nadie sabe por
     qué. */
  const ids = (data ?? []).map((p) => p.id);
  const { data: paradas } = ids.length
    ? await db
        .from('dst_itinerario_parada')
        .select('itinerario_id, negocio_id, tour_id, negocio:dst_negocio(categoria:dst_categoria(seccion))')
        .in('itinerario_id', ids)
    : { data: [] as Parada[] };

  const porPlan = new Map<string, { total: number; delCatalogo: number; duerme: number }>();
  for (const p of (paradas ?? []) as Parada[]) {
    const fila = porPlan.get(p.itinerario_id) ?? { total: 0, delCatalogo: 0, duerme: 0 };
    fila.total += 1;
    if (p.negocio_id || p.tour_id) fila.delCatalogo += 1;
    const categoria = p.negocio ? uno(uno(p.negocio)?.categoria) : null;
    if (categoria?.seccion === 'donde_dormir') fila.duerme += 1;
    porPlan.set(p.itinerario_id, fila);
  }

  return (
    <>
      <Cabecera titulo="Planes" sub={`${data?.length ?? 0} itinerarios · ${destino.nombre}`} />

      {error && (
        <div className="aviso mal">
          <strong>No se pudieron leer.</strong> La base dijo: <code>{error.message}</code>
        </div>
      )}

      <div className="filtros">
        <form action="/admin/planes" method="get">
          <input type="search" name="q" placeholder="Buscar por título" defaultValue={q ?? ''} />
        </form>
      </div>

      <div className="tarjeta desliza">
        {!data?.length ? <Vacio texto="Todavía no hay planes armados." /> : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Plan</th><th>Para quién</th><th>Días</th><th>Empieza</th>
                <th>Paradas</th><th>Dónde dormir</th><th>Estimado</th><th>Hecho</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => {
                const v = uno(p.viajero as never) as { nombre?: string; apellidos?: string; email?: string } | null;
                const cuenta = porPlan.get(p.id) ?? { total: 0, delCatalogo: 0, duerme: 0 };
                const libres = cuenta.total - cuenta.delCatalogo;
                return (
                  <tr key={p.id}>
                    <td>
                      {/* Al plan público, que es lo que ve el viajero. Si no es
                          público todavía, no hay adónde ir: se dice y ya. */}
                      {p.es_publico
                        ? <a className="fuerte" href={`/${p.idioma ?? 'es'}/plan/${p.babosa}`} target="_blank" rel="noreferrer">{p.titulo} ↗</a>
                        : <span className="fuerte">{p.titulo}</span>}
                      <div className="gris">
                        {p.idioma ?? '—'} · {p.generado_por ?? 'ia'}
                        {!p.es_publico && <> · <Etiqueta color="#B42318">sin publicar</Etiqueta></>}
                      </div>
                    </td>
                    <td>
                      {p.viajero_id
                        ? <Link href={`/admin/viajeros/${p.viajero_id}`}>{[v?.nombre, v?.apellidos].filter(Boolean).join(' ') || v?.email || 'ver viajero'}</Link>
                        : <span className="gris">sin viajero</span>}
                      {p.solicitud_id && <div className="gris"><Link href={`/admin/leads/${p.solicitud_id}`}>su lead →</Link></div>}
                    </td>
                    <td>{p.dias ?? '—'}{p.personas ? ` · ${p.personas} 👤` : ''}</td>
                    <td className="gris">{p.empieza_el ?? '—'}</td>
                    <td>
                      {cuenta.total}
                      {/* Una parada «libre» no lleva a ninguna ficha: no vende
                          nada y el viajero no puede reservarla. */}
                      {libres > 0 && <div className="gris">{libres} sin ficha</div>}
                    </td>
                    <td>
                      {cuenta.duerme > 0
                        ? <Etiqueta color="#2E7D32">sí</Etiqueta>
                        : <Etiqueta color="#B42318">no</Etiqueta>}
                    </td>
                    <td className="gris">{p.total_usd != null ? `$${Math.round(Number(p.total_usd))}` : '—'}</td>
                    <td className="gris">{relativo(p.creado_en as string)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
