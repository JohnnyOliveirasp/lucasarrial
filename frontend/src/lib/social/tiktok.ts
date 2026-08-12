/**
 * Cliente da API do TikTok (Login Kit + Content Posting API, Direct Post).
 * Mesmo desenho do lib/social/instagram.ts. Docs: developers.tiktok.com.
 * Sandbox (app não auditado): posts saem SELF_ONLY e só contas Target Users.
 */

export const TIKTOK_SCOPES = ["user.info.basic", "video.publish", "video.upload"];

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const API = "https://open.tiktokapis.com/v2";

export class TikTokError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export function friendlyTikTokError(e: unknown): string {
  if (e instanceof TikTokError) {
    if (e.status === 401 || e.code === "access_token_invalid")
      return "A conexão com o TikTok expirou. Reconecte a conta.";
    if (e.code === "spam_risk_too_many_posts")
      return "O TikTok limitou a quantidade de posts da conta por hoje. Tente amanhã.";
    if (e.code === "reached_active_user_cap")
      return "Limite diário de usuários do app (fase de testes do TikTok). Tente amanhã.";
    return `TikTok recusou: ${e.message}`;
  }
  return "Falha ao falar com o TikTok. Tente de novo em instantes.";
}

function clientKey(): string {
  const k = process.env.TIKTOK_CLIENT_KEY;
  if (!k) throw new Error("TIKTOK_CLIENT_KEY ausente");
  return k;
}

export function redirectUri(): string {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fastcloner.com";
  return `${origin}/api/v1/social/tiktok/callback`;
}

export function authorizeUrl(state: string): string {
  const u = new URL(AUTH_URL);
  u.searchParams.set("client_key", clientKey());
  u.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("state", state);
  return u.toString();
}

type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  openId: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey(),
      client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
      ...params,
    }),
    cache: "no-store",
  });
  const j = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !j.access_token || !j.refresh_token) {
    throw new TikTokError(j.error_description ?? j.error ?? `HTTP ${res.status}`, res.status, j.error);
  }
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: new Date(Date.now() + (j.expires_in ?? 86400) * 1000),
    openId: j.open_id ?? "",
  };
}

export function exchangeCode(code: string): Promise<TokenSet> {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
}

export function refreshTokens(refreshToken: string): Promise<TokenSet> {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

/** POST autenticado; a API do TikTok devolve { data, error:{code,message} } SEMPRE. */
async function apiPost<T>(token: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as {
    data?: T;
    error?: { code?: string; message?: string };
  };
  const errCode = j.error?.code;
  if (!res.ok || (errCode && errCode !== "ok")) {
    throw new TikTokError(j.error?.message ?? `HTTP ${res.status}`, res.status, errCode);
  }
  return (j.data ?? {}) as T;
}

export async function getProfile(
  token: string,
): Promise<{ openId: string; displayName: string }> {
  const res = await fetch(`${API}/user/info/?fields=open_id,display_name,avatar_url`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as {
    data?: { user?: { open_id?: string; display_name?: string } };
    error?: { code?: string; message?: string };
  };
  const user = j.data?.user;
  if (!res.ok || !user?.open_id) {
    throw new TikTokError(j.error?.message ?? `HTTP ${res.status}`, res.status, j.error?.code);
  }
  return { openId: user.open_id, displayName: user.display_name ?? "" };
}

/** Opções do criador (a UI de publicar DEVE oferecer exatamente isso — auditoria). */
export type CreatorInfo = {
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
};

export function creatorInfo(token: string): Promise<CreatorInfo> {
  return apiPost<CreatorInfo>(token, "/post/publish/creator_info/query/");
}

export type DirectPostOptions = {
  title: string;
  privacyLevel: string; // um de creatorInfo().privacy_level_options
  disableComment?: boolean;
  brandContent?: boolean; // publi de terceiros
  brandOrganic?: boolean; // promove o próprio negócio
};

/** Inicia o Direct Post por FILE_UPLOAD (chunk único: nossos reels são <64MB). */
export async function initDirectPost(
  token: string,
  videoSize: number,
  opts: DirectPostOptions,
): Promise<{ publishId: string; uploadUrl: string }> {
  const d = await apiPost<{ publish_id?: string; upload_url?: string }>(
    token,
    "/post/publish/video/init/",
    {
      post_info: {
        title: opts.title.slice(0, 2200),
        privacy_level: opts.privacyLevel,
        disable_comment: opts.disableComment ?? false,
        disable_duet: false,
        disable_stitch: false,
        brand_content_toggle: opts.brandContent ?? false,
        brand_organic_toggle: opts.brandOrganic ?? false,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    },
  );
  if (!d.publish_id || !d.upload_url) throw new TikTokError("init sem publish_id/upload_url", 500);
  return { publishId: d.publish_id, uploadUrl: d.upload_url };
}

/** Sobe o MP4 inteiro (chunk único) pra upload_url do init. */
export async function uploadVideo(uploadUrl: string, video: Buffer): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(video.length),
      "Content-Range": `bytes 0-${video.length - 1}/${video.length}`,
    },
    body: new Uint8Array(video),
  });
  if (!res.ok) throw new TikTokError(`upload falhou (HTTP ${res.status})`, res.status);
}

export type PublishStatus = {
  status: "PROCESSING_UPLOAD" | "PROCESSING_DOWNLOAD" | "SEND_TO_USER_INBOX" | "PUBLISH_COMPLETE" | "FAILED";
  fail_reason?: string;
  publicaly_available_post_id?: number[];
};

export function publishStatus(token: string, publishId: string): Promise<PublishStatus> {
  return apiPost<PublishStatus>(token, "/post/publish/status/fetch/", { publish_id: publishId });
}
