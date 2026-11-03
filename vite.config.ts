import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import path from "node:path";

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  resolve: {
    alias: {
      // sharp es nativo y no corre en Workers: ahí lo hace Cloudflare Images.
      sharp: path.resolve(import.meta.dirname, "cloudflare/sharp-imagenes.ts"),
    },
  },
});
