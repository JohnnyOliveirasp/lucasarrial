/**
 * GET /api/v1/credits/balance → saldo de créditos do usuário logado.
 * Usado pelo polling do PurchaseAutoRefresh (atualizar a tela quando a compra
 * cai, sem F5). Autenticação por cookie de sessão ou x-api-key.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, unauthorized } from "@/lib/api/responses";
import { getBalance } from "@/lib/credits/service";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const balance = await getBalance(auth.user_id);
  return jsonOk({ balance });
}
