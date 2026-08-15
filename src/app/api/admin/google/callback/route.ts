import { type NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { isAuthenticated } from "@/lib/auth";
import { jsonError } from "@/lib/security";
import { env } from "@/lib/env";
import {
  setSetting,
  GOOGLE_REFRESH_TOKEN_KEY,
  GOOGLE_ACCOUNT_EMAIL_KEY,
} from "@/lib/config";
import { resetDriveCache } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectUri() {
  return `${env.APP_BASE_URL.replace(/\/+$/, "")}/api/admin/google/callback`;
}

/**
 * GET /api/admin/google/callback?code=&state=
 * Intercambia el código por tokens y guarda el refresh token en BD.
 */
export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return jsonError("No autorizado", 401);

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("bf_goauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return jsonError("Estado OAuth inválido. Reintenta la conexión.", 400);
  }

  const oauth2 = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    redirectUri()
  );

  try {
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      return jsonError(
        "Google no devolvió refresh token. Revoca el acceso en https://myaccount.google.com/permissions y reconecta.",
        400
      );
    }
    await setSetting(GOOGLE_REFRESH_TOKEN_KEY, tokens.refresh_token);

    // Guarda el email de la cuenta conectada (informativo).
    try {
      oauth2.setCredentials(tokens);
      const oauth2api = google.oauth2({ version: "v2", auth: oauth2 });
      const me = await oauth2api.userinfo.get();
      if (me.data.email) await setSetting(GOOGLE_ACCOUNT_EMAIL_KEY, me.data.email);
    } catch {
      /* no crítico */
    }

    resetDriveCache();
  } catch (err) {
    console.error("google_oauth_callback_error");
    return jsonError("No se pudo completar la conexión con Google", 502);
  }

  const dest = `${env.APP_BASE_URL.replace(/\/+$/, "")}/admin?google=connected`;
  const res = NextResponse.redirect(dest);
  res.cookies.delete("bf_goauth_state");
  return res;
}
