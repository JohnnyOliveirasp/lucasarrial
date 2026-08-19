/**
 * /api/v1/images/refs — as "Referências salvas" do estúdio de imagem.
 *
 *   GET    → lista a aba (chave + URL de 1h, mais novas primeiro)
 *   POST   → ADOTA uma foto: copia pra `refs/` e devolve a chave nova.
 *            É o passo que desacopla a referência do histórico — ver
 *            lib/images/refs.ts pro caso que motivou (19/08).
 *   DELETE → ?key= apaga uma referência salva. Se ela era a referência do
 *            servidor (profiles.image_ref_key), limpa junto — senão o
 *            ref-default devolveria uma chave morta no próximo login.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import {
  adotarReferencia,
  apagarReferencia,
  listarReferencias,
} from "@/lib/images/refs";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  try {
    return jsonOk({ refs: await listarReferencias(auth.user_id) });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao listar referências");
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  let body: { key?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!key) return badRequest("Faltou a chave da foto.");
  try {
    const nova = await adotarReferencia(auth.user_id, key);
    const url = await createPresignedGet(imagesBucket(), nova, 3600);
    return jsonOk({ key: nova, url });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Não foi possível salvar a referência.");
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const key = (request.nextUrl.searchParams.get("key") ?? "").trim();
  if (!key) return badRequest("Faltou a chave.");
  try {
    await apagarReferencia(auth.user_id, key);
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Não foi possível apagar.");
  }
  // Referência do servidor apontando pra ela? Limpa, senão vira chave morta.
  const admin = getAdmin();
  const { data } = await admin
    .from("profiles")
    .select("image_ref_key")
    .eq("id", auth.user_id)
    .maybeSingle();
  if ((data?.image_ref_key as string | null) === key) {
    await admin.from("profiles").update({ image_ref_key: null }).eq("id", auth.user_id);
  }
  return jsonOk({ apagada: key });
}
