import { type NextRequest } from "next/server";
import { z } from "zod";
import { gatePublicEvent } from "@/lib/events";
import { jsonError, jsonOk } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getClientIp, hashIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/public/message
 * Cuerpo JSON: { slug, token, guestName?, message }
 *
 * Deja un mensaje/felicitación de un invitado para los novios. Solo texto:
 * no toca Drive, no consume ancho de banda. Es el "libro de firmas" digital.
 *
 * Autorización: misma puerta que las subidas (slug + token del evento).
 * Protección: rate limit por IP anonimizada + evento (comparte ventana con
 * las subidas, suficiente para frenar abuso en una boda).
 */
const bodySchema = z.object({
  slug: z.string().min(1).max(120),
  token: z.string().min(1).max(200),
  guestName: z.string().trim().max(60).optional().or(z.literal("")),
  message: z
    .string()
    .trim()
    .min(1, "Escribe un mensaje")
    .max(1000, "El mensaje es demasiado largo"),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Cuerpo inválido", 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Datos inválidos",
      400
    );
  }
  const { slug, token, guestName, message } = parsed.data;

  // 1) Autorización del evento (existe, token, activo, no caducado).
  const gate = await gatePublicEvent(slug, token);
  if (!gate.ok) return jsonError(gate.reason, gate.status);
  const event = gate.event!;

  // 2) Rate limit por IP anonimizada + evento.
  const ipHash = hashIp(getClientIp(req.headers));
  const rl = await checkRateLimit(event.id, ipHash);
  if (!rl.ok) {
    return jsonError("Demasiados mensajes. Inténtalo más tarde.", 429, {
      resetAt: rl.resetAt.toISOString(),
    });
  }

  // 3) Guardar el mensaje (solo metadatos de texto).
  await prisma.guestMessage.create({
    data: {
      eventId: event.id,
      guestName: guestName && guestName.trim() ? guestName.trim() : null,
      message,
      ipHash,
    },
  });

  return jsonOk({ status: "ok" });
}
