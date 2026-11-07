import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

/*
 * El Worker de Cloudflare. Convive con Vercel: `npm run build` sigue armando
 * el sitio para Vercel y `npm run build:vinext` lo arma para Workers.
 * Los secretos (SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY, CRON_SECRET...) no
 * van aquí: se cargan como secretos del Worker en el panel de Cloudflare.
 */
export default defineConfig({
  worker: defineWorker({
    name: "visit-la-fortuna",
    entrypoint: "./cloudflare/entrada.ts",
    compatibilityDate: "2026-10-14",
    compatibilityFlags: ["nodejs_compat"],
    /* Se deja encendido a proposito. Al declarar dominios o rutas, cf lo apaga
       por omision y se pierde la URL de pruebas del Worker. */
    workersDev: true,
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    /* Sin esto el Worker es una caja negra: los console.log de los crons y de
       la cola no se guardan en ninguna parte, y el paso 5 de CLAUDE.md pide
       poder leerlos. La doc de Cloudflare lo recomienda antes de producción.
       Viene encendido por omisión en Workers nuevos, pero se deja escrito para
       que la config mande y un despliegue futuro no lo apague. */
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true, headSamplingRate: 1 },
    },
    env: {
      ASSETS: bindings.assets(),
      // Reemplaza a sharp: ver cloudflare/sharp-imagenes.ts
      IMAGES: bindings.images(),
      // Trabajos largos (planificador, concierge de WhatsApp): ver lib/segundo-plano.ts
      TRABAJOS: bindings.queue({ name: "visit-la-fortuna-trabajos" }),
      /* EL CRON DE AUTOMATIZACIONES, ENCENDIDO. Dicho por Tony el 6 de
         noviembre de 2026, despues de contar en seco lo que saldria.

         Va aqui y no en el panel a proposito: no es una llave, es una
         bandera. Escrita en la config queda versionada y un despliegue
         futuro no la puede apagar sin que se vea en el diff — lo mismo que
         ya se hace con `observability` arriba. Una bandera que solo vive en
         el panel se apaga sola el dia que alguien recrea el Worker.

         Estuvo apagada porque Vercel corria los mismos crons contra la
         misma base. Vercel quedo congelado (`"live": false`), asi que ya no
         hay con quien chocar. Ver cloudflare/entrada.ts. */
      CLOUDFLARE_ES_PRODUCCION: bindings.text("si"),
    },
    /* Las expresiones tienen que coincidir con CRONES en
       cloudflare/entrada.ts, o el cron entra y no encuentra ruta.
       Antes decian «los mismos de vercel.json»: ya no. Ese archivo quedo con
       `"crons": []` el 6 de noviembre de 2026, cuando Vercel se congelo.
       Estos son los unicos crons del proyecto. */
    triggers: [
      triggers.scheduled({ schedule: "0 13 * * *" }),
      triggers.scheduled({ schedule: "0 5 * * *" }),
      triggers.scheduled({ schedule: "15 12 * * *" }),
      /* EL CORTE, y por eso es RUTA y no "custom domain".
         Un custom domain exige borrar antes los registros de DNS que apuntan a
         Vercel, y entre borrarlos y que el Worker tome el dominio el sitio se
         cae un minuto. Una ruta no: **no hace nada mientras el registro este
         en DNS-only (nube gris)**. El cambio ocurre al poner el registro en
         proxy (nube naranja), y es instantaneo.

         PARA VOLVER ATRAS: apagar el proxy de esos dos registros. Vercel
         vuelve a servir en segundos, sin tocar este archivo ni desplegar. */
      triggers.fetch({ pattern: "visitlafortunacr.com/*", zone: "visitlafortunacr.com" }),
      triggers.fetch({ pattern: "www.visitlafortunacr.com/*", zone: "visitlafortunacr.com" }),
      // De a uno: cada trabajo puede tardar minutos con Claude.
      triggers.queue({ name: "visit-la-fortuna-trabajos", maxBatchSize: 1, maxRetries: 1 }),
    ],
  }),
});
