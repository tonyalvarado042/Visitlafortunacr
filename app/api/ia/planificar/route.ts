import { NextRequest, NextResponse } from 'next/server';
import { hayClaveDeServicio } from '@/lib/supabase-servidor';
import { usuarioActual } from '@/lib/supabase-sesion';
import { hayClaveDeIA } from '@/lib/ia/cliente';
import { generarItinerario, generarItinerarioParaSolicitud } from '@/lib/ia/planificador';

/*
 * Generar un plan a pedido. Lo usa el panel (con sesión del equipo) y
 * cualquier integración con el secreto del cron. Acepta o una solicitud_id
 * (usa los datos del viajero) o una petición completa.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(peticion: NextRequest) {
  if (!hayClaveDeServicio() || !hayClaveDeIA()) {
    return NextResponse.json({ error: 'La IA no está configurada (faltan claves).' }, { status: 503 });
  }

  const secreto = process.env.CRON_SECRET?.trim();
  const porSecreto = !!secreto && peticion.headers.get('authorization') === `Bearer ${secreto}`;
  const sesion = porSecreto ? null : await usuarioActual();
  if (!porSecreto && !sesion?.usuario?.esta_activo) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await peticion.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  try {
    if (typeof cuerpo.solicitud_id === 'string') {
      const plan = await generarItinerarioParaSolicitud(cuerpo.solicitud_id, porSecreto ? 'api' : 'panel');
      return NextResponse.json({ id: plan.id, babosa: plan.babosa, url: plan.url, costo_usd: plan.costo_usd });
    }

    if (typeof cuerpo.destino_id !== 'string') {
      return NextResponse.json({ error: 'Hace falta solicitud_id o destino_id.' }, { status: 400 });
    }
    const plan = await generarItinerario(
      {
        destino_id: cuerpo.destino_id,
        idioma: typeof cuerpo.idioma === 'string' ? cuerpo.idioma : 'es',
        dias: typeof cuerpo.dias === 'number' ? cuerpo.dias : 3,
        llega_el: typeof cuerpo.llega_el === 'string' ? cuerpo.llega_el : null,
        sale_el: typeof cuerpo.sale_el === 'string' ? cuerpo.sale_el : null,
        personas: typeof cuerpo.personas === 'number' ? cuerpo.personas : null,
        ninos: typeof cuerpo.ninos === 'number' ? cuerpo.ninos : null,
        tipo_viajero: typeof cuerpo.tipo_viajero === 'string' ? cuerpo.tipo_viajero : null,
        presupuesto: typeof cuerpo.presupuesto === 'string' ? cuerpo.presupuesto : null,
        intereses: Array.isArray(cuerpo.intereses) ? cuerpo.intereses.filter((i): i is string => typeof i === 'string') : [],
        mensaje: typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje : null,
        nombre: typeof cuerpo.nombre === 'string' ? cuerpo.nombre : null,
        viajero_id: typeof cuerpo.viajero_id === 'string' ? cuerpo.viajero_id : null,
        solicitud_id: null,
      },
      { origen: porSecreto ? 'api' : 'panel', solicitado_por: sesion?.usuario?.id ?? null }
    );
    return NextResponse.json({ id: plan.id, babosa: plan.babosa, url: plan.url, itinerario: plan.itinerario, costo_usd: plan.costo_usd });
  } catch (fallo) {
    console.error('planificar falló:', fallo);
    return NextResponse.json({ error: fallo instanceof Error ? fallo.message : 'No se pudo generar el plan.' }, { status: 500 });
  }
}
