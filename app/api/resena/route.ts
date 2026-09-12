import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { dominioDeHost } from '@/lib/dominio';
import { esIdioma, t, type Idioma } from '@/lib/idiomas';

/**
 * La segunda puerta por la que el sitio escribe, hermana de /api/solicitud.
 * No hace INSERT: llama a registrar_resena, que valida que el negocio sea de
 * este destino y esté publicado, crea o completa el viajero y deja la reseña
 * en el estado que ese destino haya decidido (publicada o pendiente).
 */
export const runtime = 'nodejs';

const MINIMO = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  const invalido = (mensaje?: string) =>
    NextResponse.json({ error: mensaje ?? t('resena_invalida', idioma) }, { status: 400 });

  const negocioId = cadena(cuerpo.negocio_id);
  const calificacion = Number(cuerpo.calificacion);
  const texto = cadena(cuerpo.cuerpo);
  const nombre = cadena(cuerpo.nombre);
  const email = cadena(cuerpo.email).toLowerCase();
  const visitadoEl = cadena(cuerpo.visitado_el);

  if (!UUID.test(negocioId)) return invalido();
  if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) return invalido();
  if (texto.length < MINIMO) return invalido(t('resena_corta', idioma));
  if (!nombre) return invalido();
  if (!CORREO.test(email)) return invalido(t('correo_invalido', idioma));
  if (visitadoEl && !/^\d{4}-\d{2}-\d{2}$/.test(visitadoEl)) return invalido();

  const { data, error } = await supabase.rpc('registrar_resena', {
    p_dominio:      dominioDeHost(peticion.headers.get('host')),
    p_negocio_id:   negocioId,
    p_calificacion: calificacion,
    p_cuerpo:       texto,
    p_nombre:       nombre,
    p_email:        email,
    p_titulo:       cadena(cuerpo.titulo) || null,
    p_idioma:       idioma,
    p_visitado_el:  visitadoEl || null,
  });

  if (error) {
    // El detalle va al registro del servidor; al visitante solo el mensaje.
    console.error('registrar_resena falló:', error.message);
    return NextResponse.json({ error: t('resena_error', idioma) }, { status: 500 });
  }

  const resultado = (data ?? {}) as { resena_id?: string; estado?: string; visible?: boolean };
  return NextResponse.json(
    { resena_id: resultado.resena_id, estado: resultado.estado, visible: !!resultado.visible },
    { status: 201 }
  );
}
