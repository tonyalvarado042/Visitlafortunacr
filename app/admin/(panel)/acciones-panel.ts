'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sesion } from '@/lib/supabase-sesion';
import { COOKIE_DESTINO } from '@/lib/admin/contexto';

export async function cambiarDestino(datos: FormData) {
  const id = String(datos.get('destino_id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  (await cookies()).set(COOKIE_DESTINO, id, { path: '/admin', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  revalidatePath('/admin', 'layout');
}

export async function salir() {
  const db = await sesion();
  await db.auth.signOut();
  redirect('/admin/ingresar');
}
