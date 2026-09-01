import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Diagnóstico: dice si el sitio puede hablar con la base y qué destino cree
 * que está sirviendo. Existe porque un fallo de render en producción se
 * muestra sin detalle, y sin esto habría que adivinar.
 *
 * No expone secretos: de la clave solo muestra los últimos seis caracteres,
 * lo justo para saber CUÁL está en uso.
 */
export async function GET(peticion: NextRequest) {
  const claveEnv = process.env.NEXT_PUBLIC_SUPABASE_KEY;
  const host = (peticion.headers.get('host') ?? '').split(':')[0].replace(/^www\./, '');
  const esLocal = !host || host === 'localhost' || host.endsWith('.vercel.app');
  const dominio = esLocal
    ? (process.env.NEXT_PUBLIC_DOMINIO_POR_DEFECTO ?? 'visitlafortunacr.com')
    : host;

  const informe: Record<string, unknown> = {
    host_recibido: host,
    dominio_que_busca: dominio,
    url_env: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(sin variable: usa el respaldo del código)',
    clave_env: claveEnv ? `…${claveEnv.slice(-6)} (largo ${claveEnv.length})` : '(sin variable: usa el respaldo del código)',
  };

  try {
    const { data, error } = await supabase
      .from('dst_destino')
      .select('babosa, dominio, esta_activo, idiomas')
      .limit(5);
    informe.lectura_destinos = error ? { fallo: error.message, codigo: error.code } : data;
  } catch (fallo) {
    informe.lectura_destinos = { excepcion: fallo instanceof Error ? fallo.message : String(fallo) };
  }

  try {
    const { data, error } = await supabase.rpc('negocios_publicados', {
      p_dominio: dominio, p_idioma: 'es',
    });
    informe.negocios = error ? { fallo: error.message, codigo: error.code } : { total: (data ?? []).length };
  } catch (fallo) {
    informe.negocios = { excepcion: fallo instanceof Error ? fallo.message : String(fallo) };
  }

  return NextResponse.json(informe, { status: 200 });
}
