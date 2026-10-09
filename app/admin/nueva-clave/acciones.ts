'use server';

import { redirect } from 'next/navigation';
import { escribirClaveNueva } from '@/lib/recuperacion';

export type EstadoNuevaClave = { error?: string | null };

/**
 * Guardar la contraseña nueva del equipo.
 *
 * A propósito NO usa contextoPanel: eso exige ser del equipo, y quien está
 * recuperando la clave todavía no pudo entrar a comprobarlo.
 */
export async function guardarNuevaClave(
  _previo: EstadoNuevaClave, datos: FormData
): Promise<EstadoNuevaClave> {
  const r = await escribirClaveNueva(
    String(datos.get('clave') ?? ''),
    String(datos.get('repetida') ?? ''),
  );
  if (r.error) return { error: r.error };
  redirect('/admin');
}
