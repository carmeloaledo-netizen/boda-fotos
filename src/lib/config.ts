import { prisma } from "./prisma";
import { env } from "./env";

/**
 * Configuración en BD (clave/valor). Permite guardar el refresh token de
 * Google obtenido desde el navegador ("Conectar Google Drive"), en lugar de
 * exigir el script local.
 */
export const GOOGLE_REFRESH_TOKEN_KEY = "google_refresh_token";
export const GOOGLE_ACCOUNT_EMAIL_KEY = "google_account_email";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** Refresh token efectivo: primero BD (panel), luego variable de entorno. */
export async function getGoogleRefreshToken(): Promise<string> {
  const fromDb = await getSetting(GOOGLE_REFRESH_TOKEN_KEY);
  return fromDb || env.GOOGLE_REFRESH_TOKEN || "";
}
