/**
 * Motor do publicador: inicia/avança publicações e faz a varredura (cron).
 *
 * Estados: ready (aguardando hora) → processing (container em voo no
 * Instagram) → published | failed. O sweeper roda pelo cron do Hetzner
 * (rota /api/v1/social/sweep) e também é chamado inline logo após criar
 * uma publicação imediata, pra dar resposta rápida na tela.
 */
import { getAdmin } from "@/lib/db/admin";
import { deleteKeys } from "@/lib/r2/delete";
import { createPresignedGet } from "@/lib/r2/presigned";
import { decryptToken, encryptToken } from "@/lib/social/crypto";
import {
  containerStatus,
  contentPublishingLimit,
  createContainer,
  friendlyInstagramError,
  mediaPermalink,
  publishContainer,
  refreshLongLived,
  InstagramError,
} from "@/lib/social/instagram";
import { advanceTikTokPublication, startTikTokPublication } from "@/lib/social/tiktok-publish";
import { DEFAULT_GRADUATION_STRATEGY } from "@/lib/social/trial-reel-pure";
import { hashLegenda, sha256DeUrl } from "@/lib/social/trial-conteudo";
import {
  COTA_META_RETRY_MS,
  decidirCotaMeta,
  decidirEnvioNormal,
  decidirEnvioTrial,
  decidirRetryTrial,
  resolverEspacamentoMs,
  type TrialAnterior,
} from "@/lib/social/trial-guardrails-pure";
import type { PublicationRow, SocialAccountRow } from "@/lib/db/types";

const MAX_ATTEMPTS = 3;

/**
 * media_url aceita URL https direta OU referência interna "r2://<bucket>/<key>"
 * (mídia gerada NA plataforma). A interna vira presigned GET na hora de criar
 * o container — assim post agendado nunca publica com assinatura vencida.
 */
export async function resolveMediaUrl(mediaUrl: string): Promise<string> {
  const m = mediaUrl.match(/^r2:\/\/([^/]+)\/(.+)$/);
  if (!m) return mediaUrl;
  return createPresignedGet(m[1], m[2], 3600);
}

async function loadAccount(accountId: string): Promise<SocialAccountRow | null> {
  const { data } = await getAdmin()
    .from("social_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();
  return (data as SocialAccountRow | null) ?? null;
}

async function patch(pubId: string, fields: Record<string, unknown>): Promise<void> {
  await getAdmin()
    .from("publications")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", pubId);
}

/**
 * Trials ANTERIORES da conta (últimos 30 dias), no formato do módulo puro de
 * guardrails. 30 dias limita o tamanho da consulta — dedupe além disso é
 * aceitável, as janelas das outras regras são de 24h. Exportado pra rota
 * /api/v1/social/publish fazer a checagem de cortesia com a MESMA fonte.
 */
export async function carregarTrialsAnteriores(
  accountId: string,
  excetoPubId?: string,
): Promise<TrialAnterior[]> {
  const desde = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  let query = getAdmin()
    .from("publications")
    .select("id, media_url, status, created_at, updated_at, platform_options")
    .eq("account_id", accountId)
    .eq("platform", "instagram")
    .eq("media_type", "reel")
    .eq("platform_options->>is_trial", "true")
    .gte("created_at", desde)
    .limit(500);
  if (excetoPubId) query = query.neq("id", excetoPubId);
  const { data } = await query;
  return ((data ?? []) as Array<{
    media_url: string;
    status: TrialAnterior["status"];
    created_at: string;
    updated_at: string;
    platform_options: Record<string, unknown> | null;
  }>).map((row) => ({
    mediaUrl: row.media_url,
    status: row.status,
    criadaEm: row.created_at,
    atualizadaEm: row.updated_at,
    enviadaEm: (row.platform_options?.trial_sent_at as string | undefined) ?? null,
    bloqueadaPorGuardrail: Boolean(row.platform_options?.guardrail_block),
    videoHash: (row.platform_options?.video_sha256 as string | undefined) ?? null,
    legendaHash: (row.platform_options?.caption_hash as string | undefined) ?? null,
  }));
}

/**
 * Envios NORMAIS (não-trial) anteriores da conta no Instagram — a fonte do
 * espaçamento de post normal. platform_options.sent_at (gravado no envio)
 * é a fonte; linha antiga sem sent_at usa created_at como proxy (permissivo
 * pra agendado antigo — erra pro lado de deixar passar, e some sozinho
 * conforme sent_at passa a existir nas linhas novas). Janela de 7 dias
 * cobre qualquer espaçamento configurável razoável.
 */
export async function carregarEnviosNormais(
  accountId: string,
  excetoPubId?: string,
): Promise<Array<string | null>> {
  const desde = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  let query = getAdmin()
    .from("publications")
    .select("id, status, created_at, platform_options")
    .eq("account_id", accountId)
    .eq("platform", "instagram")
    .in("status", ["processing", "published"])
    .gte("created_at", desde)
    .limit(200);
  if (excetoPubId) query = query.neq("id", excetoPubId);
  const { data } = await query;
  return ((data ?? []) as Array<{
    status: string;
    created_at: string;
    platform_options: Record<string, unknown> | null;
  }>)
    // trial fica fora: o espaçamento é POR TIPO (trial tem o dele, mais longo)
    .filter((row) => String(row.platform_options?.is_trial) !== "true")
    .map((row) => (row.platform_options?.sent_at as string | undefined) ?? row.created_at);
}

/** Token expirado/revogado → marca a conta e a publicação de uma vez. */
async function failForAuth(pub: PublicationRow, message: string): Promise<void> {
  await getAdmin()
    .from("social_accounts")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", pub.account_id);
  await patch(pub.id, { status: "failed", error: message });
}

/** ready → processing: cria o container (IG) ou faz init+upload (TikTok). */
export async function startPublication(pub: PublicationRow): Promise<void> {
  const account = await loadAccount(pub.account_id);
  if (!account || account.status !== "active") {
    await patch(pub.id, { status: "failed", error: "Conta desconectada. Reconecte e tente de novo." });
    return;
  }
  if (account.platform === "tiktok") {
    return startTikTokPublication(pub, account, await resolveMediaUrl(pub.media_url));
  }
  // Instagram: Trial Reel vem de platform_options ({is_trial,
  // graduation_strategy}), gravado na criação da publicação — o agendado
  // passa por aqui via sweeper com as mesmas opções. Só reel leva trial;
  // createContainer ainda tem a guarda final da estratégia.
  const opts = (pub.platform_options ?? {}) as {
    is_trial?: boolean;
    graduation_strategy?: string;
    trial_sent_at?: string;
    sent_at?: string;
    guardrail_block?: string;
    video_sha256?: string;
    caption_hash?: string;
  };
  const ehTrial = Boolean(opts.is_trial) && pub.media_type === "reel";
  // Trial: a URL é resolvida UMA vez e reaproveitada — primeiro pro hash do
  // dedupe (download único, em streaming), depois pro createContainer.
  let urlResolvida: string | null = null;
  let videoHash: string | null = null;
  let legendaHash: string | null = null;
  // GUARDRAILS dos Trial Reels — AQUI, no envio, é a checagem que VALE
  // (a rota só dá erro amigável na criação): agendado chega por este mesmo
  // caminho via sweeper. SÓ trial passa pela decisão — Reel normal segue
  // publicando mesmo com o breaker da conta aberto (regra 3).
  if (ehTrial) {
    const anteriores = await carregarTrialsAnteriores(pub.account_id, pub.id);
    urlResolvida = await resolveMediaUrl(pub.media_url);
    // sha256 do arquivo (regra 4a) — fail-open: null se o download falhar,
    // e o dedupe segue valendo por legenda e media_url.
    videoHash = await sha256DeUrl(urlResolvida);
    legendaHash = hashLegenda(pub.caption);
    const decisao = decidirEnvioTrial({
      agora: new Date().toISOString(),
      mediaUrl: pub.media_url,
      videoHash,
      legendaHash,
      anteriores,
      espacamentoMs: resolverEspacamentoMs("trial", process.env),
    });
    if (!decisao.permitido) {
      if (decisao.liberadoEm === null) {
        // Permanente (dedupe) → failed com motivo legível. guardrail_block
        // marca que a falha é NOSSA — não abre o circuit breaker da conta.
        await patch(pub.id, {
          status: "failed",
          error: decisao.erro,
          platform_options: { ...opts, guardrail_block: decisao.regra },
        });
      } else {
        // Transitório (breaker/limite/espaçamento) → NUNCA failed silencioso:
        // continua ready com o motivo em error, e scheduled_at = liberadoEm
        // faz o sweeper retomar sozinho na hora certa (a query do sweep é
        // lte(scheduled_at, now)).
        await patch(pub.id, {
          status: "ready",
          scheduled_at: decisao.liberadoEm,
          error: decisao.erro,
        });
      }
      return;
    }
  } else {
    // ESPAÇAMENTO DE POST NORMAL — comportamento NOVO em caminho que já está
    // em produção (antes o normal não tinha espaçamento nenhum): 1h por
    // padrão entre publicações não-trial da conta, configurável por env.
    // Bloqueio NUNCA é failed: continua ready com scheduled_at = liberadoEm
    // e o sweeper publica sozinho na hora certa.
    const decisaoNormal = decidirEnvioNormal({
      agora: new Date().toISOString(),
      enviosAnteriores: await carregarEnviosNormais(pub.account_id, pub.id),
      espacamentoMs: resolverEspacamentoMs("normal", process.env),
    });
    if (!decisaoNormal.permitido) {
      await patch(pub.id, {
        status: "ready",
        scheduled_at: decisaoNormal.liberadoEm,
        error: decisaoNormal.erro,
      });
      return;
    }
  }
  // COTA DA PRÓPRIA META — GET /{ig-user-id}/content_publishing_limit ANTES
  // do envio. SOMA com as regras locais acima (o nosso 6/dia do trial é mais
  // restritivo e continua valendo) — quem barrar primeiro manda. Se a
  // CONSULTA falhar (rede, token, 5xx), NÃO barra: instrumento quebrado não
  // pode derrubar a publicação — registra e segue com as regras locais.
  try {
    const cota = await contentPublishingLimit(
      decryptToken(account.access_token_encrypted),
      account.account_ref,
    );
    const decisaoCota = decidirCotaMeta(cota);
    if (!decisaoCota.permitido) {
      await patch(pub.id, {
        status: "ready",
        scheduled_at: new Date(Date.now() + COTA_META_RETRY_MS).toISOString(),
        error: decisaoCota.erro,
      });
      return;
    }
  } catch (e) {
    console.warn(
      "[social] consulta content_publishing_limit falhou; seguindo com as regras locais:",
      e,
    );
  }
  try {
    const token = decryptToken(account.access_token_encrypted);
    const containerId = await createContainer(token, account.account_ref, {
      kind: pub.media_type,
      // Trial já resolveu a URL pro hash do dedupe — reusa (presigned dura 1h).
      mediaUrl: urlResolvida ?? (await resolveMediaUrl(pub.media_url)),
      caption: pub.caption,
      trial: ehTrial
        ? { graduationStrategy: opts.graduation_strategy ?? DEFAULT_GRADUATION_STRATEGY }
        : null,
    });
    await patch(pub.id, {
      status: "processing",
      container_id: containerId,
      attempts: pub.attempts + 1,
      error: null,
      // sent_at é a fonte do espaçamento de post normal; trial_sent_at é a
      // fonte do limite diário e do espaçamento do trial; os hashes de
      // conteúdo (video_sha256/caption_hash) são a fonte do dedupe — tudo
      // gravado no MESMO patch que confirma o envio (módulo puro lê daqui).
      ...(ehTrial
        ? {
            platform_options: {
              ...opts,
              sent_at: new Date().toISOString(),
              trial_sent_at: new Date().toISOString(),
              ...(videoHash ? { video_sha256: videoHash } : {}),
              ...(legendaHash ? { caption_hash: legendaHash } : {}),
            },
          }
        : { platform_options: { ...opts, sent_at: new Date().toISOString() } }),
    });
  } catch (e) {
    if (e instanceof InstagramError && (e.status === 401 || e.code === 190)) {
      await failForAuth(pub, friendlyInstagramError(e));
      return;
    }
    if (ehTrial) {
      // Regra 5: trial só retenta em HTTP 429, com backoff exponencial.
      // Restrição de recurso (2207001/2207042/2207051 etc.) NUNCA retenta —
      // retentar restrição transforma aviso da Meta em bloqueio. O failed
      // resultante abre o circuit breaker (regra 3) na próxima decisão.
      const d = decidirRetryTrial({
        httpStatus: e instanceof InstagramError ? e.status : null,
        attempts: pub.attempts + 1,
      });
      if (d.retry) {
        const min = Math.round(d.backoffMs / 60000);
        await patch(pub.id, {
          status: "ready",
          attempts: pub.attempts + 1,
          scheduled_at: new Date(Date.now() + d.backoffMs).toISOString(),
          error: `O Instagram pediu uma pausa (429). Nova tentativa automática em ~${min} min.`,
        });
      } else {
        await patch(pub.id, {
          status: "failed",
          attempts: pub.attempts + 1,
          error: friendlyInstagramError(e),
        });
      }
      return;
    }
    const retry = pub.attempts + 1 < MAX_ATTEMPTS;
    await patch(pub.id, {
      status: retry ? "ready" : "failed",
      attempts: pub.attempts + 1,
      error: friendlyInstagramError(e),
    });
  }
}

/** processing → published/failed: poll do container e publish quando pronto. */
export async function advancePublication(pub: PublicationRow): Promise<void> {
  if (!pub.container_id) {
    await patch(pub.id, { status: "failed", error: "Publicação sem container (estado inconsistente)." });
    return;
  }
  const account = await loadAccount(pub.account_id);
  if (!account) {
    await patch(pub.id, { status: "failed", error: "Conta da rede social não encontrada." });
    return;
  }
  if (account.platform === "tiktok") {
    return advanceTikTokPublication(pub, account);
  }
  try {
    const token = decryptToken(account.access_token_encrypted);
    const { status, detail } = await containerStatus(token, pub.container_id);
    if (status === "IN_PROGRESS") return; // ainda processando — próximo sweep pega
    if (status === "FINISHED") {
      const postId = await publishContainer(token, account.account_ref, pub.container_id);
      // Permalink é cosmético (link no histórico) — falhou, publica sem ele.
      const permalink = await mediaPermalink(token, postId).catch(() => null);
      await patch(pub.id, { status: "published", platform_post_id: postId, permalink, error: null });
      return;
    }
    if (status === "PUBLISHED") {
      await patch(pub.id, { status: "published", error: null });
      return;
    }
    // ERROR | EXPIRED
    await patch(pub.id, {
      status: "failed",
      error: detail || "O Instagram recusou a mídia (verifique formato/duração do vídeo).",
    });
  } catch (e) {
    if (e instanceof InstagramError && (e.status === 401 || e.code === 190)) {
      await failForAuth(pub, friendlyInstagramError(e));
      return;
    }
    await patch(pub.id, { status: "failed", error: friendlyInstagramError(e) });
  }
}

/** Varredura: agendados que chegaram na hora + containers em voo + tokens a vencer. */
export async function sweepPublications(): Promise<{ started: number; advanced: number; refreshed: number }> {
  const admin = getAdmin();
  const nowIso = new Date().toISOString();
  const summary = { started: 0, advanced: 0, refreshed: 0 };

  // 1. ready cuja hora chegou (scheduled_at null nunca fica ready — publish imediato já inicia)
  const { data: due } = await admin
    .from("publications")
    .select("*")
    .eq("status", "ready")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(10);
  for (const pub of (due ?? []) as PublicationRow[]) {
    await startPublication(pub);
    summary.started++;
  }

  // 2. processing (container em voo)
  const { data: inFlight } = await admin
    .from("publications")
    .select("*")
    .eq("status", "processing")
    .order("updated_at", { ascending: true })
    .limit(20);
  for (const pub of (inFlight ?? []) as PublicationRow[]) {
    await advancePublication(pub);
    summary.advanced++;
  }

  // 3. uploads do computador (social-uploads/) com desfecho final há 7+ dias →
  //    apaga do R2 e marca (r2-cleaned://) pra não reprocessar.
  const cleanupCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: stale } = await admin
    .from("publications")
    .select("id, media_url")
    .in("status", ["published", "failed"])
    .like("media_url", "r2://%/social-uploads/%")
    .lt("updated_at", cleanupCutoff)
    .limit(20);
  for (const pub of (stale ?? []) as Array<{ id: string; media_url: string }>) {
    const m = pub.media_url.match(/^r2:\/\/([^/]+)\/(.+)$/);
    if (m) {
      try {
        await deleteKeys(m[1], [m[2]]);
      } catch {
        continue; // R2 fora do ar → tenta no próximo sweep
      }
    }
    await patch(pub.id, { media_url: pub.media_url.replace("r2://", "r2-cleaned://") });
  }

  // 4. tokens IG ativos vencendo em <10 dias → refresh. (TikTok renova
  //    on-demand a cada uso — o access dura só 24h, não entra aqui.)
  const soon = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
  const { data: expiring } = await admin
    .from("social_accounts")
    .select("*")
    .eq("status", "active")
    .eq("platform", "instagram")
    .lte("token_expires_at", soon)
    .limit(20);
  for (const account of (expiring ?? []) as SocialAccountRow[]) {
    try {
      const fresh = await refreshLongLived(decryptToken(account.access_token_encrypted));
      await admin
        .from("social_accounts")
        .update({
          access_token_encrypted: encryptToken(fresh.accessToken),
          token_expires_at: fresh.expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id);
      summary.refreshed++;
    } catch {
      // vencido de vez → aluno reconecta (a UI mostra o estado)
      await admin
        .from("social_accounts")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", account.id);
    }
  }
  return summary;
}
