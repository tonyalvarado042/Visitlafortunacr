import Link from 'next/link';
import { redirect } from 'next/navigation';
import { usuarioActual } from '@/lib/supabase-sesion';
import { salir } from '@/app/admin/(panel)/acciones-panel';

export const dynamic = 'force-dynamic';

export default async function SinAcceso() {
  const actual = await usuarioActual();

  // usuarioActual reclama una invitación pendiente: si acabaron de invitar a
  // esta cuenta, ya es del equipo y no tiene nada que hacer en esta página.
  if (actual?.usuario?.esta_activo) redirect('/admin');

  const desactivada = !!actual?.usuario && !actual.usuario.esta_activo;

  return (
    <div className="ingreso">
      <div className="caja-ingreso">
        <h1>{desactivada ? 'Tu cuenta está desactivada' : 'Tu cuenta no tiene acceso'}</h1>
        <p className="sub">
          {actual?.cuenta.email ? <>Entraste como <strong style={{ color: '#fff' }}>{actual.cuenta.email}</strong>. </> : null}
          {desactivada
            ? 'Un administrador la apagó. Pedile que la vuelva a activar desde Equipo.'
            : 'Al panel se entra por invitación: un administrador tiene que invitar ese mismo correo desde Equipo. Cuando lo haga, recargá esta página y entrás solo, sin volver a registrarte. Si te invitaron con otro correo, salí y entrá con ese.'}
        </p>
        <div className="acciones-fila">
          <Link className="boton secundario" href="/admin">Recargar</Link>
          <form action={salir}><button className="boton" type="submit">Salir</button></form>
        </div>
      </div>
    </div>
  );
}
