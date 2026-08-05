/**
 * /api/v1/heygen/avatars — galeria importada da conta HeyGen do aluno.
 *
 * GET → grupos de foto-avatar PRÓPRIOS (include_public=false) + avatares
 * instant próprios. Só LEITURA na API do HeyGen (não gasta créditos).
 * Filtramos a biblioteca pública: a conta do Lucas devolve 1.310 avatares e
 * 6.815 fotos públicas — o aluno só quer ver os DELE.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { decryptApiKey } from "@/lib/heygen/crypto";
import { listAvatarGroups, friendlyHeygenError } from "@/lib/heygen/client";
import type { HeygenAccountRow } from "@/lib/db/types";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const { data } = await getAdmin()
    .from("heygen_accounts")
    .select("api_key_encrypted, status")
    .eq("user_id", auth.user_id)
    .maybeSingle();
  const row = data as Pick<HeygenAccountRow, "api_key_encrypted" | "status"> | null;
  if (!row || row.status !== "active") {
    return jsonOk({ connected: false, groups: [] });
  }

  try {
    const apiKey = decryptApiKey(row.api_key_encrypted);
    const groups = await listAvatarGroups(apiKey);
    return jsonOk({ connected: true, groups });
  } catch (e) {
    // key revogada/expirada no HeyGen → marca e orienta reconectar
    await getAdmin()
      .from("heygen_accounts")
      .update({ status: "invalid", updated_at: new Date().toISOString() })
      .eq("user_id", auth.user_id);
    return badRequest(friendlyHeygenError(e));
  }
}
