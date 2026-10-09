import Link from 'next/link';
import { sesion } from '@/lib/supabase-sesion';
import { redirect } from 'next/navigation';
import { FormularioEntrar } from './FormularioEntrar';

export const dynamic = 'force-dynamic';

export default async function IngresarComercio() {
  // Quien ya tiene sesión no tiene nada que hacer acá.
  const db = await sesion();
  const { data: { user } } = await db.auth.getUser();
  if (user) redirect('/negocio');

  return (
    <div className="comercio-ingreso">
      <h1>Entrá a tu negocio</h1>
      <p className="comercio-sub">Para administrar la ficha de tu comercio en el directorio.</p>
      <FormularioEntrar />
      <p className="comercio-pie-ingreso">
        ¿Todavía no cargaste tu negocio? <Link href="/es/sumar-negocio">Sumalo acá, gratis</Link>.
      </p>
    </div>
  );
}
