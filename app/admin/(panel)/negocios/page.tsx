import Link from 'next/link';
import { contextoPanel } from '@/lib/admin/contexto';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { crearNegocio } from './acciones';

export const dynamic = 'force-dynamic';

const PUB: Record<string, string> = { borrador: '#9CA3AF', pendiente: '#F59E0B', publicado: '#66BB2E', archivado: '#6B7280' };
const VER: Record<string, string> = { pendiente: '#9CA3AF', parcial: '#F59E0B', verificado: '#66BB2E', reclamado: '#3B82F6' };

export default async function PaginaNegocios({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; seccion?: string }> }) {
  const f = await searchParams;
  const { destino, db } = await contextoPanel('negocios');

  let consulta = db
    .from('dst_negocio')
    .select('id, nombre, babosa, estado_publicacion, estado_verificacion, membresia, es_destacado, es_casa, esta_cerrado, rango_precio, promedio_calificacion, total_resenas, total_vistas, telefono_whatsapp, email, actualizado_en, categoria:dst_categoria!inner(nombre, babosa, seccion)')
    .eq('destino_id', destino.id)
    .order('nombre')
    .limit(500);
  if (f.estado) consulta = consulta.eq('estado_publicacion', f.estado);
  if (f.seccion) consulta = consulta.eq('categoria.seccion', f.seccion);
  const limpio = f.q?.replace(/[,()%*]/g, ' ').trim();
  if (limpio) consulta = consulta.ilike('nombre', `%${limpio}%`);
  const [{ data }, { data: categorias }] = await Promise.all([
    consulta,
    db.from('dst_destino_categoria').select('orden, categoria:dst_categoria(id, nombre, seccion)').eq('destino_id', destino.id).eq('es_visible', true).order('orden'),
  ]);
  const uno = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? x[0] ?? null : x);
  const cats = (categorias ?? []).map((c) => uno(c.categoria) as { id: string; nombre: string; seccion: string } | null).filter((c): c is { id: string; nombre: string; seccion: string } => !!c);
  const secciones = [...new Set(cats.map((c) => c.seccion))];

  return (
    <>
      <Cabecera titulo="Negocios" sub={`${data?.length ?? 0} en ${destino.nombre}`} />
      <div className="filtros">
        <form action="/admin/negocios" method="get"><input type="search" name="q" placeholder="Buscar" defaultValue={f.q ?? ''} /></form>
        {['borrador', 'pendiente', 'publicado', 'archivado'].map((e) => <Link key={e} href={`/admin/negocios?estado=${f.estado === e ? '' : e}`} className={f.estado === e ? 'activo' : ''}>{e}</Link>)}
        <span style={{ width: 10 }} />
        {secciones.map((s) => <Link key={s} href={`/admin/negocios?seccion=${f.seccion === s ? '' : s}`} className={f.seccion === s ? 'activo' : ''}>{s.replace('_', ' ')}</Link>)}
      </div>

      <div className="lado">
        <div className="tarjeta desliza">
          {!data?.length ? <Vacio texto="No hay negocios con esos filtros." /> : (
            <table className="tabla">
              <thead><tr><th>Negocio</th><th>Categoría</th><th>Publicación</th><th>Verificación</th><th>Membresía</th><th className="num">Nota</th><th className="num">Vistas</th></tr></thead>
              <tbody>{data.map((n) => {
                const c = uno(n.categoria) as { nombre: string; babosa: string; seccion: string } | null;
                return (
                  <tr key={n.id}>
                    <td><Link className="fuerte" href={`/admin/negocios/${n.id}`}>{n.nombre}</Link>{n.es_destacado && <> <Etiqueta color="#FF6A00">destacado</Etiqueta></>}{n.esta_cerrado && <> <Etiqueta color="#B42318">cerrado</Etiqueta></>}<div className="gris">{n.telefono_whatsapp ?? n.email ?? ''}{n.rango_precio ? ` · ${n.rango_precio}` : ''}</div></td>
                    <td>{c?.nombre}<div className="gris">{c?.seccion}</div></td>
                    <td><Etiqueta color={PUB[n.estado_publicacion]}>{n.estado_publicacion}</Etiqueta></td>
                    <td><Etiqueta color={VER[n.estado_verificacion]}>{n.estado_verificacion}</Etiqueta></td>
                    <td>{n.membresia}</td>
                    <td className="num">{n.promedio_calificacion ?? '—'} <span className="gris">({n.total_resenas})</span></td>
                    <td className="num">{n.total_vistas}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}
        </div>
        <div className="tarjeta">
          <h2>Nuevo negocio</h2>
          <form action={crearNegocio} className="campos" style={{ gridTemplateColumns: '1fr' }}>
            <div className="campo"><label>Nombre</label><input name="nombre" required /></div>
            <div className="campo"><label>Categoría</label><select name="categoria_id" required defaultValue="">
              <option value="" disabled>Elegí una</option>
              {secciones.map((s) => <optgroup key={s} label={s}>{cats.filter((c) => c.seccion === s).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</optgroup>)}
            </select></div>
            <BotonAccion>Crear como borrador</BotonAccion>
          </form>
          <p className="gris" style={{ color: '#8B8B87', fontSize: 12.5 }}>Nace en borrador: no se ve en el sitio hasta que lo publiques con descripción.</p>
        </div>
      </div>
    </>
  );
}
