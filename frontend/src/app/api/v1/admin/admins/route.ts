/**
 * /api/v1/admin/admins
 *   GET  → lista a allowlist de admins
 *   POST → adiciona um e-mail { email } à allowlist
 *
 * Restrito a admins (gateAdmin). A allowlist mora em public.admin_emails.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  const { data, error } = await getAdmin()
    .from("admin_emails")
    .select("id, email, added_by, created_at")
    .order("created_at", { ascending: true });

  if (error) return serverError("Failed to list admins");
  return jsonOk({ admins: data ?? [] });
}

export async function POST(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return badRequest("E-mail inválido");

  const { data, error } = await getAdmin()
    .from("admin_emails")
    .insert({ email, added_by: g.auth.email })
    .select("id, email, added_by, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return badRequest("Esse e-mail já é admin");
    return serverError("Failed to add admin");
  }
  return jsonOk({ admin: data }, 201);
}
