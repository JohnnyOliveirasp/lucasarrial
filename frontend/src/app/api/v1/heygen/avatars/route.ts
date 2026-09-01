/**
 * /api/v1/heygen/avatars — galeria importada da conta HeyGen do aluno.
 *
 * GET  → grupos de foto-avatar PRÓPRIOS (include_public=false), agora COM os
 *        looks de cada grupo (feedback Lucas 11/08). Só LEITURA (não gasta).
 *        Filtramos a biblioteca pública: a conta do Lucas devolve 1.310
 *        avatares e 6.815 fotos públicas — o aluno só quer ver os DELE.
 * POST → cria um foto-avatar (clone) NA CONTA HEYGEN do aluno a partir de uma
 *        imagem gerada na plataforma. Pedido do Lucas (11/08).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { decryptApiKey } from "@/lib/heygen/crypto";
import {
  createPhotoAvatarGroup,
  friendlyHeygenError,
  listAvatarGroups,
  listGroupLooks,
  uploadImageAsset,
} from "@/lib/heygen/client";
import {
  contentTypeImagemHeygen,
  erroImagemNaoSuportada,
} from "@/lib/heygen/imagem-content-type";
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
    // Looks de cada grupo (feedback Lucas 11/08: a tela só mostrava a capa e
    // nada era clicável). Busca em paralelo, teto de 12 grupos — é conta de
    // aluno, não a biblioteca pública.
    const withLooks = await Promise.all(
      groups.slice(0, 12).map(async (g) => ({
        ...g,
        looks: await listGroupLooks(apiKey, g.id).catch(() => []),
      })),
    );
    return jsonOk({ connected: true, groups: withLooks });
  } catch (e) {
    // key revogada/expirada no HeyGen → marca e orienta reconectar
    await getAdmin()
      .from("heygen_accounts")
      .update({ status: "invalid", updated_at: new Date().toISOString() })
      .eq("user_id", auth.user_id);
    return badRequest(friendlyHeygenError(e));
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { image_generation_id?: string; name?: string } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!body.image_generation_id) return badRequest("Escolha uma imagem da plataforma");
  const name = (body.name ?? "").trim().slice(0, 60) || "FastCloner Avatar";

  const { data } = await getAdmin()
    .from("heygen_accounts")
    .select("api_key_encrypted, status")
    .eq("user_id", auth.user_id)
    .maybeSingle();
  const acc = data as Pick<HeygenAccountRow, "api_key_encrypted" | "status"> | null;
  if (!acc || acc.status !== "active") return badRequest("Conecte sua conta HeyGen primeiro");

  // Imagem da plataforma (mesma checagem de dono/estado da rota de vídeos)
  const { data: imgData } = await getAdmin()
    .from("image_generations")
    .select("image_path, status, user_id")
    .eq("id", body.image_generation_id)
    .maybeSingle();
  const img = imgData as { image_path: string | null; status: string; user_id: string } | null;
  if (!img || img.user_id !== auth.user_id || img.status !== "ready" || !img.image_path) {
    return badRequest("Imagem não encontrada");
  }

  try {
    const apiKey = decryptApiKey(acc.api_key_encrypted);
    const url = await createPresignedGet(imagesBucket(), img.image_path, 600);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return badRequest("Não foi possível ler a imagem");
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = contentTypeImagemHeygen(bytes);
    if (!ct) return badRequest(erroImagemNaoSuportada(bytes, "plataforma"));
    const { image_key } = await uploadImageAsset(apiKey, bytes, ct);
    const { group_id } = await createPhotoAvatarGroup(apiKey, { name, image_key });
    return jsonOk({ group_id, name }, 201);
  } catch (e) {
    return badRequest(friendlyHeygenError(e));
  }
}
