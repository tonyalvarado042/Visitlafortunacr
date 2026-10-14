import 'server-only';
import { after } from 'next/server';
import { ejecutarTrabajo, type Trabajo } from '@/lib/trabajos';

export type { Trabajo };

/*
 * Correr un trabajo largo después de responder.
 *
 * En Vercel es after(), como siempre: la función sigue viva hasta su
 * maxDuration. En Cloudflare Workers eso no alcanza —lo que corre después de
 * la respuesta tiene 30 segundos— y el planificador llama a Claude y tarda
 * más. Ahí el trabajo se manda a la Queue `visit-la-fortuna-trabajos`, cuyo
 * consumidor tiene 15 minutos. cloudflare/entrada.ts deja la cola en
 * globalThis; si no está, es que no estamos en Workers.
 *
 * Se manda ANTES de responder (es un instante) para que no dependa de nada que
 * pase después. Si la cola falla, se cae a after(): mejor 30 segundos que nada.
 */
type Cola = { send(cuerpo: Trabajo): Promise<void> };

export async function enSegundoPlano(trabajo: Trabajo): Promise<void> {
  const cola = (globalThis as { __colaTrabajos?: Cola }).__colaTrabajos;
  if (cola) {
    try {
      await cola.send(trabajo);
      return;
    } catch (fallo) {
      console.error('no se pudo encolar, va por after():', fallo);
    }
  }
  after(() => ejecutarTrabajo(trabajo));
}
