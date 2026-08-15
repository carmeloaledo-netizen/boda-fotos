/**
 * Idempotencia de subidas: si ya existe un registro COMPLETED con
 * driveFileId para la misma (eventId, idempotencyKey), la subida no debe
 * repetirse; se devuelve el resultado previo.
 *
 * Se extrae como función pura para poder testearla de forma aislada.
 * Se define un tipo local mínimo para no acoplar a los tipos generados.
 */
export interface ExistingUploadLike {
  status: string;
  driveFileId: string | null;
}

export interface DuplicateResult {
  status: "COMPLETED";
  driveFileId: string;
  duplicated: true;
}

export function duplicateResult(
  existing: ExistingUploadLike | null | undefined
): DuplicateResult | null {
  if (existing && existing.status === "COMPLETED" && existing.driveFileId) {
    return {
      status: "COMPLETED",
      driveFileId: existing.driveFileId,
      duplicated: true,
    };
  }
  return null;
}
