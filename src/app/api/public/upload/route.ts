import { type NextRequest } from "next/server";
import { z } from "zod";
import { gatePublicEvent } from "@/lib/events";
import { jsonError, jsonOk } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getClientIp, hashIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/ratelimit";
import { sniffImageMime, isAllowedMime, isAllowedExtension } from "@/lib/mime";
import { buildStoredName } from "@/lib/filename";
import { sniffAndRebuild } from "@/lib/stream";
import { ensureGuestFolder, uploadStreamToDrive } from "@/lib/drive";
import { duplicateResult } from "@/lib/idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El cuerpo puede ser grande: no queremos que Next intente parsearlo.
export const maxDuration = 300;

/**
 * POST /api/public/upload?slug=&t=&key=&name=&guest=
 * Cuerpo: bytes crudos de UNA imagen (application/octet-stream).
 *
 * Por qué cuerpo crudo y no multipart: el parseo multipart en Node
 * bufferiza cada parte en memoria. Enviando un archivo por petición como
 * stream crudo podemos reenviarlo a Drive SIN cargarlo entero en RAM,
 * que es el requisito para archivos grandes en Cloud Run. Cada archivo es
 * una petición independiente => reintentable de forma aislada.
 *
 * Idempotencia: la clave (key) evita duplicados si el cliente reintenta.
 */
const querySchema = z.object({
  slug: z.string().min(1).max(120),
  t: z.string().min(1).max(200),
  key: z.string().uuid(),
  name: z.string().min(1).max(255),
  guest: z.string().max(60).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = querySchema.safeParse({
    slug: req.nextUrl.searchParams.get("slug"),
    t: req.nextUrl.searchParams.get("t"),
    key: req.nextUrl.searchParams.get("key"),
    name: req.nextUrl.searchParams.get("name"),
    guest: req.nextUrl.searchParams.get("guest") ?? undefined,
  });
  if (!parsed.success) return jsonError("Parámetros inválidos", 400);
  const { slug, t, key, name, guest } = parsed.data;

  // 1) Autorización del evento (existe, token, activo, no caducado).
  const gate = await gatePublicEvent(slug, t);
  if (!gate.ok) return jsonError(gate.reason, gate.status);
  const event = gate.event!;

  // 2) Extensión declarada permitida.
  if (!isAllowedExtension(name)) {
    return jsonError("Tipo de archivo no permitido", 415);
  }

  // 3) Rate limit por IP anonimizada + evento.
  const ipHash = hashIp(getClientIp(req.headers));
  const rl = await checkRateLimit(event.id, ipHash);
  if (!rl.ok) {
    return jsonError("Demasiadas subidas. Inténtalo más tarde.", 429, {
      resetAt: rl.resetAt.toISOString(),
    });
  }

  // 4) Idempotencia: si ya está COMPLETED, devolvemos el resultado guardado.
  const existing = await prisma.upload.findUnique({
    where: { eventId_idempotencyKey: { eventId: event.id, idempotencyKey: key } },
  });
  const dup = duplicateResult(existing);
  if (dup) {
    return jsonOk({ ...dup });
  }

  if (!req.body) return jsonError("No se recibió contenido", 400);

  // 5) Registro base (crea si no existía por si /init no se llamó).
  const guestName = guest?.trim() || null;
  const record = await prisma.upload.upsert({
    where: { eventId_idempotencyKey: { eventId: event.id, idempotencyKey: key } },
    create: {
      eventId: event.id,
      idempotencyKey: key,
      originalName: name.slice(0, 255),
      guestName,
      ipHash,
      status: "UPLOADING",
    },
    update: { status: "UPLOADING", errorMessage: null, ipHash },
  });

  try {
    // 6) Streaming: leemos cabecera para validar MIME real, reconstruimos
    //    el stream y lo enviamos a Drive sin bufferizar el archivo completo.
    const { head, stream, done } = await sniffAndRebuild(req.body, {
      maxBytes: env.MAX_FILE_SIZE_BYTES,
      headLen: 32,
    });

    const realMime = sniffImageMime(head);
    if (!realMime || !isAllowedMime(realMime)) {
      // Cerramos el stream para no descargar el resto.
      stream.destroy();
      await prisma.upload.update({
        where: { id: record.id },
        data: { status: "FAILED", errorMessage: "Contenido no es una imagen admitida" },
      });
      return jsonError("El contenido no es una imagen admitida", 415);
    }

    // 7) Carpeta destino en Drive. Con scope drive.file la app crea y posee
    //    la carpeta raíz del evento (no se usa una carpeta pegada por el user).
    const { rootFolderId, guestsFolderId, targetFolderId } = await ensureGuestFolder(
      event.driveFolderId || null,
      event.driveGuestsFolderId,
      guestName,
      event.coupleName
    );
    if (!event.driveFolderId || !event.driveGuestsFolderId) {
      await prisma.event.update({
        where: { id: event.id },
        data: { driveFolderId: rootFolderId, driveGuestsFolderId: guestsFolderId },
      });
    }

    const storedName = buildStoredName({
      date: new Date(),
      guestName,
      originalName: name,
      mime: realMime,
    });

    // 8) Subida resumible por streaming.
    const { fileId } = await uploadStreamToDrive({
      parentFolderId: targetFolderId,
      name: storedName,
      mimeType: realMime,
      body: stream,
    });

    // 9) Espera a que el stream termine para conocer tamaño y hash reales,
    //    y valida de nuevo el límite (defensa en profundidad).
    const { size, sha256 } = await done;
    if (size > env.MAX_FILE_SIZE_BYTES) {
      throw new Error("MAX_SIZE_EXCEEDED");
    }

    const updated = await prisma.upload.update({
      where: { id: record.id },
      data: {
        storedName,
        mimeType: realMime,
        sizeBytes: size,
        sha256,
        driveFileId: fileId,
        status: "COMPLETED",
        errorMessage: null,
      },
    });

    return jsonOk({ status: "COMPLETED", driveFileId: fileId, sizeBytes: updated.sizeBytes });
  } catch (err) {
    const message =
      err instanceof Error && err.message === "MAX_SIZE_EXCEEDED"
        ? "El archivo supera el tamaño máximo permitido"
        : "Error al subir el archivo";
    // Log sin datos sensibles.
    const anyErr = err as { message?: string; stack?: string; response?: { data?: unknown }; errors?: unknown };
    console.error("upload_error", {
      eventId: event.id,
      key,
      message,
      detail: anyErr?.message,
      driveError: anyErr?.response?.data ? JSON.stringify(anyErr.response.data) : anyErr?.errors,
    });
    await prisma.upload
      .update({
        where: { id: record.id },
        data: { status: "FAILED", errorMessage: message },
      })
      .catch(() => {});
    return jsonError(message, message.includes("tamaño") ? 413 : 502);
  }
}
