import { NextRequest, NextResponse } from 'next/server';
import { hayClaveDeServicio } from '@/lib/supabase-servidor';
import { secreto } from '@/lib/secretos';
import { barrerCorreosSinContestar } from '@/lib/correo/barrido';

/*
 * El reloj del correo entrante: cada 5 minutos.
 *
 * Tony, 13 de noviembre de 2026: «que este correo quede totalmente leyéndose
 * con el agente cada, no sé, 5 o 10 minutos».
 *
 * Lo llama el `scheduled` del Worker (ver `cloudflare/entrada.ts` y
 * `cloudflare.config.ts`, donde la hora tiene que ser EXACTAMENTE la misma).
 * También se puede correr a mano con el CRON_SECRET.
 *
 * ⚠️ NO MANDA CORREOS. Deja borradores en IA → Aprobaciones.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/* ⚠️ LA CLAVE SALE DE LA BOVEDA O DEL ENTORNO, igual que en el cron de
   tipo-cambio. La primera version de esta ruta miraba SOLO `process.env`,
   copiando el patron viejo de `automatizaciones` — y si la clave vive en la
   boveda, eso da 401 en cada disparo y el cron no hace nada **sin una sola
   queja visible**. Exactamente la forma de fallar que mas cuesta. */
async function autorizado(peticion: NextRequest): Promise<boolean> {
  const clave = await secreto('CRON_SECRET');
  if (!clave) return false;
  const cabecera = peticion.headers.get('authorization') ?? '';
  const porQuery = new URL(peticion.url).searchParams.get('secreto') ?? '';
  return cabecera === `Bearer ${clave}` || porQuery === clave;
}

async function correr(peticion: NextRequest) {
  if (!(await autorizado(peticion))) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  if (!hayClaveDeServicio()) return NextResponse.json({ error: 'Falta SUPABASE_SECRET_KEY.' }, { status: 503 });

  const { searchParams } = new URL(peticion.url);
  const limite = Math.min(Math.max(Number(searchParams.get('limite') ?? 10), 1), 50);

  const inicio = Date.now();
  const resumen = await barrerCorreosSinContestar(limite);

  /* Se escribe en los registros aunque no haya nada: un cron que solo habla
     cuando hace algo es un cron del que no se sabe si está vivo. */
  console.log(
    `cron correos: ${resumen.mirados} conversaciones miradas · ` +
    `${resumen.redactados} redactadas · ${resumen.yaTenianBorrador} ya tenían borrador · ` +
    `${resumen.yaContestados} ya contestadas · ${resumen.fallidos} fallidas · ${Date.now() - inicio} ms`
  );

  return NextResponse.json({ ...resumen, ms: Date.now() - inicio });
}

export async function GET(peticion: NextRequest) { return correr(peticion); }
export async function POST(peticion: NextRequest) { return correr(peticion); }
