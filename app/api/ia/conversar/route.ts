import { NextRequest, NextResponse, after } from 'next/server';
import { hayClaveDeServicio, servicio } from '@/lib/supabase-servidor';
import { hayClaveDeIA } from '@/lib/ia/cliente';
import { responderConversacion } from '@/lib/ia/agente';
import { generarItinerarioParaSolicitud } from '@/lib/ia/planificador';
import { dominioDeHost } from '@/lib/dominio';

/*
 * El chat del sitio ("Preguntale a alguien de aquí"). Un visitante anónimo
 * escribe, su mensaje entra por registrar_mensaje_entrante y el concierge
 * responde. Si una persona del equipo tomó la conversación, la respuesta llega
 * por GET (el widget consulta cada tanto).
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

const IDENTIFICADOR = /^[a-zA-Z0-9_-]{8,64}$/;
const IDIOMAS = ['es', 'en', 'pt', 'fr', 'de'];

async function destinoDe(peticion: NextRequest): Promise<{ id: string } | null> {
  const dominio = dominioDeHost(peticion.headers.get('host'));
  const { data } = await servicio().from('dst_destino').select('id').eq('dominio', dominio).eq('esta_activo', true).maybeSingle();
  return data ? { id: data.id as string } : null;
}

export async function POST(peticion: NextRequest) {
  if (!hayClaveDeServicio() || !hayClaveDeIA()) {
    return NextResponse.json({ error: 'El chat no está disponible por ahora.' }, { status: 503 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  const identificador = typeof cuerpo.identificador === 'string' ? cuerpo.identificador : '';
  const mensaje = typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje.trim().slice(0, 2000) : '';
  const idioma = typeof cuerpo.idioma === 'string' && IDIOMAS.includes(cuerpo.idioma) ? cuerpo.idioma : null;
  const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim().slice(0, 120) : null;
  const viajeroId = typeof cuerpo.viajero_id === 'string' && /^[0-9a-f-]{36}$/i.test(cuerpo.viajero_id) ? cuerpo.viajero_id : null;

  if (!IDENTIFICADOR.test(identificador)) return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
  if (!mensaje) return NextResponse.json({ error: 'Escribí un mensaje.' }, { status: 400 });

  const destino = await destinoDe(peticion);
  if (!destino) return NextResponse.json({ error: 'Destino no encontrado.' }, { status: 404 });

  const db = servicio();

  // Freno simple contra abuso: 30 mensajes por conversación cada 10 minutos.
  const { data: abierta } = await db
    .from('dst_conversacion')
    .select('id')
    .eq('destino_id', destino.id).eq('canal', 'web').eq('identificador_externo', identificador).neq('estado', 'cerrada')
    .maybeSingle();
  if (abierta) {
    const { count } = await db
      .from('dst_mensaje')
      .select('id', { count: 'exact', head: true })
      .eq('conversacion_id', abierta.id).eq('direccion', 'entrante')
      .gte('enviado_en', new Date(Date.now() - 10 * 60_000).toISOString());
    if ((count ?? 0) >= 30) return NextResponse.json({ error: 'Demasiados mensajes seguidos. Esperá unos minutos.' }, { status: 429 });
  }

  const { data: entrada, error } = await db.rpc('registrar_mensaje_entrante', {
    p_destino_id: destino.id,
    p_canal: 'web',
    p_identificador: identificador,
    p_cuerpo: mensaje,
    p_id_externo: null,
    p_nombre: nombre,
    p_idioma: idioma,
    p_metadatos: { pagina: peticion.headers.get('referer') ?? null, agente_navegador: (peticion.headers.get('user-agent') ?? '').slice(0, 200) },
    p_viajero_id: viajeroId,
  });
  if (error) {
    console.error('registrar_mensaje_entrante falló:', error.message);
    return NextResponse.json({ error: 'No se pudo registrar el mensaje.' }, { status: 500 });
  }

  const conversacionId = entrada.conversacion_id as string;
  if (entrada.atendida_por !== 'ia') {
    return NextResponse.json({ conversacion_id: conversacionId, respuesta: null, humano: true });
  }

  try {
    const r = await responderConversacion(conversacionId, { origen: 'web' });
    if (r.solicitud_creada?.tipo === 'itinerario') {
      const id = r.solicitud_creada.id;
      after(async () => {
        try {
          await generarItinerarioParaSolicitud(id, 'web');
        } catch (fallo) {
          console.error('No se pudo generar el itinerario:', fallo);
        }
      });
    }
    return NextResponse.json({
      conversacion_id: conversacionId,
      respuesta: r.texto,
      escalada: r.escalada,
      humano: r.texto === null,
      viajero_id: entrada.viajero_id ?? null,
    });
  } catch (fallo) {
    console.error('El concierge falló:', fallo);
    return NextResponse.json({
      conversacion_id: conversacionId,
      respuesta: null,
      humano: true,
      error: 'No pude responder ahora; una persona del equipo te escribe.',
    });
  }
}

/** Mensajes nuevos (de la IA o del equipo) desde una fecha, para el widget. */
export async function GET(peticion: NextRequest) {
  if (!hayClaveDeServicio()) return NextResponse.json({ mensajes: [] });
  const { searchParams } = new URL(peticion.url);
  const conversacionId = searchParams.get('conversacion_id') ?? '';
  const identificador = searchParams.get('identificador') ?? '';
  const desde = searchParams.get('desde');
  if (!/^[0-9a-f-]{36}$/i.test(conversacionId) || !IDENTIFICADOR.test(identificador)) {
    return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 });
  }

  const db = servicio();
  const { data: conv } = await db
    .from('dst_conversacion')
    .select('id, identificador_externo, atendida_por, estado')
    .eq('id', conversacionId)
    .maybeSingle();
  if (!conv || conv.identificador_externo !== identificador) return NextResponse.json({ error: 'No encontrada.' }, { status: 404 });

  let consulta = db
    .from('dst_mensaje')
    .select('id, autor, cuerpo, enviado_en')
    .eq('conversacion_id', conversacionId)
    .eq('direccion', 'saliente')
    .neq('canal', 'nota_interna')
    .order('enviado_en')
    .limit(50);
  if (desde && !Number.isNaN(Date.parse(desde))) consulta = consulta.gt('enviado_en', new Date(desde).toISOString());
  const { data } = await consulta;

  return NextResponse.json({ mensajes: data ?? [], humano: conv.atendida_por === 'humano', estado: conv.estado });
}
