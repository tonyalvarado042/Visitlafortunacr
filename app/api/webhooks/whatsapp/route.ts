import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse, after } from 'next/server';
import { hayClaveDeServicio, servicio } from '@/lib/supabase-servidor';
import { hayClaveDeIA } from '@/lib/ia/cliente';
import { responderConversacion } from '@/lib/ia/agente';
import { generarItinerarioParaSolicitud } from '@/lib/ia/planificador';

/*
 * WhatsApp Cloud API (Meta). GET verifica el webhook; POST recibe mensajes y
 * estados. Cada número de WhatsApp está en dst_canal con su phone_number_id,
 * que es como se sabe a qué destino pertenece el mensaje. Se responde 200
 * enseguida y la IA trabaja después (after), porque Meta reintenta si tarda.
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(peticion: NextRequest) {
  const { searchParams } = new URL(peticion.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (
    token &&
    searchParams.get('hub.mode') === 'subscribe' &&
    searchParams.get('hub.verify_token') === token
  ) {
    return new Response(searchParams.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Verificación rechazada', { status: 403 });
}

type Mensaje = {
  id: string; from: string; timestamp: string; type: string;
  text?: { body: string }; button?: { text: string }; interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
};
type Estado = { id: string; status: string; timestamp: string };
type Valor = {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: Mensaje[];
  statuses?: Estado[];
};

function firmaValida(crudo: string, firma: string | null): boolean {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto) return true; // sin secreto configurado no se puede verificar; se acepta y se anota
  if (!firma?.startsWith('sha256=')) return false;
  const esperada = createHmac('sha256', secreto).update(crudo).digest('hex');
  const recibida = firma.slice(7);
  return esperada.length === recibida.length && timingSafeEqual(Buffer.from(esperada), Buffer.from(recibida));
}

function textoDe(m: Mensaje): string {
  if (m.type === 'text' && m.text?.body) return m.text.body;
  if (m.type === 'button' && m.button?.text) return m.button.text;
  if (m.type === 'interactive') return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '[respuesta interactiva]';
  return `[el viajero envió un mensaje de tipo ${m.type} que no puedo leer: pedile que lo escriba en texto]`;
}

const ESTADOS: Record<string, string> = { sent: 'enviado', delivered: 'entregado', read: 'leido', failed: 'fallido' };

export async function POST(peticion: NextRequest) {
  const crudo = await peticion.text();
  if (!firmaValida(crudo, peticion.headers.get('x-hub-signature-256'))) {
    return new Response('Firma inválida', { status: 401 });
  }
  if (!hayClaveDeServicio()) return NextResponse.json({ ok: false, error: 'Sin clave de servicio.' }, { status: 503 });

  let cuerpo: { entry?: { changes?: { value?: Valor }[] }[] };
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }

  const db = servicio();
  const trabajos: (() => Promise<void>)[] = [];

  for (const entrada of cuerpo.entry ?? []) {
    for (const cambio of entrada.changes ?? []) {
      const valor = cambio.value;
      if (!valor) continue;

      // Estados de mensajes que mandamos nosotros.
      for (const estado of valor.statuses ?? []) {
        const nuevo = ESTADOS[estado.status];
        if (!nuevo) continue;
        trabajos.push(async () => {
          await db.from('dst_mensaje').update({ estado_envio: nuevo, ...(nuevo === 'leido' ? { leido_en: new Date().toISOString() } : {}) })
            .eq('canal', 'whatsapp').eq('id_externo', estado.id);
        });
      }

      if (!valor.messages?.length) continue;

      const phoneNumberId = valor.metadata?.phone_number_id ?? '';
      const { data: canal } = await db
        .from('dst_canal')
        .select('destino_id')
        .eq('proveedor', 'meta').eq('identificador', phoneNumberId).eq('esta_activo', true)
        .maybeSingle();
      if (!canal) {
        console.warn(`WhatsApp: ningún destino tiene el phone_number_id ${phoneNumberId}.`);
        continue;
      }

      for (const m of valor.messages) {
        const desde = `+${m.from.replace(/\D/g, '')}`;
        const nombre = valor.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? null;
        const { data: entradaMsg, error } = await db.rpc('registrar_mensaje_entrante', {
          p_destino_id: canal.destino_id,
          p_canal: 'whatsapp',
          p_identificador: desde,
          p_cuerpo: textoDe(m).slice(0, 4000),
          p_id_externo: m.id,
          p_nombre: nombre,
          p_idioma: null,
          p_metadatos: { tipo: m.type, timestamp: m.timestamp },
          p_viajero_id: null,
        });
        if (error) {
          console.error('registrar_mensaje_entrante (whatsapp) falló:', error.message);
          continue;
        }
        if (entradaMsg.duplicado || entradaMsg.atendida_por !== 'ia' || !hayClaveDeIA()) continue;

        const conversacionId = entradaMsg.conversacion_id as string;
        trabajos.push(async () => {
          try {
            const r = await responderConversacion(conversacionId, { origen: 'whatsapp' });
            if (r.solicitud_creada?.tipo === 'itinerario') {
              await generarItinerarioParaSolicitud(r.solicitud_creada.id, 'whatsapp');
            }
          } catch (fallo) {
            console.error('El concierge falló por WhatsApp:', fallo);
          }
        });
      }
    }
  }

  if (trabajos.length) {
    after(async () => {
      for (const trabajo of trabajos) await trabajo();
    });
  }
  return NextResponse.json({ ok: true });
}
