import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { safeEqual } from "./auth";

/** Token público aleatorio, largo y criptográficamente seguro. */
export function generatePublicToken(): string {
  return randomBytes(32).toString("base64url"); // ~43 chars
}

export type EventGateResult =
  | { ok: true; event: Awaited<ReturnType<typeof prisma.event.findUnique>> }
  | { ok: false; status: number; reason: string };

/**
 * Valida que un evento existe, que el token coincide (tiempo constante),
 * que está activo y que no ha caducado. Punto único de autorización pública.
 */
export async function gatePublicEvent(
  slug: string,
  token: string
): Promise<EventGateResult> {
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return { ok: false, status: 404, reason: "Evento no encontrado" };

  // Comparación en tiempo constante del token.
  if (!safeEqual(token, event.publicToken)) {
    return { ok: false, status: 403, reason: "Enlace no válido" };
  }
  if (!event.isActive) {
    return { ok: false, status: 403, reason: "Las subidas están desactivadas" };
  }
  if (event.closesAt && event.closesAt.getTime() < Date.now()) {
    return { ok: false, status: 403, reason: "El plazo de subida ha finalizado" };
  }
  return { ok: true, event };
}
