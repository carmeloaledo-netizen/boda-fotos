import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { jsonError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Escapa un valor para CSV (RFC 4180). */
function csv(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * GET /api/admin/events/:id/export
 * Exporta un CSV con el listado de archivos del evento.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthenticated())) return jsonError("No autorizado", 401);

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return jsonError("Evento no encontrado", 404);

  const uploads = await prisma.upload.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "asc" },
  });

  const header = [
    "id",
    "estado",
    "nombre_original",
    "nombre_final",
    "mime",
    "tamano_bytes",
    "drive_file_id",
    "sha256",
    "invitado",
    "fecha",
    "error",
  ].join(",");

  const rows = uploads.map((u: (typeof uploads)[number]) =>
    [
      csv(u.id),
      csv(u.status),
      csv(u.originalName),
      csv(u.storedName),
      csv(u.mimeType),
      csv(u.sizeBytes),
      csv(u.driveFileId),
      csv(u.sha256),
      csv(u.guestName),
      csv(u.createdAt.toISOString()),
      csv(u.errorMessage),
    ].join(",")
  );

  const body = "﻿" + [header, ...rows].join("\r\n"); // BOM para Excel

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subidas-${event.slug}.csv"`,
    },
  });
}
