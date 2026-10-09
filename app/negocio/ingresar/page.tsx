import Link from 'next/link';
import { sesion } from '@/lib/supabase-sesion';
import { redirect } from 'next/navigation';
import { FormularioEntrar } from './FormularioEntrar';

export const dynamic = 'force-dynamic';

export default async function IngresarComercio(
  { searchParams }: { searchParams: Promise<{ error?: string }> }
) {
  // Quien ya tiene sesión no tiene nada que hacer acá.
  const db = await sesion();
  const { data: { user } } = await db.auth.getUser();
  if (user) redirect('/negocio');

  const { error } = await searchParams;

  return (
    <div className="comercio-ingreso">
      <h1>Entrá a tu negocio</h1>
      <p className="comercio-sub">Para administrar la ficha de tu comercio en el directorio.</p>
      {/* El enlace del correo va con PKCE: el navegador que lo ABRE tiene que
          ser el mismo que lo PIDIÓ, porque la mitad de la llave quedó en una
          cookie suya. Abrirlo desde el teléfono habiéndolo pedido en la
          computadora falla, y sin decirlo nadie entiende por qué. */}
      {error === 'enlace' && (
        <p className="forma-error">
          Ese enlace no sirvió. Pedí uno nuevo — y abrilo <strong>en el mismo
          navegador donde lo pediste</strong>, que es lo que suele fallar.
        </p>
      )}
      <FormularioEntrar />
      <p className="comercio-pie-ingreso">
        ¿Todavía no cargaste tu negocio? <Link href="/es/sumar-negocio">Sumalo acá, gratis</Link>.
      </p>
    </div>
  );
}
