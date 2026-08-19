/**
 * GET /api/v1/images/ref-default
 *
 * Referência FIXA do estúdio definida no SERVIDOR (profiles.image_ref_key —
 * hoje só o onboarding via planilha escreve). O estúdio usa como fallback
 * quando o localStorage está vazio (primeiro login do aluno DFY: a foto
 * importada da planilha já aparece como referência do clone).
 *
 * Devolve { key, url } ou { key: null } se não há referência/objeto sumiu.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";
import { adotarReferencia, ehReferenciaSalva } from "@/lib/images/refs";
import { objectExists } from "@/lib/r2/exists";
import { createPresignedGet } from "@/lib/r2/presigned";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const admin = getAdmin();
  const { data: prof } = await admin
    .from("profiles")
    .select("image_ref_key")
    .eq("id", auth.user_id)
    .maybeSingle();

  const key = (prof?.image_ref_key as string | null)?.trim() || null;
  if (!key || !key.startsWith(`${auth.user_id}/`)) return jsonOk({ key: null });

  // Foto apagada do acervo → limpa a referência morta e devolve vazio.
  if (!(await objectExists(imagesBucket(), key))) {
    await admin.from("profiles").update({ image_ref_key: null }).eq("id", auth.user_id);
    return jsonOk({ key: null });
  }

  // Migração por adoção (19/08): chave que ainda mora na pasta de uma geração
  // morre quando aquela geração for apagada do histórico. Copia pra `refs/` e
  // regrava o profile — cada aluno migra sozinho no primeiro acesso.
  let entregue = key;
  if (!ehReferenciaSalva(auth.user_id, key)) {
    try {
      entregue = await adotarReferencia(auth.user_id, key);
      await admin.from("profiles").update({ image_ref_key: entregue }).eq("id", auth.user_id);
    } catch {
      entregue = key; // adoção falhou: entrega a original — melhor que nada
    }
  }

  const url = await createPresignedGet(imagesBucket(), entregue, 3600).catch(() => null);
  if (!url) return jsonOk({ key: null });
  return jsonOk({ key: entregue, url });
}
