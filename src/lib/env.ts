import { z } from "zod";

/**
 * Validación centralizada de variables de entorno con Zod.
 * Falla rápido al arrancar si falta algo crítico, salvo en tests.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(16),

  // Modo A (recomendado con Workspace): cuenta de servicio + Unidad compartida.
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional().default(""),
  // Modo B (sin Workspace): OAuth con refresh token del fotógrafo.
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REFRESH_TOKEN: z.string().optional().default(""),
  // Obligatoria en Modo A; opcional en Modo B (usa "Mi unidad").
  GOOGLE_DRIVE_SHARED_DRIVE_ID: z.string().optional().default(""),

  MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(26_214_400),
  MAX_FILES_PER_BATCH: z.coerce.number().int().positive().max(100).default(20),

  RETENTION_DAYS: z.coerce.number().int().positive().default(365),
  IP_HASH_SALT: z.string().min(8),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(600),
});

// En test permitimos valores dummy para no exigir un entorno real.
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

const parsed = isTest
  ? schema.safeParse({
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test",
      ADMIN_USERNAME: process.env.ADMIN_USERNAME ?? "test",
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "testtest12",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "test-secret-test-secret",
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "test",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "test",
      GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN ?? "test",
      IP_HASH_SALT: process.env.IP_HASH_SALT ?? "test-salt-test-salt",
      ...process.env,
    })
  : schema.safeParse(process.env);

if (!parsed.success) {
  // No imprimimos los valores, solo qué claves fallan.
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Variables de entorno inválidas o ausentes: ${missing}`);
}

export const env = parsed.data;
