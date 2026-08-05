/**
 * Cliente da Instagram API com Instagram Login (app Meta "FastCloner",
 * IG app FastCloner-IG). O aluno loga com a conta PROFISSIONAL do Instagram
 * dele (sem Facebook) e autoriza publicar.
 *
 * Fluxo de token: code → short-lived (1h) → long-lived (~60d) → refresh
 * (ig_refresh_token) antes de vencer — o sweeper renova com folga (<10d).
 * Publicação (container flow): create media → poll status até FINISHED →
 * media_publish. Vídeo SEMPRE com moov no início (ffmpeg +faststart) —
 * lição paga do WF_P5.
 *
 * Server-only; tokens nunca chegam ao client.
 */

const OAUTH_HOST = "https://www.instagram.com";
const API_HOST = "https://api.instagram.com";
const GRAPH_HOST = "https://graph.instagram.com";
const GRAPH_VERSION = "v23.0";
const TIMEOUT_MS = 30_000;

export const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;

export class InstagramError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
  }
}

function appId(): string {
  const v = process.env.INSTAGRAM_APP_ID;
  if (!v) throw new Error("INSTAGRAM_APP_ID ausente");
  return v;
}
function appSecret(): string {
  const v = process.env.INSTAGRAM_APP_SECRET;
  if (!v) throw new Error("INSTAGRAM_APP_SECRET ausente");
  return v;
}
export function redirectUri(): string {
  const v = process.env.INSTAGRAM_REDIRECT_URI;
  if (!v) throw new Error("INSTAGRAM_REDIRECT_URI ausente");
  return v;
}

async function graphCall<T>(path: string, init?: RequestInit & { host?: string }): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${init?.host ?? GRAPH_HOST}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; error_subcode?: number };
      error_message?: string;
    };
    if (!res.ok || json.error) {
      throw new InstagramError(
        json.error?.message ?? json.error_message ?? `Instagram ${res.status}`,
        res.status,
        json.error?.code,
        json.error?.error_subcode,
      );
    }
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

// ───────── OAuth (conectar conta) ─────────

/** URL de autorização pro aluno logar com o Instagram dele. */
export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: IG_SCOPES.join(","),
    state,
  });
  return `${OAUTH_HOST}/oauth/authorize?${params}`;
}

/** Troca o code do callback pelo token short-lived (1h). */
export async function exchangeCode(code: string): Promise<{ accessToken: string; igUserId: string }> {
  const body = new URLSearchParams({
    client_id: appId(),
    client_secret: appSecret(),
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
  });
  const data = await graphCall<{ access_token: string; user_id: string | number }>(
    "/oauth/access_token",
    { host: API_HOST, method: "POST", body },
  );
  return { accessToken: data.access_token, igUserId: String(data.user_id) };
}

/** Troca short-lived por long-lived (~60 dias). */
export async function toLongLived(shortToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret(),
    access_token: shortToken,
  });
  const data = await graphCall<{ access_token: string; expires_in: number }>(
    `/access_token?${params}`,
  );
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** Renova um long-lived (precisa ter ≥24h de vida e não estar vencido). */
export async function refreshLongLived(token: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token });
  const data = await graphCall<{ access_token: string; expires_in: number }>(
    `/refresh_access_token?${params}`,
  );
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** Perfil da conta conectada (valida o token de quebra). */
export async function getProfile(token: string): Promise<{ igUserId: string; username: string }> {
  const params = new URLSearchParams({ fields: "user_id,username", access_token: token });
  const data = await graphCall<{ user_id: string | number; username: string; id: string }>(
    `/${GRAPH_VERSION}/me?${params}`,
  );
  return { igUserId: String(data.user_id ?? data.id), username: data.username };
}

// ───────── publicação (container flow) ─────────

export type IgMediaKind = "reel" | "image" | "story";

/** Cria o container de mídia. Reel/story de vídeo processam async (poll). */
export async function createContainer(
  token: string,
  igUserId: string,
  input: { kind: IgMediaKind; mediaUrl: string; caption?: string | null },
): Promise<string> {
  const params = new URLSearchParams({ access_token: token });
  if (input.kind === "image") {
    params.set("image_url", input.mediaUrl);
  } else {
    params.set("media_type", input.kind === "story" ? "STORIES" : "REELS");
    params.set("video_url", input.mediaUrl);
  }
  if (input.caption && input.kind !== "story") params.set("caption", input.caption);
  const data = await graphCall<{ id: string }>(`/${GRAPH_VERSION}/${igUserId}/media`, {
    method: "POST",
    body: params,
  });
  return data.id;
}

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";

export async function containerStatus(
  token: string,
  containerId: string,
): Promise<{ status: ContainerStatus; detail?: string }> {
  const params = new URLSearchParams({ fields: "status_code,status", access_token: token });
  const data = await graphCall<{ status_code: ContainerStatus; status?: string }>(
    `/${GRAPH_VERSION}/${containerId}?${params}`,
  );
  return { status: data.status_code, detail: data.status };
}

/** Publica o container FINISHED. Devolve o id do post no Instagram. */
export async function publishContainer(
  token: string,
  igUserId: string,
  containerId: string,
): Promise<string> {
  const params = new URLSearchParams({ access_token: token, creation_id: containerId });
  const data = await graphCall<{ id: string }>(`/${GRAPH_VERSION}/${igUserId}/media_publish`, {
    method: "POST",
    body: params,
  });
  return data.id;
}

// ───────── erros amigáveis (mapa validado no Postiz) ─────────

export function friendlyInstagramError(e: unknown): string {
  if (!(e instanceof InstagramError)) {
    return "Não foi possível falar com o Instagram agora. Tente de novo em instantes.";
  }
  switch (e.subcode) {
    case 2207001:
      return "O Instagram suspeitou de automação neste post. Espere um pouco e tente de novo.";
    case 2207010:
      return "A legenda passou de 2.200 caracteres. Encurte e tente de novo.";
    case 2207042:
      return "Limite do Instagram atingido: 25 publicações por dia nesta conta. Tente amanhã.";
    case 2207051:
      return "O Instagram bloqueou esta publicação por suspeita de spam.";
  }
  if (e.status === 401 || e.code === 190) {
    return "A conexão com o Instagram expirou. Reconecte a conta e tente de novo.";
  }
  return e.message;
}
