import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "bobc-app-pay",
    compatibilityDate: "2026-10-01",
    compatibilityFlags: ["nodejs_compat"],
    entrypoint: "@tanstack/react-start/server-entry",
    workersDev: true,
    observability: { enabled: true },
  },
});
