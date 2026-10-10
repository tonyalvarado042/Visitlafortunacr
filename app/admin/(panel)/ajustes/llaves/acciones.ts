'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';

export type EstadoLlave = { ok?: string | null; error?: string | null };

/*
 * Las llaves de API, desde el panel.
 *
 * Solo se ESCRIBEN. No hay ninguna acción que devuelva el valor, ni para un
 * administrador: la función de la base que lo lee está concedida únicamente a
 * service_role, así que no hay forma de sacarla por acá aunque alguien
 * quisiera. Lo que se ve es si está puesta, cuándo y sus últimos 4.
 *
 * Por eso el campo del formulario no se rellena nunca con el valor actual:
 * para cambiarla se escribe una nueva encima.
 */

export async function guardarLlave(_previo: EstadoLlave, datos: FormData): Promise<EstadoLlave> {
  const { db, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return { error: 'Solo un administrador puede guardar llaves.' };

  const nombre = String(datos.get('nombre') ?? '').trim().toUpperCase();
  const valor = String(datos.get('valor') ?? '').trim();
  const descripcion = String(datos.get('descripcion') ?? '').trim() || null;

  if (!nombre) return { error: '¿Cuál llave?' };
  if (!valor) return { error: 'Pegá la llave en el campo.' };
  if (valor.includes('…') || valor.includes('...')) {
    return { error: 'Esa llave trae puntos suspensivos: se copió recortada. Copiala completa.' };
  }

  const { error } = await db.rpc('guardar_secreto', {
    p_nombre: nombre,
    p_valor: valor,
    p_descripcion: descripcion,
  });
  if (error) {
    console.error('guardar_secreto:', error.message);
    return { error: error.message };
  }

  revalidatePath('/admin/ajustes/llaves');
  return { ok: `${nombre} quedó guardada. Termina en ${valor.slice(-4)}.` };
}

export async function olvidarLlave(datos: FormData) {
  const { db, usuario } = await contextoPanel('ajustes');
  if (usuario.rol !== 'admin') return;

  const nombre = String(datos.get('nombre') ?? '').trim().toUpperCase();
  if (!nombre) return;

  const { error } = await db.rpc('olvidar_secreto', { p_nombre: nombre });
  if (error) console.error('olvidar_secreto:', error.message);
  revalidatePath('/admin/ajustes/llaves');
}
