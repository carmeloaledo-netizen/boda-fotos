import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardMutation } from "@/lib/admin-guard";
import { purgeExpiredSessions } from "@/lib/auth";
import { purgeOldRateLimits } from "@/lib/ratelimit";
import { jsonOk } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/maintenance
 * Limpieza: registros de subidas incompletas antiguas (PENDING/UPLOADING),
 * sesiones caducadas y entradas de rate limit viejas.
 * Puede llamarse manualmente desde el panel o desde un cron (Cloud Scheduler).
 */
export async function POST(req: NextRequest) {
  const denied = await guardMutation(req.headers);
  if (denied) return denied;

  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24); // 24h

  const [incomplete, sessions, rl] = await Promise.all([
    prisma.upload.deleteMany({
      where: {
        status: { in: ["PENDING", "UPLOADING"] },
        updatedAt: { lt: cutoff },
      },
    }),
    purgeExpiredSessions(),
    purgeOldRateLimits(),
  ]);

  return jsonOk({
    purgedIncompleteUploads: incomplete.count,
    purgedSessions: sessions,
    purgedRateLimits: rl,
  });
}
