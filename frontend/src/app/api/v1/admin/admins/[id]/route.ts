/**
 * /api/v1/admin/admins/[id]
 *   DELETE → remove um e-mail da allowlist de admins.
 *
 * Restrito a admins. Bloqueia auto-remoção (evita lockout acidental).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, notFound, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  const { id } = await ctx.params;
  const admin = getAdmin();

  const { data: target } = await admin
    .from("admin_emails")
    .select("email")
    .eq("id", id)
    .maybeSingle();

  if (!target) return notFound("Admin");
  if (target.email === (g.auth.email ?? "").toLowerCase()) {
    return badRequest("Você não pode remover a si mesmo");
  }

  const { error } = await admin.from("admin_emails").delete().eq("id", id);
  if (error) return serverError("Failed to remove admin");
  return jsonOk({ removed: id });
}
