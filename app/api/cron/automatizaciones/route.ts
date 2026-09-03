import { NextRequest, NextResponse } from 'next/server';
import { hayClaveDeServicio } from '@/lib/supabase-servidor';
import { correrAutomatizaciones } from '@/lib/automatizaciones';

/*
 * Lo llama el cron de Vercel (vercel.json) cada hora con
 * Authorization: Bearer CRON_SECRET. También sirve para correrlo a mano.
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

  const { searchParams } = new URL(peticion.url);
  const limite = Math.min(Math.max(Number(searchParams.get('limite') ?? 40), 1), 200);
  const destinoId = searchParams.get('destino_id');

  const inicio = Date.now();
  const resumen = await correrAutomatizaciones({ limite, destino_id: destinoId });
  return NextResponse.json({ ok: true, duracion_ms: Date.now() - inicio, ...resumen });
}

export const GET = correr;
export const POST = correr;
