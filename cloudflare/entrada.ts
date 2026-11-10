import { env as entorno } from 'cloudflare:workers';
import manejador from 'vinext/server/fetch-handler';
import { secreto } from '../lib/secretos';
import { ejecutarTrabajo, type Trabajo } from '../lib/trabajos';
import { recibirCorreo } from '../lib/correo/entrante';

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
    /* Este gate existió porque Vercel corría los mismos crons contra la misma
       base: refrescar dos veces no hace daño, mandar dos veces el seguimiento
       a un viajero sí.

       **6 de noviembre de 2026: ya no hay con quien chocar.** Vercel quedó
       congelado —la API contesta `"live": false`, y un proyecto pausado no
       corre crons— y los crons se quitaron de `vercel.json` el mismo día.
       `CLOUDFLARE_ES_PRODUCCION=si` vive en `cloudflare.config.ts`.

       El gate se deja puesto igual: es el interruptor para apagar el envío
       automático sin desplegar código, y la línea de abajo deja dicho en los
       registros por qué no corrió. Un cron que se calla cuesta más que uno
       que falla. */
    if (ruta === '/api/cron/automatizaciones' && process.env.CLOUDFLARE_ES_PRODUCCION?.trim() !== 'si') {
      console.log('cron automatizaciones: en pausa hasta CLOUDFLARE_ES_PRODUCCION=si');
      return;
    }
    /* Las rutas no leen la clave igual: externas y tipo-cambio miran primero la
       bóveda del panel (secreto()), automatizaciones solo la variable de
       entorno. Si las dos difieren, una sola clave sirve a una ruta y no a la
       otra. No se tocan las rutas —eso cambiaría Vercel—: se prueba con la del
       entorno y, si da 401, con la de la bóveda. */
    const claves = [...new Set([process.env.CRON_SECRET?.trim(), await secreto('CRON_SECRET')])]
      .filter((c): c is string => !!c);
    if (!claves.length) {
      console.error(`cron ${ruta}: no hay CRON_SECRET`);
      return;
    }
    let respuesta: Response | null = null;
    for (const clave of claves) {
      const peticion = new Request(`https://cron.interno${ruta}`, {
        headers: { authorization: `Bearer ${clave}` },
      });
      respuesta = await (manejador as unknown as Manejador).fetch(peticion, env, ctx);
      if (respuesta.status !== 401) break;
    }
    if (respuesta && !respuesta.ok) console.error(`cron ${ruta}: ${respuesta.status} ${await respuesta.text()}`);
  },

  /*
   * EL CORREO QUE ENTRA. Cloudflare Email Routing llama a esto cuando llega un
   * correo a una dirección ruteada a este Worker (hola@visitlafortunacr.com).
   *
   * Por qué Email Routing y no el inbound de un proveedor: el dominio YA está
   * en Cloudflare y el sitio YA corre en este Worker. Es gratis, no hay
   * webhook que firmar ni otro servicio que se caiga aparte, y el correo entra
   * en el mismo proceso que lo va a contestar.
   *
   * ⚠️ NUNCA LANZA. Si esto tira, Cloudflare rebota el correo al remitente con
   * un error — o sea, al viajero. Un fallo nuestro no puede volverse un «tu
   * mensaje no se pudo entregar» en la bandeja de un cliente. Se traga todo,
   * se deja en los registros, y el correo se da por recibido.
   */
  async email(mensaje: ForwardableEmailMessage) {
    try {
      const { default: PostalMime } = await import('postal-mime');
      const leido = await PostalMime.parse(mensaje.raw);

      const r = await recibirCorreo({
        de: leido.from?.address ?? mensaje.from,
        para: mensaje.to,
        asunto: leido.subject ?? null,
        /* El texto plano manda; si el correo vino solo en HTML se le quitan
           las etiquetas a lo bruto, que para leerlo y contestarlo alcanza. */
        texto: (leido.text
          ?? (leido.html ?? '')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/[ 	]{2,}/g, ' ')
        ).trim(),
        id_externo: leido.messageId ?? null,
      });

      console.log(`correo de ${mensaje.from} para ${mensaje.to}: ${r.motivo}`);
    } catch (fallo) {
      console.error('email():', fallo instanceof Error ? fallo.message : fallo);
    }
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
