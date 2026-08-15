import { type NextRequest } from "next/server";
import { gatePublicEvent } from "@/lib/events";
import { uploadInitSchema } from "@/lib/validation";
import { jsonError, jsonOk } from "@/lib/security";
import { isAllowedExtension } from "@/lib/mime";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getClientIp, hashIp } from "@/lib/ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/public/upload/init
 * Registra la intención de subir un lote de archivos. Crea (de forma
 * idempotente) un registro Upload PENDING por cada archivo. Valida
 * consentimiento, límites, extensión y estado del evento.
 *
 * NO recibe binarios: solo metadatos JSON. Los bytes van en /upload.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Cuerpo JSON inválido", 400);
  }

  const parsed = uploadInitSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Datos inválidos", 400, {
      issues: parsed.error.issues.map((i) => i.message),
    });
  }
  const input = parsed.data;

  const gate = await gatePublicEvent(input.slug, input.token);
  if (!gate.ok) return jsonError(gate.reason, gate.status);
  const event = gate.event!;

  if (input.files.length > env.MAX_FILES_PER_BATCH) {
    return jsonError(
      `Máximo ${env.MAX_FILES_PER_BATCH} fotografías por tanda`,
      400
    );
  }

  // Validaciones por archivo (extensión + tamaño declarado).
  for (const f of input.files) {
    if (!isAllowedExtension(f.originalName)) {
      return jsonError(`Tipo de archivo no permitido: ${f.originalName}`, 415);
    }
    if (f.sizeBytes > env.MAX_FILE_SIZE_BYTES) {
      return jsonError(
        `El archivo ${f.originalName} supera el tamaño máximo`,
        413
      );
    }
  }

  // Nota: el rate limiting real (por archivo) se aplica en /upload, que es
  // donde se transfieren los bytes. Aquí solo anonimizamos la IP.
  const ipHash = hashIp(getClientIp(req.headers));

  const guestName = input.guestName?.trim() || null;

  // Crea registros idempotentes. Si la clave ya existe, se conserva.
  await Promise.all(
    input.files.map((f) =>
      prisma.upload.upsert({
        where: {
          eventId_idempotencyKey: {
            eventId: event.id,
            idempotencyKey: f.idempotencyKey,
          },
        },
        create: {
          eventId: event.id,
          idempotencyKey: f.idempotencyKey,
          originalName: f.originalName.slice(0, 255),
          sizeBytes: f.sizeBytes,
          guestName,
          ipHash,
          status: "PENDING",
        },
        update: {}, // idempotente: no pisamos un registro existente
      })
    )
  );

  return jsonOk({ acceptedCount: input.files.length });
}
