/**
 * Vídeo Estúdio F5 — gate de créditos compartilhado pelas rotas do Estúdio.
 * Regra da casa: CRÉDITO é o único gate (equipe/admin não paga). Server-only.
 */
import type { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance } from "@/lib/credits/service";

export type StudioGate =
  | { ok: true; billed: boolean }
  | { ok: false; deny: NextResponse };

/**
 * Verifica se o usuário pode pagar `cost`. Devolve `billed=false` pra quem
 * bypassa cobrança; `deny` (402 com details do PaywallModal) se faltar saldo.
 */
export async function gateStudioCredits(args: {
  userId: string;
  email: string | null;
  cost: number;
  /** Fim da frase "Créditos insuficientes: <action> custa X..." */
  action: string;
}): Promise<StudioGate> {
  if (bypassesBilling(args.email)) return { ok: true, billed: false };
  if (args.cost <= 0) return { ok: true, billed: true };

  const bal = await getBalance(args.userId);
  if (bal.total >= args.cost) return { ok: true, billed: true };

  const { data: prof } = await getAdmin()
    .from("profiles")
    .select("access_until")
    .eq("id", args.userId)
    .maybeSingle();
  const subscribed = hasActiveAccess(args.email, (prof as { access_until?: string | null } | null)?.access_until ?? null);
  return {
    ok: false,
    deny: jsonError(
      "insufficient_credits",
      `Créditos insuficientes: ${args.action} custa ${args.cost.toLocaleString("pt-BR")} e você tem ${bal.total.toLocaleString("pt-BR")}.`,
      402,
      { subscribed, balance: bal.total, cost: args.cost },
    ),
  };
}
