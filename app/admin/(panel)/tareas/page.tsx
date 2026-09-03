import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { relativo } from '@/lib/admin/formato';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { completarTarea, crearTarea } from '../leads/acciones';

export const dynamic = 'force-dynamic';

const COLOR: Record<string, string> = { baja: '#9CA3AF', media: '#3B82F6', alta: '#F59E0B', urgente: '#EF4444' };

export default async function PaginaTareas({ searchParams }: { searchParams: Promise<{ quien?: string; estado?: string }> }) {
  const f = await searchParams;
  const { destino, db, usuario } = await contextoPanel('tareas');
  const hoy = new Date().toISOString().slice(0, 10);

  let consulta = db
    .from('dst_tarea')
    .select('id, titulo, detalle, prioridad, vence_el, esta_hecha, hecha_en, responsable_id, viajero_id, solicitud_id, reserva_id, creado_en, viajero:dst_viajero(nombre)')
    .eq('destino_id', destino.id)
    .order('vence_el', { ascending: true, nullsFirst: false })
    .limit(300);
  consulta = f.estado === 'hechas' ? consulta.eq('esta_hecha', true).order('hecha_en', { ascending: false }) : consulta.eq('esta_hecha', false);
  if (f.quien !== 'todas') consulta = consulta.eq('responsable_id', usuario.id);
  const { data } = await consulta;
  const { data: equipo } = await db.from('dst_usuario').select('id, nombre').eq('esta_activo', true).order('nombre');
  const nombreDe = (id: string | null) => equipo?.find((u) => u.id === id)?.nombre ?? '—';
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);

  return (
    <>
      <Cabecera titulo="Tareas" sub={`${data?.length ?? 0} ${f.estado === 'hechas' ? 'hechas' : 'pendientes'}`} />
      <div className="filtros">
        <Link href="/admin/tareas" className={f.quien !== 'todas' && f.estado !== 'hechas' ? 'activo' : ''}>Mías</Link>
        <Link href="/admin/tareas?quien=todas" className={f.quien === 'todas' && f.estado !== 'hechas' ? 'activo' : ''}>Todas</Link>
        <Link href="/admin/tareas?quien=todas&estado=hechas" className={f.estado === 'hechas' ? 'activo' : ''}>Hechas</Link>
      </div>
      <div className="lado">
        <div className="tarjeta">
          {!data?.length ? <Vacio texto="Nada pendiente." /> : (
            <table className="tabla">
              <thead><tr><th>Tarea</th><th>Prioridad</th><th>Vence</th><th>Responsable</th><th></th></tr></thead>
              <tbody>{data.map((t) => {
                const v = uno(t.viajero) as { nombre: string | null } | null;
                const vencida = !t.esta_hecha && t.vence_el && t.vence_el < hoy;
                return (
                  <tr key={t.id}>
                    <td><strong>{t.titulo}</strong>{t.detalle && <div className="gris">{t.detalle}</div>}<div className="gris">{v?.nombre ?? ''}{t.solicitud_id ? <> · <Link href={`/admin/leads/${t.solicitud_id}`}>lead</Link></> : null}{t.reserva_id ? <> · <Link href={`/admin/reservas/${t.reserva_id}`}>reserva</Link></> : null}{t.viajero_id && !t.solicitud_id ? <> · <Link href={`/admin/viajeros/${t.viajero_id}`}>viajero</Link></> : null}</div></td>
                    <td><Etiqueta color={COLOR[t.prioridad] ?? '#9CA3AF'}>{t.prioridad}</Etiqueta></td>
                    <td style={{ color: vencida ? '#B42318' : undefined, fontWeight: vencida ? 700 : 400 }}>{t.vence_el ?? '—'}{t.esta_hecha && t.hecha_en ? <div className="gris">hecha {relativo(t.hecha_en)}</div> : null}</td>
                    <td>{nombreDe(t.responsable_id)}</td>
                    <td><form action={completarTarea}><input type="hidden" name="tarea_id" value={t.id} />{t.esta_hecha && <input type="hidden" name="deshacer" value="1" />}<BotonAccion clase="boton secundario chico">{t.esta_hecha ? 'Reabrir' : 'Hecha'}</BotonAccion></form></td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>
        <div className="tarjeta">
          <h2>Nueva tarea</h2>
          <form action={crearTarea} className="campos" style={{ gridTemplateColumns: '1fr' }}>
            <input type="hidden" name="volver" value="/admin/tareas" />
            <div className="campo"><label>Título</label><input name="titulo" required /></div>
            <div className="campo"><label>Detalle</label><textarea name="detalle" style={{ minHeight: 60 }} /></div>
            <div className="campo"><label>Vence</label><input type="date" name="vence_el" defaultValue={hoy} /></div>
            <div className="campo"><label>Prioridad</label><select name="prioridad" defaultValue="media"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></div>
            <div className="campo"><label>Responsable</label><select name="responsable_id" defaultValue={usuario.id}>{equipo?.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
            <BotonAccion>Crear</BotonAccion>
          </form>
        </div>
      </div>
    </>
  );
}
