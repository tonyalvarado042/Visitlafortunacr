import { redirect } from 'next/navigation';
import { sesion } from '@/lib/supabase-sesion';
import { FormularioNuevaClave } from './FormularioNuevaClave';

export const dynamic = 'force-dynamic';

/*
 * Adonde llega el comerciante que pidió "olvidé mi contraseña" y abrió el
 * enlace del correo. Para este momento el callback ya canjeó el código y hay
 * sesión: por eso no se pide la contraseña vieja.
 */
export default async function NuevaClaveComercio() {
  const db = await sesion();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/negocio/ingresar?error=enlace');

  return (
    <div className="comercio-ingreso">
      <h1>Tu contraseña nueva</h1>
      <p className="comercio-sub">
        Entraste como <strong>{user.email}</strong>. Escribila y quedás adentro.
      </p>
      <FormularioNuevaClave />
    </div>
  );
}
