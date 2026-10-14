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
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      // Reemplaza a sharp: ver cloudflare/sharp-imagenes.ts
      IMAGES: bindings.images(),
      // Trabajos largos (planificador, concierge de WhatsApp): ver lib/segundo-plano.ts
      TRABAJOS: bindings.queue({ name: "visit-la-fortuna-trabajos" }),
    },
    // Los mismos de vercel.json. Las expresiones tienen que coincidir con
    // CRONES en cloudflare/entrada.ts.
    triggers: [
      triggers.scheduled({ schedule: "0 13 * * *" }),
      triggers.scheduled({ schedule: "0 5 * * *" }),
      triggers.scheduled({ schedule: "15 12 * * *" }),
      // De a uno: cada trabajo puede tardar minutos con Claude.
      triggers.queue({ name: "visit-la-fortuna-trabajos", maxBatchSize: 1, maxRetries: 1 }),
    ],
  }),
});
