import { type NextRequest } from "next/server";
import { z } from "zod";
import { gatePublicEvent } from "@/lib/events";
import { jsonError, jsonOk } from "@/lib/security";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  slug: z.string().min(1),
  t: z.string().min(1),
  keys: z.string().min(1), // csv de idempotencyKeys
});

/**
 * GET /api/public/upload/status?slug=&t=&keys=k1,k2
 * Permite al cliente reconciliar el estado tras una reconexión.
 */
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse({
    slug: req.nextUrl.searchParams.get("slug"),
    t: req.nextUrl.searchParams.get("t"),
    keys: req.nextUrl.searchParams.get("keys"),
  });
  if (!parsed.success) return jsonError("Parámetros inválidos", 400);

  const gate = await gatePublicEvent(parsed.data.slug, parsed.data.t);
  if (!gate.ok) return jsonError(gate.reason, gate.status);
  const event = gate.event!;

  const keys = parsed.data.keys.split(",").slice(0, 100);
  const uploads = await prisma.upload.findMany({
    where: { eventId: event.id, idempotencyKey: { in: keys } },
    select: { idempotencyKey: true, status: true, driveFileId: true },
  });

  return jsonOk({
    statuses: uploads.map((u: (typeof uploads)[number]) => ({
      key: u.idempotencyKey,
      status: u.status,
      completed: u.status === "COMPLETED",
    })),
  });
}
