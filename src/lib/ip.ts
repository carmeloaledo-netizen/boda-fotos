import { createHash } from "node:crypto";
import { env } from "./env";

/**
 * Extrae la IP del cliente desde las cabeceras habituales de proxys
 * (Cloud Run, load balancers). Devuelve solo el primer salto.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return (
    headers.get("x-real-ip") ||
    headers.get("fly-client-ip") ||
    headers.get("cf-connecting-ip") ||
    "0.0.0.0"
  );
}

/**
 * Nunca se almacena la IP completa. Se guarda un hash con sal.
 * Truncamos a 16 hex para reducir aún más la reversibilidad.
 */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(env.IP_HASH_SALT + ":" + ip)
    .digest("hex")
    .slice(0, 32);
}
