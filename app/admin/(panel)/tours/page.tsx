import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { dinero } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { crearTour } from './acciones';

export const dynamic = 'force-dynamic';

const COLOR: Record<string, string> = { borrador: '#9CA3AF', pendiente: '#F59E0B', publicado: '#66BB2E', archivado: '#6B7280' };

export default async function PaginaTours() {
  const { destino, db } = await contextoPanel('tours');
  const [{ data: tours }, { data: operadores }, { data: categorias }] = await Promise.all([
    db.from('dst_tour').select('id, nombre, estado, es_destacado, duracion_horas, precio_adulto_usd, precio_neto_usd, comision_pct, total_reservas, negocio:dst_negocio(nombre)').eq('destino_id', destino.id).order('nombre'),
    db.from('dst_negocio').select('id, nombre').eq('destino_id', destino.id).neq('estado_publicacion', 'archivado').order('nombre'),
    db.from('dst_destino_categoria').select('orden, categoria:dst_categoria(id, nombre, seccion)').eq('destino_id', destino.id).eq('es_visible', true).order('orden'),
  ]);
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const cats = (categorias ?? []).map((c) => uno(c.categoria) as { id: string; nombre: string; seccion: string } | null).filter((c): c is { id: string; nombre: string; seccion: string } => !!c && (c.seccion === 'tours' || c.seccion === 'que_hacer'));

  return (
    <>
      <Cabecera titulo="Tours" sub={`${tours?.length ?? 0} tours · ${tours?.filter((t) => t.estado === 'publicado').length ?? 0} publicados`} />
      <div className="lado">
        <div className="tarjeta desliza">
          {!tours?.length ? <Vacio texto="Todavía no hay tours. El primero es el que la IA va a poder ofrecer y el planificador va a poder poner en un itinerario." /> : (
            <table className="tabla">
              <thead><tr><th>Tour</th><th>Operador</th><th>Estado</th><th className="num">Horas</th><th className="num">Adulto</th><th className="num">Neto</th><th className="num">Comisión</th><th className="num">Reservas</th></tr></thead>
              <tbody>{tours.map((t) => {
                const n = uno(t.negocio) as { nombre: string } | null;
                return (
                  <tr key={t.id}>
                    <td><Link className="fuerte" href={`/admin/tours/${t.id}`}>{t.nombre}</Link>{t.es_destacado && <> <Etiqueta color="#FF6A00">destacado</Etiqueta></>}</td>
                    <td>{n?.nombre ?? '—'}</td>
                    <td><Etiqueta color={COLOR[t.estado]}>{t.estado}</Etiqueta></td>
                    <td className="num">{t.duracion_horas ?? '—'}</td>
                    <td className="num">{dinero(t.precio_adulto_usd)}</td>
                    <td className="num">{dinero(t.precio_neto_usd)}</td>
                    <td className="num">{t.comision_pct != null ? `${t.comision_pct}%` : '—'}</td>
                    <td className="num">{t.total_reservas}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>
        <div className="tarjeta">
          <h2>Nuevo tour</h2>
          <form action={crearTour} className="campos" style={{ gridTemplateColumns: '1fr' }}>
            <div className="campo"><label>Nombre</label><input name="nombre" required /></div>
            <div className="campo"><label>Operador</label><select name="negocio_id" defaultValue=""><option value="">—</option>{operadores?.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select></div>
            <div className="campo"><label>Categoría</label><select name="categoria_id" defaultValue=""><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div className="campo"><label>Precio adulto USD</label><input type="number" step="0.01" name="precio_adulto_usd" /></div>
            <div className="campo"><label>Comisión %</label><input type="number" step="0.5" name="comision_pct" defaultValue={destino.comision_por_defecto ?? ''} /></div>
            <BotonAccion>Crear como borrador</BotonAccion>
          </form>
        </div>
      </div>
    </>
  );
}
