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

/**
 * Quién está usando el panel. Devuelve null si no hay sesión o si la cuenta
 * existe en Auth pero nadie la invitó al equipo (no tiene fila en dst_usuario).
 */
export async function usuarioActual(): Promise<{ cuenta: { id: string; email: string | null }; usuario: Usuario | null } | null> {
  const cliente = await sesion();
  const { data: { user } } = await cliente.auth.getUser();
  if (!user) return null;

  const { data } = await cliente
    .from('dst_usuario')
    .select('id, nombre, email, telefono, rol, foto_url, destinos_ids, meta_mensual, esta_activo, ultimo_acceso_en')
    .eq('id', user.id)
    .maybeSingle();

  return { cuenta: { id: user.id, email: user.email ?? null }, usuario: (data as Usuario | null) ?? null };
}
