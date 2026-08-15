import { destroySession } from "@/lib/auth";
import { jsonOk } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await destroySession();
  return jsonOk({});
}
