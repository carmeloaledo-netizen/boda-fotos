import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { eventCreateSchema } from "@/lib/validation";
import { generatePublicToken } from "@/lib/events";
import { guardRead, guardMutation } from "@/lib/admin-guard";
import { jsonError, jsonOk } from "@/lib/security";
import { buildPublicUrl } from "@/lib/qr";
import { env } from "@/lib/env";
import { verifyFolderAccessible } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/events — lista de eventos con contadores. */
export async function GET() {
  const denied = await guardRead();
  if (denied) return denied;

  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { uploads: true } },
    },
  });

  return jsonOk({
    events: events.map((e: (typeof events)[number]) => ({
      id: e.id,
      slug: e.slug,
      coupleName: e.coupleName,
      weddingDate: e.weddingDate.toISOString(),
      isActive: e.isActive,
      closesAt: e.closesAt?.toISOString() ?? null,
      uploadsCount: e._count.uploads,
      publicUrl: buildPublicUrl(env.APP_BASE_URL, e.slug, e.publicToken),
    })),
  });
}

/** POST /api/admin/events — crea un evento. */
export async function POST(req: NextRequest) {
  const denied = await guardMutation(req.headers);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo inválido", 400);
  }
  const parsed = eventCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Datos inválidos", 400, {
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }
  const data = parsed.data;

  const dup = await prisma.event.findUnique({ where: { slug: data.slug } });
  if (dup) return jsonError("Ya existe un evento con ese identificador", 409);

  // Solo se verifica si el fotógrafo pegó un ID manual. Lo normal es dejarlo
  // vacío y que la app cree la carpeta (accesible por definición).
  const accessible = data.driveFolderId
    ? await verifyFolderAccessible(data.driveFolderId)
    : true;

  const event = await prisma.event.create({
    data: {
      slug: data.slug,
      publicToken: generatePublicToken(),
      coupleName: data.coupleName,
      weddingDate: data.weddingDate,
      driveFolderId: data.driveFolderId,
      isActive: data.isActive,
      closesAt: data.closesAt ?? null,
      coverImageUrl: data.coverImageUrl || null,
      logoUrl: data.logoUrl || null,
      accentColor: data.accentColor,
      welcomeMessage: data.welcomeMessage || undefined,
      thankYouMessage: data.thankYouMessage || undefined,
    },
  });

  return jsonOk(
    {
      event: {
        id: event.id,
        slug: event.slug,
        publicUrl: buildPublicUrl(env.APP_BASE_URL, event.slug, event.publicToken),
      },
      driveFolderAccessible: accessible,
    },
    201
  );
}
