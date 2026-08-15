import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePublicToken } from "@/lib/events";
import { guardMutation } from "@/lib/admin-guard";
import { jsonError, jsonOk } from "@/lib/security";
import { buildPublicUrl } from "@/lib/qr";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/events/:id/token
 * Regenera el token público (invalida enlaces/QR anteriores).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await guardMutation(req.headers);
  if (denied) return denied;

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return jsonError("Evento no encontrado", 404);

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { publicToken: generatePublicToken() },
  });

  return jsonOk({
    publicUrl: buildPublicUrl(env.APP_BASE_URL, updated.slug, updated.publicToken),
  });
}
