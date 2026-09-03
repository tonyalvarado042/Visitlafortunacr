import { NextRequest, NextResponse } from 'next/server';
import { sesion } from '@/lib/supabase-sesion';

/** Adonde vuelve el correo de confirmación o el enlace mágico. */
export async function GET(peticion: NextRequest) {
  const { searchParams, origin } = new URL(peticion.url);
  const codigo = searchParams.get('code');
  const siguiente = searchParams.get('next') ?? '/admin';
  const destino = siguiente.startsWith('/admin') && !siguiente.startsWith('//') ? siguiente : '/admin';

  if (codigo) {
    const db = await sesion();
    const { error } = await db.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }
  return NextResponse.redirect(`${origin}/admin/ingresar?error=enlace`);
}
