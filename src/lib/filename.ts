import { randomUUID } from "node:crypto";

/**
 * Utilidades de saneado y generación de nombres de archivo.
 * Protege contra path traversal, caracteres de control y colisiones.
 */

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Convierte texto a un slug seguro para nombres de archivo. */
export function slugifySegment(input: string, fallback = "sin-nombre"): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // quita acentos combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || fallback;
}

/**
 * Sanea el nombre ORIGINAL para conservarlo de forma segura en el nombre
 * final. Elimina rutas, caracteres de control y limita longitud.
 */
export function sanitizeOriginalName(name: string): string {
  // Quita cualquier componente de ruta (../, /, \).
  const base = name.split(/[\\/]/).pop() || "archivo";
  const noControl = base.replace(/[\x00-\x1f\x7f]/g, "");
  const dot = noControl.lastIndexOf(".");
  const stem = dot > 0 ? noControl.slice(0, dot) : noControl;
  const ext = dot > 0 ? noControl.slice(dot + 1) : "";
  const safeStem = slugifySegment(stem, "archivo").slice(0, 60);
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 5);
  return safeExt ? `${safeStem}.${safeExt}` : safeStem;
}

/** Extensión canónica a partir del MIME real detectado. */
export function extForMime(mime: string): string | null {
  return EXT_BY_MIME[mime] ?? null;
}

/**
 * Genera el nombre final de almacenamiento con el esquema:
 *   AAAAMMDD_HHMMSS_nombre-invitado_uuid_nombre-original.ext
 * Evita colisiones gracias al UUID. Usa la extensión del MIME real.
 */
export function buildStoredName(params: {
  date: Date;
  guestName?: string | null;
  originalName: string;
  mime: string;
}): string {
  const { date, guestName, originalName, mime } = params;

  const y = date.getUTCFullYear().toString().padStart(4, "0");
  const mo = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  const h = date.getUTCHours().toString().padStart(2, "0");
  const mi = date.getUTCMinutes().toString().padStart(2, "0");
  const s = date.getUTCSeconds().toString().padStart(2, "0");
  const stamp = `${y}${mo}${d}_${h}${mi}${s}`;

  const guest = slugifySegment(guestName || "", "sin-nombre");
  const uuid = randomUUID();

  const safeOriginal = sanitizeOriginalName(originalName);
  const canonicalExt = extForMime(mime);

  // El cuerpo del original sin su extensión, para no duplicar la extensión.
  const dot = safeOriginal.lastIndexOf(".");
  const originalStem = dot > 0 ? safeOriginal.slice(0, dot) : safeOriginal;

  const ext = canonicalExt ?? (dot > 0 ? safeOriginal.slice(dot + 1) : "bin");

  return `${stamp}_${guest}_${uuid}_${originalStem}.${ext}`;
}
