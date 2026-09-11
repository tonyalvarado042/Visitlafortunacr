import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { credencialesPublicas } from './credenciales-publicas';

/*
 * El cliente de SESIÓN del panel: lleva la cookie del usuario, así que todo lo
 * que lee y escribe pasa por las políticas de acceso (RLS) y la auditoría sabe
 * quién fue. Es el único cliente que usan las páginas y acciones de /admin.
 */
export async function sesion() {
  const almacen = await cookies();
  const { url, clave } = credencialesPublicas();

  return createServerClient(url, clave, {
    db: { schema: 'destinos' },
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // Desde un componente de servidor no se pueden escribir cookies; el
          // middleware ya refrescó la sesión, así que no pasa nada.
        }
      },
    },
  });
}

export type ClienteSesion = Awaited<ReturnType<typeof sesion>>;

export type Rol = 'admin' | 'editor' | 'vendedor' | 'moderador' | 'socio';

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  foto_url: string | null;
  destinos_ids: string[];
  meta_mensual: number | null;
  esta_activo: boolean;
  ultimo_acceso_en: string | null;
};

const CAMPOS_USUARIO =
  'id, nombre, email, telefono, rol, foto_url, destinos_ids, meta_mensual, esta_activo, ultimo_acceso_en';

/**
 * Quién está usando el panel. Devuelve null si no hay sesión o si la cuenta
 * existe en Auth pero nadie la invitó al equipo (no tiene fila en dst_usuario).
 *
 * Si no tiene ficha de equipo, se intenta reclamar una invitación pendiente
 * antes de rendirse: quien creó su cuenta ANTES de que lo invitaran no pasa
 * por el trigger de alta, y sin esto se quedaría afuera para siempre.
 */
export async function usuarioActual(): Promise<{ cuenta: { id: string; email: string | null }; usuario: Usuario | null } | null> {
  const cliente = await sesion();
  const { data: { user } } = await cliente.auth.getUser();
  if (!user) return null;

  const leer = async () =>
    (await cliente.from('dst_usuario').select(CAMPOS_USUARIO).eq('id', user.id).maybeSingle()).data as Usuario | null;

  let usuario = await leer();

  if (!usuario) {
    const { data: reclamada } = await cliente.rpc('reclamar_invitacion');
    if (reclamada) usuario = await leer();
  }

  return { cuenta: { id: user.id, email: user.email ?? null }, usuario };
}
