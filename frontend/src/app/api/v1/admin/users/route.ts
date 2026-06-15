/** GET /api/v1/admin/users → lista de usuários com stats + último login/visto. */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { jsonOk, serverError } from "@/lib/api/responses";
import { getUsers } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;
  try {
    return jsonOk({ users: await getUsers() });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to load users");
  }
}
