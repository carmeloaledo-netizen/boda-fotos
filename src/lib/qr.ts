import QRCode from "qrcode";

/**
 * Generación de códigos QR en PNG (buffer) y SVG (string).
 * El QR apunta SIEMPRE a la URL pública del evento (slug + token),
 * NUNCA a una carpeta de Drive.
 */

const QR_OPTIONS = {
  errorCorrectionLevel: "M" as const,
  margin: 2,
  scale: 10,
  color: {
    dark: "#2A2622",
    light: "#FBF8F3",
  },
};

export async function qrPngBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { ...QR_OPTIONS, type: "png" });
}

export async function qrSvgString(url: string): Promise<string> {
  return QRCode.toString(url, { ...QR_OPTIONS, type: "svg" });
}

/** Construye la URL pública canónica de un evento. */
export function buildPublicUrl(
  baseUrl: string,
  slug: string,
  token: string
): string {
  const clean = baseUrl.replace(/\/+$/, "");
  return `${clean}/e/${encodeURIComponent(slug)}?t=${encodeURIComponent(token)}`;
}
