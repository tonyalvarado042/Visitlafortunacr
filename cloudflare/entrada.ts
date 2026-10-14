import manejador from 'vinext/server/fetch-handler';
import { secreto } from '../lib/secretos';

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
};
