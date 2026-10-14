import { env as entorno } from 'cloudflare:workers';
import manejador from 'vinext/server/fetch-handler';
import { secreto } from '../lib/secretos';
import { ejecutarTrabajo, type Trabajo } from '../lib/trabajos';

/* La cola de trabajos largos queda a mano de lib/segundo-plano.ts, que no
   puede importar 'cloudflare:workers' porque también compila para Vercel. */
(globalThis as { __colaTrabajos?: unknown }).__colaTrabajos =
  (entorno as { TRABAJOS?: unknown }).TRABAJOS;

export * from 'vinext/server/fetch-handler';

/*
 * La puerta del Worker: el sitio entero (lo que arma vinext) más los crons.
 *
 * En Vercel los crons viven en vercel.json y Vercel llama a la ruta con
 * `Authorization: Bearer CRON_SECRET`. En Workers un cron no llama a ninguna
 * URL: dispara `scheduled()`. Aquí se traduce una cosa a la otra —se arma la
 * misma petición y se le pasa al mismo manejador—, así que las rutas
 * /api/cron/* no saben dónde corren.
 *
 * Las horas tienen que ser EXACTAMENTE las de `triggers` en
 * cloudflare.config.ts: Cloudflare entrega la expresión cron como texto, y es
 * con eso que se elige la ruta. Si se cambia una, se cambian las dos.
 */
export const CRONES: Record<string, string> = {
  '0 13 * * *': '/api/cron/automatizaciones',
  '0 5 * * *': '/api/cron/externas',
  '15 12 * * *': '/api/cron/tipo-cambio',
};

type Manejador = {
  fetch(peticion: Request, env: unknown, ctx: ExecutionContext): Promise<Response>;
};

export default {
  ...(manejador as object),

  async scheduled(evento: ScheduledController, env: unknown, ctx: ExecutionContext) {
    const ruta = CRONES[evento.cron];
    if (!ruta) {
      console.error(`cron sin ruta: "${evento.cron}"`);
      return;
    }
    /* Mientras Vercel siga siendo producción, sus crons también corren, contra
       la misma base. Refrescar dos veces no hace daño; mandar dos veces el
       seguimiento a un viajero sí. Así que este cron espera a que el Worker
       sea oficialmente producción: CLOUDFLARE_ES_PRODUCCION=si, que se pone
       el mismo día que se quitan los crons de Vercel. */
    if (ruta === '/api/cron/automatizaciones' && process.env.CLOUDFLARE_ES_PRODUCCION?.trim() !== 'si') {
      console.log('cron automatizaciones: en pausa hasta CLOUDFLARE_ES_PRODUCCION=si');
      return;
    }
    /* Mismo orden que las rutas: primero la bóveda, después el entorno. */
    const clave = await secreto('CRON_SECRET');
    if (!clave) {
      console.error(`cron ${ruta}: no hay CRON_SECRET`);
      return;
    }
    const peticion = new Request(`https://cron.interno${ruta}`, {
      headers: { authorization: `Bearer ${clave}` },
    });
    const respuesta = await (manejador as unknown as Manejador).fetch(peticion, env, ctx);
    if (!respuesta.ok) console.error(`cron ${ruta}: ${respuesta.status} ${await respuesta.text()}`);
  },

  /* El consumidor de la Queue: aquí corre lo que en Vercel corría en after().
     ejecutarTrabajo nunca lanza, así que todo mensaje se da por hecho y la
     cola no lo reintenta (un reintento sería un plan o una respuesta doble). */
  async queue(lote: MessageBatch<Trabajo>) {
    for (const mensaje of lote.messages) {
      await ejecutarTrabajo(mensaje.body);
      mensaje.ack();
    }
  },
};
