import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { dominioDeHost } from '@/lib/dominio';
import { esIdioma, t, type Idioma } from '@/lib/idiomas';

/**
 * Apuntarse a la rifa. Hermana de /api/resena y /api/solicitud: no hace
 * INSERT, llama a participar_en_sorteo, que valida que el sorteo exista y
 * esté abierto, crea o completa el viajero y deja la participación.
 *
 * El sitio público no tiene permiso de escritura sobre ninguna tabla. Esta
 * ruta tampoco: lo único que puede hacer es llamar a esa función.
 */
export const runtime = 'nodejs';

const CORREO = /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/;
const cadena = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export async function POST(peticion: NextRequest) {
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const idioma: Idioma = esIdioma(cadena(cuerpo.idioma)) ? (cadena(cuerpo.idioma) as Idioma) : 'es';
  const mal = (mensaje: string) => NextResponse.json({ error: mensaje }, { status: 400 });

  const nombre = cadena(cuerpo.nombre);
  const email = cadena(cuerpo.email).toLowerCase();
  const whatsapp = cadena(cuerpo.whatsapp);
  const origen = cadena(cuerpo.origen) === 'pagina' ? 'pagina' : 'aviso';

  if (nombre.length < 2) return mal(t('sorteo_falta_nombre', idioma));
  if (!CORREO.test(email)) return mal(t('correo_invalido', idioma));
  /* Las bases se aceptan acá y otra vez en la base. No es de más: esta
     comprobación da el mensaje bonito, y la de abajo es la que deja
     constancia de que nadie participó sin aceptarlas. */
  if (cuerpo.acepta !== true) return mal(t('sorteo_falta_aceptar', idioma));

  const { data, error } = await supabase.rpc('participar_en_sorteo', {
    p_dominio:  dominioDeHost(peticion.headers.get('host')),
    p_nombre:   nombre,
    p_email:    email,
    p_whatsapp: whatsapp || null,
    p_idioma:   idioma,
    p_origen:   origen,
    p_pagina:   cadena(cuerpo.pagina) || null,
    p_acepta:   true,
  });

  if (error) {
    // El detalle al registro del servidor; al visitante solo el mensaje.
    console.error('participar_en_sorteo falló:', error.message);
    return NextResponse.json({ error: t('sorteo_error', idioma) }, { status: 500 });
  }

  const fila = ((data ?? []) as { ok: boolean; ya_estaba: boolean }[])[0];
  return NextResponse.json({ ok: true, ya_estaba: !!fila?.ya_estaba }, { status: 201 });
}
