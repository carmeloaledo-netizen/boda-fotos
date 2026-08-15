import { NextResponse } from "next/server";

/**
 * Cabeceras de seguridad y CSP razonable aplicadas globalmente
 * (ver middleware.ts). La CSP permite estilos inline de Tailwind y las
 * imágenes de portada externas (https). Sin analítica ni terceros.
 */
export const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  // Next inyecta algunos scripts; en producción conviene endurecer con nonce.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // Portadas/logos pueden venir de https externos elegidos por el fotógrafo.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "off",
};

/** Respuesta JSON de error sin filtrar detalles internos. */
export function jsonError(
  message: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function jsonOk(
  data: Record<string, unknown>,
  status = 200
): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status });
}
