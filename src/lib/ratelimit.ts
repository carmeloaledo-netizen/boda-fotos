import { prisma } from "./prisma";
import { env } from "./env";

/**
 * Rate limiting por ventana fija, persistido en PostgreSQL.
 * Clave = "<eventId>:<ipHash>". Evita que una IP sature un evento.
 *
 * Para muy alta concurrencia conviene migrar a Redis/Memorystore, pero
 * para el volumen de una boda la BD es suficiente y no añade dependencias.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

export async function checkRateLimit(
  eventId: string,
  ipHash: string
): Promise<RateLimitResult> {
  const limit = env.RATE_LIMIT_MAX;
  const windowSec = env.RATE_LIMIT_WINDOW_SEC;

  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSec * 1000)) * windowSec * 1000);
  const resetAt = new Date(windowStart.getTime() + windowSec * 1000);
  const key = `${eventId}:${ipHash}`;

  // upsert atómico + incremento.
  const entry = await prisma.rateLimitEntry.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });

  const ok = entry.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - entry.count),
    limit,
    resetAt,
  };
}

/** Limpia entradas de ventanas antiguas (mantenimiento). */
export async function purgeOldRateLimits(): Promise<number> {
  const cutoff = new Date(Date.now() - env.RATE_LIMIT_WINDOW_SEC * 1000 * 4);
  const res = await prisma.rateLimitEntry.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return res.count;
}
