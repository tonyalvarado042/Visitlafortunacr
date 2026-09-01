import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * La única puerta por la que el sitio escribe. No hace INSERT: llama a
 * registrar_solicitud, que valida el destino, exige una forma de contacto y
 * crea el viajero y la solicitud en una transacción.
 */
export async function POST(peticion: NextRequest) {
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const email = typeof cuerpo.email === 'string' ? cuerpo.email.trim() : null;
  const whatsapp = typeof cuerpo.whatsapp === 'string' ? cuerpo.whatsapp.trim() : null;

  if (!email && !whatsapp) {
    return NextResponse.json(
      { error: 'Hace falta un correo o un WhatsApp para poder responder.' },
      { status: 400 }
    );
  }

  const host = (peticion.headers.get('host') ?? '').split(':')[0].replace(/^www\./, '');
  const esLocal = !host || host === 'localhost' || host.endsWith('.vercel.app');
  const dominio = esLocal
    ? (process.env.NEXT_PUBLIC_DOMINIO_POR_DEFECTO ?? 'visitlafortunacr.com')
    : host;

  const url = new URL(peticion.url);

  const { data, error } = await supabase.rpc('registrar_solicitud', {
    p_dominio:      dominio,
    p_tipo:         typeof cuerpo.tipo === 'string' ? cuerpo.tipo : 'consulta_general',
    p_nombre:       typeof cuerpo.nombre === 'string' ? cuerpo.nombre : null,
    p_email:        email,
    p_whatsapp:     whatsapp,
    p_llega_el:     typeof cuerpo.llega_el === 'string' ? cuerpo.llega_el : null,
    p_sale_el:      typeof cuerpo.sale_el === 'string' ? cuerpo.sale_el : null,
    p_personas:     typeof cuerpo.personas === 'number' ? cuerpo.personas : null,
    p_tipo_viajero: typeof cuerpo.tipo_viajero === 'string' && cuerpo.tipo_viajero ? cuerpo.tipo_viajero : null,
    p_presupuesto:  typeof cuerpo.presupuesto === 'string' && cuerpo.presupuesto ? cuerpo.presupuesto : null,
    p_intereses:    Array.isArray(cuerpo.intereses) ? cuerpo.intereses : [],
    p_mensaje:      typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje : null,
    p_idioma:       typeof cuerpo.idioma === 'string' ? cuerpo.idioma : 'es',
    p_origen:       typeof cuerpo.origen === 'string' ? cuerpo.origen : 'planificador',
    p_utm_fuente:   url.searchParams.get('utm_source'),
    p_utm_medio:    url.searchParams.get('utm_medium'),
    p_utm_campana:  url.searchParams.get('utm_campaign'),
  });

  if (error) {
    // El detalle va al registro del servidor; al visitante solo el mensaje.
    console.error('registrar_solicitud falló:', error.message);
    return NextResponse.json(
      { error: 'No se pudo registrar la solicitud. Intentá de nuevo.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ solicitud_id: data }, { status: 201 });
}
