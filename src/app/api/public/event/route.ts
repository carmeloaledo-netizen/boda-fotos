import { type NextRequest } from "next/server";
import { z } from "zod";
import { gatePublicEvent } from "@/lib/events";
import { jsonError, jsonOk } from "@/lib/security";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  slug: z.string().min(1).max(120),
  t: z.string().min(1).max(200),
});

/**
 * GET /api/public/event?slug=&t=
 * Devuelve SOLO la información pública mínima necesaria para pintar la
 * página del invitado. Nunca expone driveFolderId ni credenciales.
 */
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse({
    slug: req.nextUrl.searchParams.get("slug"),
    t: req.nextUrl.searchParams.get("t"),
  });
  if (!parsed.success) return jsonError("Parámetros inválidos", 400);

  const gate = await gatePublicEvent(parsed.data.slug, parsed.data.t);
  if (!gate.ok) return jsonError(gate.reason, gate.status);

  const e = gate.event!;
  return jsonOk({
    event: {
      slug: e.slug,
      coupleName: e.coupleName,
      weddingDate: e.weddingDate.toISOString(),
      coverImageUrl: e.coverImageUrl,
      logoUrl: e.logoUrl,
      accentColor: e.accentColor,
      welcomeMessage: e.welcomeMessage,
      thankYouMessage: e.thankYouMessage,
      closesAt: e.closesAt ? e.closesAt.toISOString() : null,
    },
    limits: {
      maxFileSizeBytes: env.MAX_FILE_SIZE_BYTES,
      maxFilesPerBatch: env.MAX_FILES_PER_BATCH,
      acceptedMimes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
    },
  });
}
