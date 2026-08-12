/**
 * /api/v1/social/publish — cria uma publicação (o "jeito Blotato").
 *   POST {account_id, media_url, caption?, media_type?, scheduled_at?}
 *   - sem scheduled_at → inicia AGORA (container no Instagram) e o sweeper
 *     conclui o publish quando o processamento terminar;
 *   - com scheduled_at futuro → fica ready e o sweeper dispara na hora.
 *   GET → lista as publicações do usuário (a tela do Lab faz poll aqui).
 *
 * Auth: cookie OU X-API-Key (a Máquina de vídeo vai postar por aqui).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, forbidden, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { socialPublisherEnabled } from "@/lib/social/access";
import { resolvePublishSource, type PublishSource } from "@/lib/social/media-sources";
import { resolveMediaUrl, startPublication } from "@/lib/social/publisher";
import type { PublicationRow } from "@/lib/db/types";

const CAPTION_MAX = 2200; // limite do Instagram (erro 2207010)
const KINDS = new Set(["reel", "image", "story"]);

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  if (!(await socialPublisherEnabled(auth.user_id))) return forbidden();

  let body: {
    account_id?: string;
    media_url?: string;
    source?: { kind: string; id?: string; key?: string; media_type?: string };
    caption?: string;
    media_type?: string;
    scheduled_at?: string;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const accountId = (body.account_id ?? "").trim();
  if (!accountId) return badRequest("Escolha a conta do Instagram");

  // Mídia da PLATAFORMA (imagem gerada) ou UPLOAD do computador: o client manda
  // a referência; o servidor valida a posse e resolve o r2://… (assinado na
  // hora de publicar). media_url https crua fica pra API interna/Máquina.
  let mediaUrl: string;
  let mediaType = (body.media_type ?? "reel").trim();
  if (body.source) {
    const src = body.source;
    // Kinds referenciados por id (o resolvedor valida a posse na tabela).
    const ID_KINDS = new Set(["image", "clone-padrao", "clone-heygen", "cenas"]);
    const parsed: PublishSource | null = ID_KINDS.has(src.kind)
      ? { kind: src.kind as "image" | "clone-padrao" | "clone-heygen" | "cenas", id: String(src.id ?? "") }
      : src.kind === "edicao"
        ? { kind: "edicao", key: String(src.key ?? "") }
        : src.kind === "upload"
          ? {
              kind: "upload",
              key: String(src.key ?? ""),
              media_type: KINDS.has(String(src.media_type))
                ? (String(src.media_type) as "image" | "reel" | "story")
                : undefined,
            }
          : null;
    if (!parsed) return badRequest("source.kind não suportado");
    const resolved = await resolvePublishSource(auth.user_id, parsed);
    if ("error" in resolved) return badRequest(resolved.error);
    mediaUrl = resolved.mediaUrl;
    if (!body.media_type) mediaType = resolved.mediaType;
  } else {
    mediaUrl = (body.media_url ?? "").trim();
    if (!/^https:\/\//.test(mediaUrl)) {
      return badRequest("media_url precisa ser uma URL https pública");
    }
  }
  const caption = (body.caption ?? "").trim() || null;
  if (!KINDS.has(mediaType)) return badRequest("media_type deve ser reel, image ou story");
  if (caption && caption.length > CAPTION_MAX) {
    return badRequest(`A legenda passou de ${CAPTION_MAX} caracteres (limite do Instagram)`);
  }
  let scheduledAt: string | null = null;
  if (body.scheduled_at) {
    const when = new Date(body.scheduled_at);
    if (Number.isNaN(when.getTime())) return badRequest("scheduled_at inválido");
    if (when.getTime() > Date.now() + 60_000) scheduledAt = when.toISOString();
  }

  const admin = getAdmin();
  const { data: account } = await admin
    .from("social_accounts")
    .select("id, status")
    .eq("id", accountId)
    .eq("user_id", auth.user_id)
    .maybeSingle();
  if (!account) return badRequest("Conta do Instagram não encontrada");
  if (account.status !== "active") {
    return badRequest("A conexão com o Instagram expirou. Reconecte a conta.");
  }

  const { data: created, error } = await admin
    .from("publications")
    .insert({
      user_id: auth.user_id,
      account_id: accountId,
      platform: "instagram",
      media_type: mediaType as PublicationRow["media_type"],
      media_url: mediaUrl,
      caption,
      scheduled_at: scheduledAt,
      status: "ready",
    })
    .select("*")
    .single();
  if (error || !created) return serverError("Não foi possível criar a publicação");

  const pub = created as PublicationRow;
  // Imediata → já cria o container; o sweeper (cron) conclui o publish.
  if (!scheduledAt) await startPublication(pub);

  const { data: fresh } = await admin
    .from("publications")
    .select("id, status, scheduled_at, error")
    .eq("id", pub.id)
    .single();
  return jsonOk({ publication: fresh ?? { id: pub.id, status: pub.status } }, 201);
}

/**
 * DELETE ?id= — cancela uma publicação AGENDADA que ainda não foi enviada
 * (status ready + scheduled_at marcado). Publicação imediata não cancela:
 * o container no Instagram já foi criado.
 */
export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const id = (request.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) return badRequest("id ausente");
  const { data, error } = await getAdmin()
    .from("publications")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .eq("status", "ready")
    .not("scheduled_at", "is", null)
    .select("id");
  if (error) return serverError("Não foi possível cancelar a publicação");
  if ((data ?? []).length === 0) {
    return badRequest("Só publicações agendadas (ainda não enviadas) podem ser canceladas");
  }
  return jsonOk({ canceled: id });
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { data } = await getAdmin()
    .from("publications")
    .select(
      "id, account_id, platform, media_type, media_url, caption, scheduled_at, status, platform_post_id, permalink, error, created_at",
    )
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false })
    .limit(30);
  // Miniatura do histórico: imagem r2://… vira presigned GET (1h); https direto
  // passa como está; vídeo e mídia já limpa (r2-cleaned://) ficam sem thumb.
  const rows = await Promise.all(
    ((data ?? []) as Array<{ media_type: string; media_url: string }>).map(async (p) => ({
      ...p,
      thumb_url:
        p.media_type === "image" && !p.media_url.startsWith("r2-cleaned://")
          ? await resolveMediaUrl(p.media_url).catch(() => null)
          : null,
    })),
  );
  return jsonOk({ publications: rows });
}
