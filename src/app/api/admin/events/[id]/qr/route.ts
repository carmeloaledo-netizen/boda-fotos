import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthenticated } from "@/lib/auth";
import { jsonError } from "@/lib/security";
import { qrPngBuffer, qrSvgString, buildPublicUrl } from "@/lib/qr";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/events/:id/qr?format=png|svg
 * Descarga el QR del enlace público del evento.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAuthenticated())) return jsonError("No autorizado", 401);

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return jsonError("Evento no encontrado", 404);

  const url = buildPublicUrl(env.APP_BASE_URL, event.slug, event.publicToken);
  const format = (req.nextUrl.searchParams.get("format") || "png").toLowerCase();

  if (format === "svg") {
    const svg = await qrSvgString(url);
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="qr-${event.slug}.svg"`,
      },
    });
  }

  const png = await qrPngBuffer(url);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${event.slug}.png"`,
    },
  });
}
