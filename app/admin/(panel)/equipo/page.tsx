import { contextoPanel } from '@/lib/admin/contexto';
import { NOMBRE_ROL } from '@/lib/admin/permisos';
import { fecha, relativo } from '@/lib/admin/formato';
import type { Rol } from '@/lib/supabase-sesion';
import { Cabecera, Etiqueta, Vacio } from '@/componentes/admin/ui';
import { BotonAccion } from '@/componentes/admin/BotonAccion';
import { cancelarInvitacion, editarUsuario, invitar } from './acciones';

export const dynamic = 'force-dynamic';

const ROLES: Rol[] = ['admin', 'vendedor', 'editor', 'moderador', 'socio'];

export default async function PaginaEquipo() {
  const { db, usuario, destinos, destino } = await contextoPanel('equipo');
  const esAdmin = usuario.rol === 'admin';
  const [{ data: equipo }, { data: invitaciones }, { data: auditoria }] = await Promise.all([
    db.from('dst_usuario').select('id, nombre, email, telefono, rol, destinos_ids, meta_mensual, esta_activo, ultimo_acceso_en, creado_en').order('nombre'),
    esAdmin ? db.from('dst_invitacion').select('id, email, nombre, rol, destinos_ids, vence_el, creado_en, aceptada_en').is('aceptada_en', null).order('creado_en', { ascending: false }) : Promise.resolve({ data: [] }),
    db.from('dst_auditoria').select('id, usuario_id, actor, accion, entidad, entidad_id, antes, despues, creado_en').or(`destino_id.eq.${destino.id},destino_id.is.null`).order('creado_en', { ascending: false }).limit(80),
  ]);
  const nombreDe = (id: string | null) => equipo?.find((u) => u.id === id)?.nombre ?? null;

  return (
    <>
      <Cabecera titulo="Equipo" sub={`${equipo?.length ?? 0} personas · ${invitaciones?.length ?? 0} invitaciones pendientes`} />

      <div className="tarjeta desliza">
        <h2>Personas</h2>
        {!equipo?.length ? <Vacio texto="Nadie todavía." /> : (
          <table className="tabla">
            <thead><tr><th>Nombre</th><th>Rol</th><th>Destinos</th><th className="num">Meta mensual USD</th><th>Último acceso</th><th>Estado</th><th></th></tr></thead>
            <tbody>{equipo.map((u) => {
              const puedeEditar = esAdmin || u.id === usuario.id;
              return (
                <tr key={u.id}>
                  <td colSpan={7} style={{ padding: 0 }}>
                    <form action={editarUsuario} style={{ display: 'grid', gridTemplateColumns: '1.4fr .9fr 1.4fr .8fr .9fr .7fr auto', gap: 8, alignItems: 'center', padding: '10px' }}>
                      <input type="hidden" name="id" value={u.id} />
                      <div><input name="nombre" defaultValue={u.nombre} disabled={!puedeEditar} style={{ width: '100%', border: '1px solid #E6E6E2', borderRadius: 6, padding: '6px 8px', fontFamily: 'inherit', fontWeight: 700 }} /><div className="gris">{u.email}{u.telefono ? ` · ${u.telefono}` : ''}</div></div>
                      <div>{esAdmin ? <select name="rol" defaultValue={u.rol} style={{ width: '100%', border: '1px solid #E6E6E2', borderRadius: 6, padding: '6px 8px', fontFamily: 'inherit' }}>{ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}</select> : NOMBRE_ROL[u.rol as Rol]}</div>
                      <div style={{ fontSize: 12.5 }}>{esAdmin ? destinos.map((d) => <label key={d.id} style={{ display: 'block' }}><input type="checkbox" name="destinos_ids" value={d.id} defaultChecked={(u.destinos_ids ?? []).includes(d.id)} /> {d.nombre}</label>) : ((u.destinos_ids ?? []).length ? destinos.filter((d) => u.destinos_ids.includes(d.id)).map((d) => d.nombre).join(', ') : 'todos')}{esAdmin && <div className="gris">sin marcar = todos</div>}</div>
                      <div><input type="number" name="meta_mensual" defaultValue={u.meta_mensual ?? ''} disabled={!puedeEditar} style={{ width: '100%', border: '1px solid #E6E6E2', borderRadius: 6, padding: '6px 8px', fontFamily: 'inherit' }} /></div>
                      <div className="gris">{u.ultimo_acceso_en ? relativo(u.ultimo_acceso_en) : 'nunca'}</div>
                      <div>{esAdmin && u.id !== usuario.id ? <label><input type="checkbox" name="esta_activo" value="1" defaultChecked={u.esta_activo} /> activo</label> : <Etiqueta color={u.esta_activo ? '#66BB2E' : '#B42318'}>{u.esta_activo ? 'activo' : 'inactivo'}</Etiqueta>}</div>
                      <div>{puedeEditar && <BotonAccion clase="boton secundario chico">Guardar</BotonAccion>}</div>
                    </form>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>

      {esAdmin && (
        <div className="lado">
          <div className="tarjeta">
            <h2>Invitaciones pendientes</h2>
            {!invitaciones?.length ? <Vacio texto="Ninguna. Cuando la persona cree su cuenta con el correo invitado, entra con ese rol." /> : (
              <table className="tabla">
                <thead><tr><th>Correo</th><th>Rol</th><th>Destinos</th><th>Vence</th><th></th></tr></thead>
                <tbody>{invitaciones.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.email}</strong>{i.nombre && <div className="gris">{i.nombre}</div>}</td>
                    <td>{NOMBRE_ROL[i.rol as Rol]}</td>
                    <td className="gris">{(i.destinos_ids ?? []).length ? destinos.filter((d) => i.destinos_ids.includes(d.id)).map((d) => d.nombre).join(', ') : 'todos'}</td>
                    <td className="gris">{fecha(i.vence_el, destino.zona_horaria, false)}</td>
                    <td><form action={cancelarInvitacion}><input type="hidden" name="id" value={i.id} /><BotonAccion clase="boton peligro chico">Cancelar</BotonAccion></form></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <div className="tarjeta">
            <h2>Invitar</h2>
            <form action={invitar} className="campos" style={{ gridTemplateColumns: '1fr' }}>
              <div className="campo"><label>Correo</label><input type="email" name="email" required /></div>
              <div className="campo"><label>Nombre</label><input name="nombre" /></div>
              <div className="campo"><label>Rol</label><select name="rol" defaultValue="vendedor">{ROLES.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}</select></div>
              <div className="campo"><label>Destinos (sin marcar = todos)</label>{destinos.map((d) => <label key={d.id} style={{ display: 'block', fontSize: 13 }}><input type="checkbox" name="destinos_ids" value={d.id} /> {d.nombre}</label>)}</div>
              <BotonAccion>Invitar</BotonAccion>
            </form>
            <p className="gris" style={{ color: '#8B8B87', fontSize: 12.5 }}>La invitación no manda correo: pasale el enlace del panel y que cree su cuenta con ese correo. Vence en 14 días.</p>
          </div>
        </div>
      )}

      <div className="tarjeta desliza">
        <h2>Auditoría <small>quién cambió qué</small></h2>
        {!auditoria?.length ? <Vacio texto="Sin cambios registrados todavía." /> : (
          <table className="tabla">
            <thead><tr><th>Cuándo</th><th>Quién</th><th>Acción</th><th>Entidad</th><th>Cambio</th></tr></thead>
            <tbody>{auditoria.map((a) => {
              const claves = Object.keys((a.despues as Record<string, unknown> | null) ?? (a.antes as Record<string, unknown> | null) ?? {});
              return (
                <tr key={a.id}>
                  <td className="gris">{fecha(a.creado_en, destino.zona_horaria)}</td>
                  <td>{nombreDe(a.usuario_id) ?? a.actor}</td>
                  <td>{a.accion}</td>
                  <td>{a.entidad.replace('dst_', '')}<div className="gris">{a.entidad_id?.slice(0, 8)}</div></td>
                  <td className="gris">{a.accion === 'update' ? claves.map((k) => `${k}: ${JSON.stringify((a.antes as Record<string, unknown>)?.[k])} → ${JSON.stringify((a.despues as Record<string, unknown>)?.[k])}`).join(' · ').slice(0, 220) : claves.slice(0, 8).join(', ')}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
