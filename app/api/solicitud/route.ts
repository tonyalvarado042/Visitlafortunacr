import { NextRequest, NextResponse, after } from 'next/server';
import { supabase } from '@/lib/supabase';
import { dominioDeHost } from '@/lib/dominio';
import { hayClaveDeServicio } from '@/lib/supabase-servidor';
import { hayClaveDeIA } from '@/lib/ia/cliente';
import { generarItinerarioParaSolicitud } from '@/lib/ia/planificador';

/**
 * La única puerta por la que el sitio escribe. No hace INSERT: llama a
 * registrar_solicitud, que valida el destino, exige una forma de contacto y
 * crea el viajero y la solicitud en una transacción.
 *
 * Después de responder, si la solicitud es de itinerario y la IA está
 * configurada, el planificador arma el plan y se lo manda al viajero.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

/* ---- Portero ----------------------------------------------------------
 * El planificador vivía escondido en la portada y nadie lo molestaba. La
 * pantalla de prelanzamiento es lo contrario: una caja de correo a la vista
 * de todo el que pase, que es justo lo que los robots buscan. Sin esto, la
 * primera campaña llena dst_viajero de basura.
 *
 * Tres filtros, de más barato a más caro. Ninguno toca el flujo del
 * planificador: el honeypot solo actúa si el campo viene, y el tiempo mínimo
 * solo se le exige al teaser, que sí lo manda.
 */
const ESPERA_MINIMA_MS = 3000;
const TOPE_POR_IP = 5;
const VENTANA_MS = 60_000;

/* En memoria del proceso: en Vercel hay varias instancias y esto se reinicia
 * en frío, así que es un tope de velocidad, no un muro. Frena al robot que
 * dispara cien veces seguidas, que es el caso real. */
const golpes = new Map<string, number[]>();

function demasiadoSeguido(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (golpes.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  recientes.push(ahora);
  golpes.set(ip, recientes);

  // Que el mapa no crezca para siempre en un proceso de larga vida.
  if (golpes.size > 5000) {
    for (const [clave, marcas] of golpes) {
      if (marcas.every((t) => ahora - t >= VENTANA_MS)) golpes.delete(clave);
    }
  }
  return recientes.length > TOPE_POR_IP;
}

export async function POST(peticion: NextRequest) {
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const origen = typeof cuerpo.origen === 'string' ? cuerpo.origen : 'planificador';

  /* Al robot se le contesta que todo salió bien. Si le devolviéramos un error
     probaría otra forma; creyendo que funcionó, se va. */
  const trampaLlena = typeof cuerpo.sitio_web === 'string' && cuerpo.sitio_web.trim() !== '';
  const muyRapido =
    origen.startsWith('teaser_') &&
    typeof cuerpo.abierto_en === 'number' &&
    Date.now() - cuerpo.abierto_en < ESPERA_MINIMA_MS;

  if (trampaLlena || muyRapido) {
    console.warn('Solicitud descartada por el portero:', { trampaLlena, muyRapido, origen });
    return NextResponse.json({ solicitud_id: null, plan_en_camino: false }, { status: 201 });
  }

  const ip = (peticion.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip';
  if (demasiadoSeguido(ip)) {
    return NextResponse.json(
      { error: 'Demasiados intentos seguidos. Probá de nuevo en un minuto.' },
      { status: 429 }
    );
  }

  const email = typeof cuerpo.email === 'string' ? cuerpo.email.trim() : null;
  const whatsapp = typeof cuerpo.whatsapp === 'string' ? cuerpo.whatsapp.trim() : null;

  if (!email && !whatsapp) {
    return NextResponse.json(
      { error: 'Hace falta un correo o un WhatsApp para poder responder.' },
      { status: 400 }
    );
  }

  const dominio = dominioDeHost(peticion.headers.get('host'));
  const url = new URL(peticion.url);
  const tipo = typeof cuerpo.tipo === 'string' ? cuerpo.tipo : 'consulta_general';

  const { data, error } = await supabase.rpc('registrar_solicitud', {
    p_dominio:      dominio,
    p_tipo:         tipo,
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
    p_origen:       origen,
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

  const solicitudId = data as string;
  const generaPlan = tipo === 'itinerario' && hayClaveDeServicio() && hayClaveDeIA();
  if (generaPlan) {
    after(async () => {
      try {
        await generarItinerarioParaSolicitud(solicitudId, 'web');
      } catch (fallo) {
        console.error('No se pudo generar el itinerario:', fallo);
      }
    });
  }

  return NextResponse.json({ solicitud_id: solicitudId, plan_en_camino: generaPlan }, { status: 201 });
}
