import { NextRequest, NextResponse } from 'next/server';
import { sesion } from '@/lib/supabase-sesion';

/**
 * Adonde vuelve el correo de recuperación del comerciante.
 *
 * El middleware deja pasar /negocio/auth/* sin sesión a propósito: acá es
 * donde el código del correo se canjea por la sesión. Sin esta ruta, el
 * enlace del correo rebotaba a la pantalla de entrar sin decir nada.
 */
export async function GET(peticion: NextRequest) {
  const { searchParams, origin } = new URL(peticion.url);
  const codigo = searchParams.get('code');
  const pedido = searchParams.get('next') ?? '/negocio';
  const destino = pedido.startsWith('/negocio') && !pedido.startsWith('//') ? pedido : '/negocio';

  if (codigo) {
    const db = await sesion();
    const { error } = await db.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(`${origin}/negocio/ingresar?error=enlace`);
}
