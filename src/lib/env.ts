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

// En test (y durante `next build`, cuando las variables aún no existen)
// permitimos valores dummy para no exigir un entorno real. En ejecución real
// la validación sigue siendo estricta: si falta algo en runtime, lanza error.
const isTest = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
const isBuild = process.env.NEXT_PHASE === "phase-production-build";

const PLACEHOLDERS: Record<string, string> = {
  DATABASE_URL: "postgresql://placeholder",
  ADMIN_USERNAME: "placeholder",
  ADMIN_PASSWORD: "placeholder12",
  SESSION_SECRET: "placeholder-secret-placeholder",
  IP_HASH_SALT: "placeholder-salt-1234",
};

const source =
  isTest || isBuild ? { ...PLACEHOLDERS, ...process.env } : process.env;

const parsed = schema.safeParse(source);

if (!parsed.success) {
  // No imprimimos los valores, solo qué claves fallan.
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Variables de entorno inválidas o ausentes: ${missing}`);
}

export const env = parsed.data;
