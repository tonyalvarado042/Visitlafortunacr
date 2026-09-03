import { usuarioActual } from '@/lib/supabase-sesion';
import { salir } from '@/app/admin/(panel)/acciones-panel';

export const dynamic = 'force-dynamic';

export default async function SinAcceso() {
  const actual = await usuarioActual();
  return (
    <div className="ingreso">
      <div className="caja-ingreso">
        <h1>Tu cuenta no tiene acceso</h1>
        <p className="sub">
          {actual?.cuenta.email ? <>Entraste como <strong style={{ color: '#fff' }}>{actual.cuenta.email}</strong>. </> : null}
          Al panel se entra por invitación: un administrador tiene que invitar ese mismo correo desde Equipo.
          Si ya te invitaron con otro correo, salí y volvé a entrar con ese.
        </p>
        <form action={salir}><button className="boton" type="submit">Salir</button></form>
      </div>
    </div>
  );
}
