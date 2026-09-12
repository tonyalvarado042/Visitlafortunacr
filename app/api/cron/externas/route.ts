import { NextRequest, NextResponse } from 'next/server';
import { hayClaveDeServicio } from '@/lib/supabase-servidor';
import { hayClaveDePlaces, refrescarExternasPendientes } from '@/lib/externas';

/*
 * Mantiene vivas las opiniones de afuera. Lo llama el cron de Vercel
 * (vercel.json) con Authorization: Bearer CRON_SECRET, y también sirve a mano.
 *
 * Existe porque el contenido de Google vence a los 30 días: la política de
 * lectura lo esconde solo con que pase la fecha, así que sin este cron las
 * fichas se irían quedando mudas una por una, sin que nadie se entere. Cada
 * pasada renueva lo que vence en tres días y lo que nunca se trajo.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function autorizado(peticion: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET?.trim();
  if (!secreto) return false;
  const cabecera = peticion.headers.get('authorization') ?? '';
  const porQuery = new URL(peticion.url).searchParams.get('secreto') ?? '';
  return cabecera === `Bearer ${secreto}` || porQuery === secreto;
}

async function correr(peticion: NextRequest) {
  if (!autorizado(peticion)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (!hayClaveDeServicio()) return NextResponse.json({ error: 'Falta SUPABASE_SECRET_KEY.' }, { status: 503 });
  if (!hayClaveDePlaces()) return NextResponse.json({ error: 'Falta GOOGLE_PLACES_API_KEY.' }, { status: 503 });

  const { searchParams } = new URL(peticion.url);
  const inicio = Date.now();
  const resumen = await refrescarExternasPendientes({
    destino_id: searchParams.get('destino_id'),
    limite: Math.min(Math.max(Number(searchParams.get('limite') ?? 25), 1), 200),
    dias_de_margen: Math.min(Math.max(Number(searchParams.get('margen') ?? 3), 0), 29),
  });

  return NextResponse.json({ duracion_ms: Date.now() - inicio, ...resumen });
}

export const GET = correr;
export const POST = correr;
