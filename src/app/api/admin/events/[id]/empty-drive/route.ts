import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardMutation } from "@/lib/admin-guard";
import { jsonError, jsonOk } from "@/lib/security";
import { deleteFolder } from "@/lib/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/events/:id/empty-drive
 * Vacía en Drive la carpeta de fotos del evento (01_Fotos_invitados y su
 * contenido). Acción manual y deliberada del administrador, pensada para la
 * rutina de "descargar y borrar tras la boda".
 *
 * Body opcional: { purgeRecords?: boolean } para borrar también los registros
 * de subidas en la BD (por defecto se conservan para el histórico/CSV).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await guardMutation(req.headers);
  if (denied) return denied;

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return jsonError("Evento no encontrado", 404);

  if (!event.driveGuestsFolderId) {
    return jsonError("Este evento aún no tiene carpeta de fotos en Drive", 409);
  }

  let purgeRecords = false;
  try {
    const body = await req.json();
    purgeRecords = body?.purgeRecords === true;
  } catch {
    /* body opcional */
  }

  try {
    await deleteFolder(event.driveGuestsFolderId);
  } catch (err) {
    console.error("empty_drive_error", { eventId: event.id });
    return jsonError("No se pudo vaciar la carpeta en Drive", 502);
  }

  // La subcarpeta se recreará automáticamente en la próxima subida.
  await prisma.event.update({
    where: { id: event.id },
    data: { driveGuestsFolderId: null },
  });

  let purgedRecords = 0;
  if (purgeRecords) {
    const res = await prisma.upload.deleteMany({ where: { eventId: event.id } });
    purgedRecords = res.count;
  }

  return jsonOk({ emptied: true, purgedRecords });
}
