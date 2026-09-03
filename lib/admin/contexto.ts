import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sesion, usuarioActual, type Usuario } from '@/lib/supabase-sesion';
import { puedeVer, type Seccion } from './permisos';

/*
 * Lo que toda página del panel necesita: quién es el usuario, qué destino
 * está mirando y qué otros puede mirar. El destino elegido va en una cookie;
 * si no hay, el primero al que tiene acceso.
 */

export type DestinoPanel = {
  id: string; nombre: string; babosa: string; dominio: string; zona_horaria: string;
  marca_nombre: string; idioma_principal: string; idiomas: string[];
  whatsapp: string | null; email_contacto: string | null; esta_activo: boolean;
  moneda_iso: string; comision_por_defecto: number | null;
};

export const COOKIE_DESTINO = 'vlf_admin_destino';

export async function requerirUsuario(): Promise<{ usuario: Usuario; cuenta: { id: string; email: string | null } }> {
  const actual = await usuarioActual();
  if (!actual) redirect('/admin/ingresar');
  if (!actual.usuario || !actual.usuario.esta_activo) redirect('/admin/sin-acceso');
  return { usuario: actual.usuario, cuenta: actual.cuenta };
}

export async function contextoPanel(seccion?: Seccion) {
  const { usuario, cuenta } = await requerirUsuario();
  if (seccion && !puedeVer(usuario.rol, seccion)) redirect('/admin');

  const db = await sesion();
  const { data } = await db
    .from('dst_destino')
    .select('id, nombre, babosa, dominio, zona_horaria, marca_nombre, idioma_principal, idiomas, whatsapp, email_contacto, esta_activo, moneda_iso, comision_por_defecto')
    .order('nombre');

  let destinos = (data ?? []) as DestinoPanel[];
  if (usuario.destinos_ids.length) destinos = destinos.filter((d) => usuario.destinos_ids.includes(d.id));
  if (!destinos.length) redirect('/admin/sin-acceso');

  const almacen = await cookies();
  const elegido = almacen.get(COOKIE_DESTINO)?.value;
  const destino = destinos.find((d) => d.id === elegido) ?? destinos[0];

  return { usuario, cuenta, destino, destinos, db };
}

export type ContextoPanel = Awaited<ReturnType<typeof contextoPanel>>;
