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
  createContainer,
  friendlyInstagramError,
  mediaPermalink,
  publishContainer,
  refreshLongLived,
  InstagramError,
} from "@/lib/social/instagram";
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

/** Token expirado/revogado → marca a conta e a publicação de uma vez. */
async function failForAuth(pub: PublicationRow, message: string): Promise<void> {
  await getAdmin()
    .from("social_accounts")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", pub.account_id);
  await patch(pub.id, { status: "failed", error: message });
}

/** ready → processing: cria o container no Instagram. */
export async function startPublication(pub: PublicationRow): Promise<void> {
  const account = await loadAccount(pub.account_id);
  if (!account || account.status !== "active") {
    await patch(pub.id, { status: "failed", error: "Conta do Instagram desconectada. Reconecte e tente de novo." });
    return;
  }
  try {
    const token = decryptToken(account.access_token_encrypted);
    const containerId = await createContainer(token, account.account_ref, {
      kind: pub.media_type,
      mediaUrl: await resolveMediaUrl(pub.media_url),
      caption: pub.caption,
    });
    await patch(pub.id, { status: "processing", container_id: containerId, attempts: pub.attempts + 1 });
  } catch (e) {
    if (e instanceof InstagramError && (e.status === 401 || e.code === 190)) {
      await failForAuth(pub, friendlyInstagramError(e));
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
    await patch(pub.id, { status: "failed", error: "Conta do Instagram não encontrada." });
    return;
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

  // 4. tokens ativos vencendo em <10 dias → refresh
  const soon = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
  const { data: expiring } = await admin
    .from("social_accounts")
    .select("*")
    .eq("status", "active")
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
