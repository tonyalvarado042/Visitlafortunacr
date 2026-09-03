import { contextoPanel } from '@/lib/admin/contexto';
import { MENU, NOMBRE_ROL, puedeVer } from '@/lib/admin/permisos';
import { NavLateral } from '@/componentes/admin/NavLateral';
import { cambiarDestino, salir } from './acciones-panel';

export const dynamic = 'force-dynamic';

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const { usuario, destino, destinos, db } = await contextoPanel();
  const items = MENU.filter((m) => puedeVer(usuario.rol, m.seccion));

  // Última vez que entró: sirve para saber quién usa el panel.
  void db.rpc('marcar_acceso').then(() => undefined, () => undefined);

  return (
    <div className="panel">
      <aside className="lateral">
        <div className="marca">
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--naranja)', display: 'inline-block' }} />
          <span>{destino.marca_nombre.split(' ')[0]} <i>{destino.marca_nombre.split(' ').slice(1).join(' ')}</i></span>
        </div>

        {destinos.length > 1 ? (
          <form action={cambiarDestino} className="destino">
            <select name="destino_id" defaultValue={destino.id} onChange={undefined}>
              {destinos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            <button type="submit" className="boton chico secundario" style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}>Cambiar destino</button>
          </form>
        ) : (
          <div className="destino" style={{ padding: '0 10px', fontSize: 12.5, color: '#8B8B87' }}>{destino.nombre} · {destino.esta_activo ? 'activo' : 'apagado'}</div>
        )}

        <NavLateral items={items} />

        <div className="usuario">
          <strong>{usuario.nombre}</strong>
          {NOMBRE_ROL[usuario.rol]}
          <form action={salir}><button type="submit">Salir</button></form>
        </div>
      </aside>
      <div className="contenido">{children}</div>
    </div>
  );
}
