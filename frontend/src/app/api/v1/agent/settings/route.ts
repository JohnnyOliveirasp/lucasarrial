/**
 * /api/v1/agent/settings — interruptor GERAL da Mary (F2). Admin-only.
 *   GET   → { enabled }
 *   PATCH → { enabled: boolean } (desligada = admins atendem na mão)
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;
  const { data } = await getAdmin().from("agent_settings").select("enabled").eq("id", 1).maybeSingle();
  return jsonOk({ enabled: (data as { enabled?: boolean } | null)?.enabled !== false });
}

export async function PATCH(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  let body: { enabled?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  if (typeof body.enabled !== "boolean") return badRequest("'enabled' precisa ser boolean");

  const { error } = await getAdmin()
    .from("agent_settings")
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() } as never)
    .eq("id", 1);
  if (error) return serverError("Failed to update agent settings");
  return jsonOk({ enabled: body.enabled });
}
