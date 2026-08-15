import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { env } from "./env";

/**
 * Autenticación del panel /admin (MVP).
 * - Credenciales por variables de entorno.
 * - Sesión firmada persistida en BD; la cookie httpOnly guarda solo el token,
 *   y en BD guardamos su hash.
 * - Arquitectura preparada para sustituir por OIDC/proveedor externo:
 *   basta cambiar validateCredentials() y createSession().
 */

const SESSION_COOKIE = "bf_admin";
const CSRF_COOKIE = "bf_csrf";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 horas

/** Comparación en tiempo constante de strings. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function validateCredentials(username: string, password: string): boolean {
  // Comparación en tiempo constante para no filtrar longitud/coincidencia.
  const okUser = safeEqual(username, env.ADMIN_USERNAME);
  const okPass = safeEqual(password, env.ADMIN_PASSWORD);
  return okUser && okPass;
}

function hashToken(token: string): string {
  return createHash("sha256").update(env.SESSION_SECRET + ":" + token).digest("hex");
}

/** Crea una sesión en BD y devuelve el token en claro (para la cookie). */
export async function createSession(): Promise<{ token: string; csrf: string }> {
  const token = randomBytes(32).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  await prisma.adminSession.create({
    data: {
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return { token, csrf };
}

export function setSessionCookies(token: string, csrf: string) {
  const store = cookies();
  const secure = env.NODE_ENV === "production";
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  // El token CSRF se expone al JS del panel (no httpOnly) para el patrón
  // double-submit cookie. Se compara con la cabecera x-csrf-token.
  store.set(CSRF_COOKIE, csrf, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const store = cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.adminSession
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }
  store.delete(SESSION_COOKIE);
  store.delete(CSRF_COOKIE);
}

/** Devuelve true si la petición actual tiene una sesión de admin válida. */
export async function isAuthenticated(): Promise<boolean> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!session) return false;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    return false;
  }
  return true;
}

/**
 * Verifica el token CSRF (double-submit): la cookie no-httpOnly debe
 * coincidir con la cabecera enviada por el JS del panel.
 */
export function verifyCsrf(headers: Headers): boolean {
  const cookieToken = cookies().get(CSRF_COOKIE)?.value ?? "";
  const headerToken = headers.get("x-csrf-token") ?? "";
  if (!cookieToken || !headerToken) return false;
  return safeEqual(cookieToken, headerToken);
}

/** Limpia sesiones caducadas (llamable desde un cron/endpoint de mantenimiento). */
export async function purgeExpiredSessions(): Promise<number> {
  const res = await prisma.adminSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return res.count;
}
