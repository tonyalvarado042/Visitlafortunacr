'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sesion } from '@/lib/supabase-sesion';

export type EstadoIngreso = { error?: string | null; mensaje?: string | null };

async function origen(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function destinoSeguro(valor: FormDataEntryValue | null): string {
  const texto = String(valor ?? '');
  return texto.startsWith('/admin') && !texto.startsWith('//') ? texto : '/admin';
}

export async function ingresar(_previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const email = String(datos.get('email') ?? '').trim().toLowerCase();
  const clave = String(datos.get('clave') ?? '');
  if (!email || !clave) return { error: 'Escribí tu correo y tu contraseña.' };

  const db = await sesion();
  const { error } = await db.auth.signInWithPassword({ email, password: clave });
  if (error) return { error: 'Correo o contraseña incorrectos.' };

  redirect(destinoSeguro(datos.get('volver')));
}

export async function registrarse(_previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const email = String(datos.get('email') ?? '').trim().toLowerCase();
  const clave = String(datos.get('clave') ?? '');
  const nombre = String(datos.get('nombre') ?? '').trim();
  if (!email || clave.length < 8) return { error: 'Correo válido y contraseña de al menos 8 caracteres.' };

  const db = await sesion();
  const { data, error } = await db.auth.signUp({
    email,
    password: clave,
    options: { data: { nombre }, emailRedirectTo: `${await origen()}/admin/auth/callback` },
  });
  if (error) return { error: error.message };
  if (data.session) redirect('/admin');
  return { mensaje: 'Te mandamos un correo para confirmar la cuenta. Después de confirmar, entrá con tu contraseña.' };
}

export async function enlaceMagico(_previo: EstadoIngreso, datos: FormData): Promise<EstadoIngreso> {
  const email = String(datos.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Escribí tu correo.' };

  const db = await sesion();
  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origen()}/admin/auth/callback`, shouldCreateUser: true },
  });
  if (error) return { error: error.message };
  return { mensaje: 'Te mandamos un enlace para entrar. Revisá tu correo (y la carpeta de spam).' };
}
