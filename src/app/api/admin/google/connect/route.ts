import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { google } from "googleapis";
import { isAuthenticated } from "@/lib/auth";
import { jsonError } from "@/lib/security";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
];

function redirectUri() {
  return `${env.APP_BASE_URL.replace(/\/+$/, "")}/api/admin/google/callback`;
}

/**
 * GET /api/admin/google/connect
 * Inicia el flujo OAuth: redirige a Google para que el fotógrafo autorice
 * el acceso a SU Drive. El refresh token resultante se guarda en BD.
 */
export async function GET(_req: NextRequest) {
  if (!(await isAuthenticated())) return jsonError("No autorizado", 401);

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return jsonError(
      "Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en el entorno",
      500
    );
  }

  const oauth2 = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    redirectUri()
  );

  const state = randomBytes(16).toString("hex");
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // fuerza a devolver refresh_token
    scope: SCOPES,
    state,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set("bf_goauth_state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
