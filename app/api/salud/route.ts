import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hayClaveDeServicio } from '@/lib/supabase-servidor';
import { hayClaveDeIA } from '@/lib/ia/cliente';

export const dynamic = 'force-dynamic';

/**
 * Diagnóstico: dice si el sitio puede hablar con la base y qué destino cree
 * que está sirviendo. Existe porque un fallo de render en producción se
 * muestra sin detalle, y sin esto habría que adivinar.
 *
 * No expone secretos: de la clave publicable solo muestra los últimos seis
 * caracteres, lo justo para saber CUÁL está en uso. De las dos SECRETAS no
 * muestra ni un carácter: solo si el código las da por buenas y, si no, por
 * qué las rechaza.
 *
 * Esa última parte no es adorno. El chat corta con un 503 si falta cualquiera
 * de las dos, y desde fuera las dos causas se ven idénticas. Peor: utilizable()
 * descarta en silencio un valor de menos de 30 caracteres o con puntos
 * suspensivos, que es exactamente lo que pasa al pegar una clave recortada del
 * panel de Supabase — la variable se ve puesta en Vercel y el código la cuenta
 * como ausente. Esto separa "no está" de "está pero no sirve".
 */

/* Se pregunta por las MISMAS funciones que usan las rutas de verdad, no por una
   copia de la condición: un diagnóstico que puede desviarse del código que
   diagnostica no sirve para nada. */
function diagnosticoSecreto(nombre: string, bueno: boolean) {
  const valor = process.env[nombre];
  if (!valor) return { estado: 'sin variable', usable: bueno };
  const limpio = valor.trim();
  const motivos: string[] = [];
  if (limpio.length < 30) motivos.push('tiene menos de 30 caracteres');
  if (limpio.includes('...') || limpio.endsWith('…')) motivos.push('trae puntos suspensivos: se pegó recortada');
  return {
    estado: bueno ? 'puesta y usable' : 'puesta pero DESCARTADA',
    usable: bueno,
    largo: limpio.length,
    ...(motivos.length ? { por_que: motivos } : {}),
  };
}
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
    /* Las dos que apagan el chat. `chat_disponible` es literalmente la
       condición de /api/ia/conversar: si sale false, el chat da 503. */
    supabase_secret_key: diagnosticoSecreto('SUPABASE_SECRET_KEY', hayClaveDeServicio()),
    anthropic_api_key: diagnosticoSecreto('ANTHROPIC_API_KEY', hayClaveDeIA()),
    anthropic_workspace_id: process.env.ANTHROPIC_WORKSPACE_ID?.trim() ? 'puesta' : 'sin variable',
    /* Solo los NOMBRES que llegaron al runtime, nunca los valores. Sirve para
       el caso en que la variable sí se cargó pero con otro nombre, o en otro
       entorno (Preview en vez de Production), o en otro proyecto de Vercel:
       desde fuera eso se ve igual que no haberla puesto. */
    nombres_presentes: Object.keys(process.env)
      .filter((n) => /SUPABASE|ANTHROPIC|CRON|GOOGLE_PLACES|SMTP|WHATSAPP|RESEND|VERCEL_ENV|VERCEL_GIT_COMMIT_REF/.test(n))
      .sort(),
    chat_disponible: hayClaveDeServicio() && hayClaveDeIA(),
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
