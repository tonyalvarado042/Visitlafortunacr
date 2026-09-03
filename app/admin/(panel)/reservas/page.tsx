import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero, ESTADO_RESERVA, relativo } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';

export const dynamic = 'force-dynamic';

export default async function PaginaReservas({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { estado } = await searchParams;
  const { destino, db } = await contextoPanel('reservas');

  let consulta = db
    .from('dst_reserva')
    .select('id, codigo, estado, total_usd, comision_usd, pagado_usd, estado_pago, creado_en, nombre_titular, viajero:dst_viajero(nombre, email, whatsapp, llega_el)')
    .eq('destino_id', destino.id)
    .order('creado_en', { ascending: false })
    .limit(200);
  if (estado && ESTADO_RESERVA[estado]) consulta = consulta.eq('estado', estado);
  const { data } = await consulta;
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const ventas = (data ?? []).filter((r) => !['cancelada', 'no_show'].includes(r.estado)).reduce((a, r) => a + Number(r.total_usd ?? 0), 0);
  const comisiones = (data ?? []).filter((r) => !['cancelada', 'no_show'].includes(r.estado)).reduce((a, r) => a + Number(r.comision_usd ?? 0), 0);

  return (
    <>
      <Cabecera titulo="Reservas" sub={`${data?.length ?? 0} reservas · ${dinero(ventas)} en ventas · ${dinero(comisiones)} de comisión`} />
      <div className="filtros">
        <Link href="/admin/reservas" className={!estado ? 'activo' : ''}>Todas</Link>
        {Object.entries(ESTADO_RESERVA).map(([k, v]) => <Link key={k} href={`/admin/reservas?estado=${k}`} className={estado === k ? 'activo' : ''}>{v.nombre}</Link>)}
      </div>
      <div className="tarjeta desliza">
        {!data?.length ? <Vacio texto="Todavía no hay reservas. Se crean desde la ficha de un lead." /> : (
          <table className="tabla">
            <thead><tr><th>Código</th><th>Viajero</th><th>Estado</th><th>Pago</th><th className="num">Total</th><th className="num">Comisión</th><th>Creada</th></tr></thead>
            <tbody>
              {data.map((r) => {
                const v = uno(r.viajero) as { nombre: string | null; email: string | null; whatsapp: string | null; llega_el: string | null } | null;
                const e = ESTADO_RESERVA[r.estado] ?? { nombre: r.estado, color: '#9CA3AF' };
                return (
                  <tr key={r.id}>
                    <td><Link className="fuerte" href={`/admin/reservas/${r.id}`}>{r.codigo}</Link></td>
                    <td>{r.nombre_titular || v?.nombre || v?.email || v?.whatsapp}{v?.llega_el && <div className="gris">llega {v.llega_el}</div>}</td>
                    <td><Etiqueta color={e.color}>{e.nombre}</Etiqueta></td>
                    <td><Etiqueta suave>{r.estado_pago}</Etiqueta> <span className="gris">{dinero(r.pagado_usd)}</span></td>
                    <td className="num">{dinero(r.total_usd)}</td>
                    <td className="num">{dinero(r.comision_usd)}</td>
                    <td className="gris">{relativo(r.creado_en)}</td>
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
