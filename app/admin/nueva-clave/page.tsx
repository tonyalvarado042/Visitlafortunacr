import { redirect } from 'next/navigation';
import { sesion } from '@/lib/supabase-sesion';
import { FormularioNuevaClave } from './FormularioNuevaClave';

export const dynamic = 'force-dynamic';

/*
 * Adonde llega quien pidió "olvidé mi contraseña" y abrió el enlace del correo.
 * Para este momento el callback ya canjeó el código y hay sesión: por eso no se
 * pide la contraseña vieja — quien llegó hasta acá demostró que tiene el correo,
 * que es justo lo que se perdió.
 */
export default async function NuevaClave() {
  const db = await sesion();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/admin/ingresar?error=enlace');

  return (
    <div className="ingreso">
      <div className="caja-ingreso">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, fontWeight: 800 }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--naranja)', display: 'inline-block' }} />
          Visit <span style={{ color: 'var(--naranja)' }}>Destinos</span> · Panel
        </div>
        <h1>Tu contraseña nueva</h1>
        <p className="sub">
          Entraste como <strong>{user.email}</strong>. Escribila y quedás adentro.
        </p>
        <FormularioNuevaClave />
      </div>
    </div>
  );
}
