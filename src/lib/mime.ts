/**
 * Tipos de imagen admitidos en esta primera versión.
 * Validamos SIEMPRE tanto la extensión declarada como el MIME real
 * (por firma de bytes). Nunca confiamos solo en el nombre.
 */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

export const ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
] as const;

/** ¿Es un MIME de imagen admitido? */
export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

/** ¿La extensión declarada está permitida? */
export function isAllowedExtension(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Detecta el MIME real leyendo la firma (magic bytes) de las primeras
 * partes del archivo. HEIC/HEIF se detectan por el box "ftyp" del ISO-BMFF.
 * Recibimos un buffer con al menos los primeros ~32 bytes.
 */
export function sniffImageMime(head: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47
  ) {
    return "image/png";
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }
  // HEIC/HEIF: ISO-BMFF con box "ftyp" y marca de compatibilidad.
  // bytes 4..8 = "ftyp"; luego un major brand como "heic","heix","mif1","heim","hevc".
  if (
    head[4] === 0x66 &&
    head[5] === 0x74 &&
    head[6] === 0x79 &&
    head[7] === 0x70
  ) {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    const heifBrands = ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"];
    if (heifBrands.includes(brand)) {
      // "mif1" puede ser HEIF genérico.
      return brand === "mif1" || brand === "msf1" ? "image/heif" : "image/heic";
    }
  }
  return null;
}
