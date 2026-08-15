import { type NextRequest } from "next/server";
import { adminLoginSchema } from "@/lib/validation";
import { validateCredentials, createSession, setSessionCookies } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/security";
import { getClientIp, hashIp } from "@/lib/ip";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/login  { username, password }
 * Rate limit básico por IP para frenar fuerza bruta.
 */
export async function POST(req: NextRequest) {
  const ipHash = hashIp(getClientIp(req.headers));
  const key = `admin-login:${ipHash}`;
  const windowStart = new Date(Math.floor(Date.now() / (60_000)) * 60_000);

  const attempt = await prisma.rateLimitEntry.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (attempt.count > 10) {
    return jsonError("Demasiados intentos. Espera un minuto.", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido", 400);
  }
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) return jsonError("Credenciales inválidas", 400);

  if (!validateCredentials(parsed.data.username, parsed.data.password)) {
    return jsonError("Usuario o contraseña incorrectos", 401);
  }

  const { token, csrf } = await createSession();
  setSessionCookies(token, csrf);
  return jsonOk({ csrf });
}
