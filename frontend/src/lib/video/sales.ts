/**
 * Helpers server-only das rotas de IA do Vídeo Vendas TikTok.
 * Concentra: carregar o projeto sales do dono + gate de crédito (15cr por ação
 * de IA; admin/equipe não paga; cobra SÓ no sucesso — padrão das varinhas).
 */
import type { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { getBalance, debitCredits } from "@/lib/credits/service";
import { SALES_AI_COST } from "@/lib/video/config";

export type SalesProject = {
  id: string;
  status: string;
  script_text: string | null;
  product_image_paths: string[] | null;
  product_price: string | null;
  product_link: string | null;
  product_description: string | null;
  product_analysis: string | null;
  reference_image_paths: string[] | null;
};

/** Projeto sales do próprio usuário (ou null). */
export async function loadSalesProject(id: string, userId: string): Promise<SalesProject | null> {
  const { data } = await getAdmin()
    .from("video_projects")
    .select(
      "id, status, script_text, product_image_paths, product_price, product_link, product_description, product_analysis, reference_image_paths",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .eq("kind", "sales")
    .maybeSingle();
  return (data as SalesProject | null) ?? null;
}

/**
 * Pré-checa saldo pra uma ação de IA (15cr). Devolve `billed` (se cobra) ou a
 * resposta 402 pronta. O débito em si acontece DEPOIS do sucesso via
 * `chargeSalesAI` — LLM falhou = ninguém paga.
 */
export async function gateSalesAI(auth: {
  user_id: string;
  email: string | null;
}): Promise<{ billed: boolean; deny: NextResponse | null }> {
  const billed = !bypassesBilling(auth.email);
  if (!billed) return { billed, deny: null };

  const bal = await getBalance(auth.user_id);
  if (bal.total >= SALES_AI_COST) return { billed, deny: null };

  const { data: prof } = await getAdmin()
    .from("profiles")
    .select("access_until")
    .eq("id", auth.user_id)
    .maybeSingle();
  const subscribed = hasActiveAccess(auth.email, prof?.access_until ?? null);
  return {
    billed,
    deny: jsonError(
      "insufficient_credits",
      `Créditos insuficientes: esta ação custa ${SALES_AI_COST} e você tem ${bal.total}.`,
      402,
      { subscribed, balance: bal.total, cost: SALES_AI_COST },
    ),
  };
}

/** Debita os 15cr da ação (chamar SÓ após o sucesso da IA). */
export async function chargeSalesAI(userId: string, projectId: string, note: string): Promise<void> {
  await debitCredits({
    userId,
    amount: SALES_AI_COST,
    kind: "video",
    refType: "video_project",
    refId: projectId,
    note,
  });
}
