import { defineConfig, devices } from "@playwright/test";

/**
 * E2E del flujo principal del invitado.
 * Requiere la app en marcha con DRIVE_MOCK=1 y una BD de test sembrada.
 * El comando `webServer` la arranca automáticamente.
 *
 *   1. Prepara la BD:  DATABASE_URL=... npx prisma migrate deploy && npm run seed
 *   2. Ejecuta:        npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    ...devices["iPhone 13"], // mobile-first
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && DRIVE_MOCK=1 npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { DRIVE_MOCK: "1" },
      },
});
