/**
 * GET /api/v1/agent/status — estado da conexão do WhatsApp do suporte
 * (instância Evolution). Desconectado → inclui o QR code (base64) pro admin
 * escanear em Aparelhos conectados. Admin-only.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { jsonOk } from "@/lib/api/responses";
import { connectionState, instanceLabel, qrCode } from "@/lib/agent/provider";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  const state = await connectionState();
  const qr = state === "open" ? null : await qrCode();
  return jsonOk({ instance: instanceLabel(), state, qr });
}
