'use server';

import { supabase } from '@/lib/supabase';

/*
 * Guardar la respuesta que llega desde el enlace del correo.
 *
 * Va con la clave PUBLICABLE a propósito: quien llega acá no tiene sesión, y
 * no debería necesitarla. Lo que autoriza no es un usuario, es el token — y
 * toda la comprobación (que exista, que no esté usado, que no esté vencido)
 * vive en `responder_con_token`, dentro de la base.
 *
 * Acá no se valida nada de seguridad porque acá no se puede: lo que llega del
 * navegador se puede cambiar. La única verdad es la de la función.
 */

export type EstadoRespuesta = { ok?: boolean; error?: string };

const MOTIVOS: Record<string, string> = {
  vacio: 'Escribí algo antes de publicar.',
  largo: 'La respuesta es muy larga. Máximo 2.000 caracteres.',
  usado: 'Este enlace ya se usó. La reseña ya tiene respuesta.',
  vencido: 'Este enlace venció. Entrá a tu cuenta para responder.',
  desconocido: 'Este enlace no es válido.',
};

export async function responderDesdeElCorreo(
  _previo: EstadoRespuesta,
  datos: FormData,
): Promise<EstadoRespuesta> {
  const token = String(datos.get('token') ?? '');
  const texto = String(datos.get('texto') ?? '');
  if (!token) return { error: MOTIVOS.desconocido };

  const { data, error } = await supabase.rpc('responder_con_token', {
    p_token: token,
    p_texto: texto,
  });

  if (error) {
    console.error('responder_con_token:', error.message);
    return { error: 'No se pudo publicar. Probá de nuevo en un momento.' };
  }

  const motivo = String(data ?? 'desconocido');
  if (motivo === 'ok') return { ok: true };
  return { error: MOTIVOS[motivo] ?? MOTIVOS.desconocido };
}
