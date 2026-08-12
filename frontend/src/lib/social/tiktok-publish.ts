/**
 * Publicação no TikTok (Direct Post por FILE_UPLOAD) — chamado pelo motor
 * genérico do publicador (publisher.ts) quando a conta é platform=tiktok.
 * container_id guarda o publish_id do TikTok (mesmo papel do container IG).
 */
import { getAdmin } from "@/lib/db/admin";
import { decryptToken, encryptToken } from "@/lib/social/crypto";
import {
  friendlyTikTokError,
  initDirectPost,
  publishStatus,
  refreshTokens,
  uploadVideo,
  TikTokError,
} from "@/lib/social/tiktok";
import type { PublicationRow, SocialAccountRow } from "@/lib/db/types";

async function patch(pubId: string, fields: Record<string, unknown>): Promise<void> {
  await getAdmin()
    .from("publications")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", pubId);
}

async function markAuthFailure(pub: PublicationRow, message: string): Promise<void> {
  await getAdmin()
    .from("social_accounts")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", pub.account_id);
  await patch(pub.id, { status: "failed", error: message });
}

/** Access token do TikTok dura 24h — renova on-demand quando falta <10min. */
export async function freshAccessToken(account: SocialAccountRow): Promise<string> {
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 10 * 60 * 1000) {
    return decryptToken(account.access_token_encrypted);
  }
  if (!account.refresh_token_encrypted) throw new TikTokError("sem refresh token", 401);
  const fresh = await refreshTokens(decryptToken(account.refresh_token_encrypted));
  await getAdmin()
    .from("social_accounts")
    .update({
      access_token_encrypted: encryptToken(fresh.accessToken),
      refresh_token_encrypted: encryptToken(fresh.refreshToken),
      token_expires_at: fresh.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);
  return fresh.accessToken;
}

function isAuthError(e: unknown): boolean {
  return e instanceof TikTokError && (e.status === 401 || e.code === "access_token_invalid");
}

/** ready → processing: baixa o MP4 do R2 e sobe pro TikTok (init + upload). */
export async function startTikTokPublication(
  pub: PublicationRow,
  account: SocialAccountRow,
  mediaUrl: string,
): Promise<void> {
  try {
    const token = await freshAccessToken(account);
    const res = await fetch(mediaUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`mídia inacessível (HTTP ${res.status})`);
    const video = Buffer.from(await res.arrayBuffer());

    const opts = (pub.platform_options ?? {}) as {
      privacy_level?: string;
      disable_comment?: boolean;
      brand_content?: boolean;
      brand_organic?: boolean;
    };
    const { publishId, uploadUrl } = await initDirectPost(token, video.length, {
      title: pub.caption ?? "",
      // Sandbox/não-auditado: TikTok só aceita SELF_ONLY — é o default seguro.
      privacyLevel: opts.privacy_level ?? "SELF_ONLY",
      disableComment: opts.disable_comment,
      brandContent: opts.brand_content,
      brandOrganic: opts.brand_organic,
    });
    await uploadVideo(uploadUrl, video);
    await patch(pub.id, { status: "processing", container_id: publishId, attempts: pub.attempts + 1 });
  } catch (e) {
    if (isAuthError(e)) return markAuthFailure(pub, friendlyTikTokError(e));
    const retry = pub.attempts + 1 < 3;
    await patch(pub.id, {
      status: retry ? "ready" : "failed",
      attempts: pub.attempts + 1,
      error: friendlyTikTokError(e),
    });
  }
}

/** processing → published/failed: poll do publish_id. */
export async function advanceTikTokPublication(
  pub: PublicationRow,
  account: SocialAccountRow,
): Promise<void> {
  if (!pub.container_id) {
    return patch(pub.id, { status: "failed", error: "Publicação sem publish_id (estado inconsistente)." });
  }
  try {
    const token = await freshAccessToken(account);
    const st = await publishStatus(token, pub.container_id);
    if (st.status === "PUBLISH_COMPLETE" || st.status === "SEND_TO_USER_INBOX") {
      const postId = st.publicaly_available_post_id?.[0];
      await patch(pub.id, {
        status: "published",
        platform_post_id: postId ? String(postId) : null,
        error: null,
      });
      return;
    }
    if (st.status === "FAILED") {
      await patch(pub.id, { status: "failed", error: st.fail_reason ?? "O TikTok recusou o vídeo." });
      return;
    }
    // PROCESSING_* → próximo sweep pega
  } catch (e) {
    if (isAuthError(e)) return markAuthFailure(pub, friendlyTikTokError(e));
    await patch(pub.id, { status: "failed", error: friendlyTikTokError(e) });
  }
}
