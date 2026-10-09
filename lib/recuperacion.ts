import { headers } from 'next/headers';
import { sesion } from '@/lib/supabase-sesion';

/*
 * Recuperar la contraseña, una sola vez para las dos áreas.
 *
 * /admin y /negocio tienen pantallas distintas pero el mecanismo es idéntico:
 * mandar el correo, volver por el callback del área, escribir la nueva. Vivía
 * suelto en /admin; acá queda compartido para que el día que se arregle algo
 * se arregle en los dos lados y no en uno.
 */

export type Resultado = { error?: string | null; mensaje?: string | null };

/** El dominio real por el que entró la petición, no el que uno supone. */
export async function origen(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Mandar el correo con el enlace para poner una contraseña nueva.
 *
 * Contesta lo mismo exista o no la cuenta: si dijera "ese correo no está",
 * cualquiera podría usar la pantalla de entrar para averiguar quién tiene
 * cuenta en el sitio.
 */
export async function pedirEnlaceDeClave(email: string, base: '/admin' | '/negocio'): Promise<Resultado> {
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return { error: 'Escribí un correo válido.' };

  const db = await sesion();
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origen()}${base}/auth/callback?next=${encodeURIComponent(`${base}/nueva-clave`)}`,
  });
  if (error) console.error('pedirEnlaceDeClave:', error.message);

  return {
    mensaje: 'Si ese correo tiene cuenta, te llega un enlace para poner una contraseña nueva. ' +
             'Abrilo en este mismo navegador.',
  };
}

/**
 * Escribir la contraseña nueva.
 *
 * Para cuando corre esto YA hay sesión: el callback canjeó el código del
 * correo. Por eso no pide la contraseña vieja — quien llegó hasta acá
 * demostró que tiene el correo, que es justo lo que se perdió.
 */
export async function escribirClaveNueva(clave: string, repetida: string): Promise<Resultado> {
  if (clave.length < 8) return { error: 'La contraseña necesita al menos 8 caracteres.' };
  if (clave !== repetida) return { error: 'Las dos contraseñas no coinciden.' };

  const db = await sesion();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Se venció el enlace. Pedí uno nuevo desde la pantalla de entrar.' };

  const { error } = await db.auth.updateUser({ password: clave });
  if (error) return { error: error.message };
  return { mensaje: 'ok' };
}
