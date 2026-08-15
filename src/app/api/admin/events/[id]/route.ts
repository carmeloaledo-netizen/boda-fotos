import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventUpdateSchema } from "@/lib/validation";
import { guardRead, guardMutation } from "@/lib/admin-guard";
import { jsonError, jsonOk } from "@/lib/security";
import { buildPublicUrl } from "@/lib/qr";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/events/:id — detalle + estadísticas + últimas subidas. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await guardRead();
  if (denied) return denied;

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return jsonError("Evento no encontrado", 404);

  const [agg, completed, failed, recent] = await Promise.all([
    prisma.upload.aggregate({
      where: { eventId: event.id, status: "COMPLETED" },
      _sum: { sizeBytes: true },
      _count: true,
    }),
    prisma.upload.count({ where: { eventId: event.id, status: "COMPLETED" } }),
    prisma.upload.findMany({
      where: { eventId: event.id, status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, originalName: true, errorMessage: true, updatedAt: true },
    }),
    prisma.upload.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        originalName: true,
        storedName: true,
        guestName: true,
        sizeBytes: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  return jsonOk({
    event: {
      id: event.id,
      slug: event.slug,
      coupleName: event.coupleName,
      weddingDate: event.weddingDate.toISOString(),
      driveFolderId: event.driveFolderId,
      isActive: event.isActive,
      closesAt: event.closesAt?.toISOString() ?? null,
      coverImageUrl: event.coverImageUrl,
      logoUrl: event.logoUrl,
      accentColor: event.accentColor,
      welcomeMessage: event.welcomeMessage,
      thankYouMessage: event.thankYouMessage,
      publicUrl: buildPublicUrl(env.APP_BASE_URL, event.slug, event.publicToken),
    },
    stats: {
      completed,
      totalBytes: agg._sum.sizeBytes ?? 0,
    },
    failed,
    recent,
  });
}

/** PATCH /api/admin/events/:id — edita datos (no el slug). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await guardMutation(req.headers);
  if (denied) return denied;

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return jsonError("Evento no encontrado", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido", 400);
  }
  const parsed = eventUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Datos inválidos", 400, {
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }
  const d = parsed.data;

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: {
      coupleName: d.coupleName ?? undefined,
      weddingDate: d.weddingDate ?? undefined,
      driveFolderId: d.driveFolderId ?? undefined,
      isActive: typeof d.isActive === "boolean" ? d.isActive : undefined,
      closesAt: d.closesAt === undefined ? undefined : d.closesAt,
      coverImageUrl: d.coverImageUrl === undefined ? undefined : d.coverImageUrl || null,
      logoUrl: d.logoUrl === undefined ? undefined : d.logoUrl || null,
      accentColor: d.accentColor ?? undefined,
      welcomeMessage: d.welcomeMessage ?? undefined,
      thankYouMessage: d.thankYouMessage ?? undefined,
    },
  });

  return jsonOk({ event: { id: updated.id, isActive: updated.isActive } });
}

/**
 * DELETE /api/admin/events/:id?uploadId=xxx
 * - Con uploadId: elimina SOLO el registro de esa subida (no borra Drive).
 * - Sin uploadId: elimina el evento y sus registros (no borra Drive).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await guardMutation(req.headers);
  if (denied) return denied;

  const uploadId = req.nextUrl.searchParams.get("uploadId");
  if (uploadId) {
    await prisma.upload.deleteMany({
      where: { id: uploadId, eventId: params.id },
    });
    return jsonOk({ deleted: "upload" });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return jsonError("Evento no encontrado", 404);
  await prisma.event.delete({ where: { id: params.id } });
  return jsonOk({ deleted: "event" });
}
