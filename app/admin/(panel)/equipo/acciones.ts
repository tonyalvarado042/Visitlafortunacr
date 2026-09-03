'use server';

import { revalidatePath } from 'next/cache';
import { contextoPanel } from '@/lib/admin/contexto';

const esUuid = (v: unknown) => /^[0-9a-f-]{36}$/i.test(String(v ?? ''));
const texto = (d: FormData, k: string) => String(d.get(k) ?? '').trim();
const ROLES = ['admin', 'editor', 'vendedor', 'moderador', 'socio'];

function destinosDe(datos: FormData): string[] {
  return datos.getAll('destinos_ids').map(String).filter(esUuid);
}

export async function invitar(datos: FormData) {
  const { db, usuario } = await contextoPanel('equipo');
  if (usuario.rol !== 'admin') return;
  const email = texto(datos, 'email').toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return;
  const rol = ROLES.includes(texto(datos, 'rol')) ? texto(datos, 'rol') : 'vendedor';
  const { error } = await db.from('dst_invitacion').insert({
    email, nombre: texto(datos, 'nombre') || null, rol, destinos_ids: destinosDe(datos), invitado_por: usuario.id,
  });
  if (error) console.error('invitar:', error.message);
  revalidatePath('/admin/equipo');
}

export async function cancelarInvitacion(datos: FormData) {
  const { db, usuario } = await contextoPanel('equipo');
  if (usuario.rol !== 'admin') return;
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  await db.from('dst_invitacion').delete().eq('id', id).is('aceptada_en', null);
  revalidatePath('/admin/equipo');
}

export async function editarUsuario(datos: FormData) {
  const { db, usuario } = await contextoPanel('equipo');
  const id = texto(datos, 'id');
  if (!esUuid(id)) return;
  const esAdmin = usuario.rol === 'admin';
  if (!esAdmin && id !== usuario.id) return;
  const rol = texto(datos, 'rol');
  const cambios: Record<string, unknown> = {
    nombre: texto(datos, 'nombre') || undefined,
    telefono: texto(datos, 'telefono') || null,
    meta_mensual: texto(datos, 'meta_mensual') ? Number(texto(datos, 'meta_mensual')) : null,
  };
  if (esAdmin) {
    if (ROLES.includes(rol)) cambios.rol = rol;
    cambios.destinos_ids = destinosDe(datos);
    // Nadie se apaga a sí mismo: evita quedarse fuera del panel.
    if (id !== usuario.id) cambios.esta_activo = texto(datos, 'esta_activo') === '1';
  }
  const { error } = await db.from('dst_usuario').update(cambios).eq('id', id);
  if (error) console.error('editarUsuario:', error.message);
  revalidatePath('/admin/equipo');
}
