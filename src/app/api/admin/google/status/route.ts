import { isAuthenticated } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/security";
import { env } from "@/lib/env";
import {
  getSetting,
  GOOGLE_REFRESH_TOKEN_KEY,
  GOOGLE_ACCOUNT_EMAIL_KEY,
} from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/google/status
 * Indica si Drive está conectado y por qué vía (cuenta de servicio o OAuth).
 */
export async function GET() {
  if (!(await isAuthenticated())) return jsonError("No autorizado", 401);

  if (env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return jsonOk({
      connected: Boolean(env.GOOGLE_DRIVE_SHARED_DRIVE_ID),
      mode: "service_account",
      email: null,
    });
  }

  const token = (await getSetting(GOOGLE_REFRESH_TOKEN_KEY)) || env.GOOGLE_REFRESH_TOKEN;
  const email = await getSetting(GOOGLE_ACCOUNT_EMAIL_KEY);
  return jsonOk({
    connected: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && token),
    mode: "oauth",
    email,
    hasCredentials: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  });
}
