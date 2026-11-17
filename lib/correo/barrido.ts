import 'server-only';
import { servicio } from '@/lib/supabase-servidor';
import { responderSegunElModo } from '@/lib/correo/entrante';

/*
 * Cada pocos minutos: ¿quedó algún correo de un viajero sin que la IA lo lea?
 *
 * ⚠️ POR QUÉ NO ALCANZA CON PROCESARLO AL LLEGAR.
 *
 * `recibirCorreo` ya redacta en el momento en que entra el correo. Pero ese
 * camino tiene un `catch`: si la IA falla justo ahí —la API con hipo, un
 * tiempo agotado, la cuota— el correo queda guardado y la conversación
 * abierta, y **el borrador no lo volvía a pedir nadie nunca**. Se quedaba
 * esperando a que una persona se diera cuenta sola. Es la forma más cara de
 * fallar: callada y sobre la respuesta de alguien que ya mostró interés.
 *
 * Esto es la red. Tony lo pidió así: «que este correo quede totalmente
 * leyéndose con el agente cada, no sé, 5 o 10 minutos».
 *
 * ⚠️ NO MANDA NADA. Deja el borrador en `pendiente_aprobacion`, que es lo que
 * el panel muestra en IA → Aprobaciones. Quien manda es Tony, salvo que él
 * ponga el modo en `sola`, y eso se decide en la base, no acá.
 */

export type ResumenBarrido = {
  mirados: number;
  yaTenianBorrador: number;
  yaContestados: number;
  redactados: number;
  fallidos: number;
  detalles: string[];
};

/** Cuántos días para atrás se mira. Más viejo que esto ya no se contesta solo. */
const DIAS = 7;

export async function barrerCorreosSinContestar(limite = 10): Promise<ResumenBarrido> {
  const db = servicio();
  const resumen: ResumenBarrido = {
    mirados: 0, yaTenianBorrador: 0, yaContestados: 0, redactados: 0, fallidos: 0, detalles: [],
  };

  const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000).toISOString();

  /* 1. Los correos que ENTRARON hace poco. */
  const { data: entrantes, error: eEntrantes } = await db
    .from('dst_mensaje')
    .select('id, destino_id, viajero_id, conversacion_id, enviado_en')
    .eq('canal', 'email')
    .eq('direccion', 'entrante')
    .gte('enviado_en', desde)
    .not('conversacion_id', 'is', null)
    .order('enviado_en', { ascending: false })
    .limit(200);

  /* Un error acá no se traga: si la consulta falla, el barrido no corrió, y
     decir «0 pendientes» sería mentir. */
  if (eEntrantes) {
    resumen.detalles.push(`No se pudieron leer los correos entrantes: ${eEntrantes.message}`);
    resumen.fallidos++;
    return resumen;
  }

  /* Una conversación se mira UNA vez, por su correo más nuevo. */
  const porConversacion = new Map<string, { destino_id: string; viajero_id: string; enviado_en: string }>();
  for (const m of entrantes ?? []) {
    const c = m.conversacion_id as string;
    if (!porConversacion.has(c)) {
      porConversacion.set(c, {
        destino_id: m.destino_id as string,
        viajero_id: m.viajero_id as string,
        enviado_en: m.enviado_en as string,
      });
    }
  }
  resumen.mirados = porConversacion.size;
  if (!porConversacion.size) return resumen;

  const ids = [...porConversacion.keys()];

  /* 2. Las que ya tienen un borrador esperando: esas ya están atendidas por
        la máquina, falta que una persona las apruebe. */
  const { data: pendientes } = await db
    .from('dst_automatizacion_envio')
    .select('conversacion_id')
    .in('conversacion_id', ids)
    .eq('estado', 'pendiente_aprobacion');
  const conBorrador = new Set((pendientes ?? []).map((p) => p.conversacion_id as string));

  /* 3. Las que ya se contestaron DESPUÉS del correo del viajero. */
  const { data: salientes } = await db
    .from('dst_mensaje')
    .select('conversacion_id, enviado_en')
    .in('conversacion_id', ids)
    .eq('direccion', 'saliente')
    .order('enviado_en', { ascending: false });
  const ultimaSalida = new Map<string, string>();
  for (const m of salientes ?? []) {
    const c = m.conversacion_id as string;
    if (!ultimaSalida.has(c)) ultimaSalida.set(c, m.enviado_en as string);
  }

  /* 4. Lo que queda es lo que de verdad está sin leer. */
  const { data: convs } = await db
    .from('dst_conversacion')
    .select('id, solicitud_id')
    .in('id', ids);
  const solicitudDe = new Map((convs ?? []).map((c) => [c.id as string, (c.solicitud_id as string | null) ?? null]));

  let hechos = 0;
  for (const [conversacionId, info] of porConversacion) {
    if (conBorrador.has(conversacionId)) { resumen.yaTenianBorrador++; continue; }
    const salida = ultimaSalida.get(conversacionId);
    if (salida && salida > info.enviado_en) { resumen.yaContestados++; continue; }
    if (hechos >= limite) continue;

    hechos++;
    try {
      const r = await responderSegunElModo({
        destinoId: info.destino_id,
        viajeroId: info.viajero_id,
        conversacionId,
        solicitudId: solicitudDe.get(conversacionId) ?? null,
      });
      if (r.envio_id || r.modo === 'sola') resumen.redactados++;
      else resumen.fallidos++;
      resumen.detalles.push(`${conversacionId}: ${r.motivo}`);
    } catch (fallo) {
      /* Que una conversación reviente no puede parar a las demás. */
      resumen.fallidos++;
      resumen.detalles.push(`${conversacionId}: ${fallo instanceof Error ? fallo.message : String(fallo)}`);
    }
  }

  return resumen;
}
