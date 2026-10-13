import { NextRequest, NextResponse } from 'next/server';
import { servicio, hayClaveDeServicio } from '@/lib/supabase-servidor';
import { secreto } from '@/lib/secretos';
import { tipoDeCambioDeCompra } from '@/lib/bccr';

/*
 * Trae el tipo de cambio del BCCR, una vez al día.
 *
 * Lo necesitan las tarifas de nacionales y residentes, que se cobran en
 * colones. A mano se olvida: el día que el tipo quede viejo, la conversión a
 * dólares se desfasa y la comisión sale mal sin que nadie lo note. Por eso es
 * cron y no un campo que alguien recuerde actualizar.
 *
 * Si el BCCR no contesta NO se toca lo que ya había: se deja el último bueno y
 * se devuelve el motivo. Un tipo de cambio de ayer es correcto; uno inventado
 * o uno borrado no. Y `tipo_cambio_en` queda como estaba, así que en Ajustes
 * se ve de cuándo es el número que se está usando.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/* Misma puerta que los otros crons: la clave sale de la bóveda o del entorno,
   y sin clave NO se autoriza — una tarea que escribe en la base no puede
   quedar abierta porque falte configurarla. */
async function autorizado(peticion: NextRequest): Promise<boolean> {
  const clave = await secreto('CRON_SECRET');
  if (!clave) return false;
  const cabecera = peticion.headers.get('authorization') ?? '';
  const porQuery = new URL(peticion.url).searchParams.get('secreto') ?? '';
  return cabecera === `Bearer ${clave}` || porQuery === clave;
}

async function correr(peticion: NextRequest) {
  if (!(await autorizado(peticion))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  if (!hayClaveDeServicio()) {
    return NextResponse.json({ error: 'Falta SUPABASE_SECRET_KEY.' }, { status: 503 });
  }

  const r = await tipoDeCambioDeCompra();
  if (!r.ok) {
    /* 200 y no 5xx: el cron hizo su trabajo y el problema es de afuera. Un
       error acá haría que Vercel lo marcara como caído todos los días que el
       BCCR esté lento, y el aviso que importa se perdería entre los otros. */
    console.error('tipo de cambio BCCR:', r.motivo);
    return NextResponse.json({ ok: false, motivo: r.motivo, se_guardo: false });
  }

  const db = servicio();
  const { data, error } = await db
    .from('dst_destino')
    .update({ tipo_cambio_crc: r.valor, tipo_cambio_en: new Date().toISOString() })
    .eq('esta_activo', true)
    .select('babosa');

  if (error) {
    console.error('tipo de cambio, al guardar:', error.message);
    return NextResponse.json({ ok: false, motivo: error.message, se_guardo: false }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    valor: r.valor,
    fecha_bccr: r.fecha,
    destinos: (data ?? []).map((d) => d.babosa),
  });
}

export const GET = correr;
export const POST = correr;
