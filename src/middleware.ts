import { NextResponse, type NextRequest } from "next/server";
import { SECURITY_HEADERS } from "@/lib/security";

/**
 * Aplica cabeceras de seguridad a todas las respuestas.
 * No hace auth aquí (se hace en cada route handler con acceso a BD),
 * porque el middleware corre en el runtime Edge sin Prisma.
 */
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export const config = {
  matcher: [
    // Todo excepto estáticos de Next.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
