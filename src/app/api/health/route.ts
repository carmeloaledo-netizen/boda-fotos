import { jsonOk } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Health check para Cloud Run / balanceadores. */
export async function GET() {
  return jsonOk({ status: "ok", ts: new Date().toISOString() });
}
