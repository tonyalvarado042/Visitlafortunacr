import 'server-only';
import { responderConversacion } from '@/lib/ia/agente';
import { generarItinerarioParaSolicitud } from '@/lib/ia/planificador';

/*
 * Los trabajos largos que corren después de responder. Son DATOS y no
 * funciones a propósito: en Cloudflare Workers viajan por una Queue
 * (cloudflare/entrada.ts los consume) y una función no se puede mandar por una
 * cola. Ver lib/segundo-plano.ts.
 *
 * Ninguno lee cabeceras ni cookies: corren sin petición detrás. Si alguno
 * necesita el destino, que lo reciba aquí como dato.
 */
export type Trabajo =
  | { tipo: 'itinerario'; solicitudId: string; canal: 'web' | 'whatsapp' }
  | { tipo: 'concierge_whatsapp'; conversacionId: string };

/* Nunca lanza: un trabajo que falla se anota y se sigue, igual que hacía cada
   after() por su cuenta. Así la cola no lo reintenta y no sale un plan ni una
   respuesta de WhatsApp repetidos. */
export async function ejecutarTrabajo(t: Trabajo): Promise<void> {
  try {
    if (t.tipo === 'itinerario') {
      await generarItinerarioParaSolicitud(t.solicitudId, t.canal);
      return;
    }
    const r = await responderConversacion(t.conversacionId, { origen: 'whatsapp' });
    if (r.solicitud_creada?.tipo === 'itinerario') {
      await generarItinerarioParaSolicitud(r.solicitud_creada.id, 'whatsapp');
    }
  } catch (fallo) {
    console.error(`trabajo ${t.tipo} falló:`, fallo);
  }
}
