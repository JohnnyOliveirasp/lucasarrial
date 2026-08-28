/**
 * Cliente da API do HeyGen (BYOK — cada aluno usa a PRÓPRIA key).
 *
 * Leitura (quota, avatares, foto-avatares): usada na conexão e na galeria.
 * Geração (av4): consome créditos DA CONTA DO ALUNO — o app avisa antes.
 * ⚠️ Em desenvolvimento, a key do Lucas é SÓ LEITURA (regra Johnny 05/08):
 * nunca chamar generate com ela; smokes de geração são executados pelo Lucas.
 *
 * Preço de referência (Help Center oficial, verificado 05/08): Avatar IV =
 * $4/min de vídeo 1080p; créditos de API pay-as-you-go ($1 = 1 crédito).
 * Server-only.
 */

import type { ContentTypeHeygen } from "./imagem-content-type.ts";

const API = "https://api.heygen.com";
const UPLOAD = "https://upload.heygen.com";
const TIMEOUT_MS = 30_000;

export class HeygenError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function call<T>(
  apiKey: string,
  path: string,
  init?: RequestInit & { base?: string },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${init?.base ?? API}${path}`, {
      ...init,
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
        ...(init?.body && !(init.body instanceof Uint8Array)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init?.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string } | string | null;
      data?: unknown;
      message?: string;
    };
    if (!res.ok || (json.error && json.error !== null)) {
      const err = json.error;
      const msg =
        (typeof err === "object" && err?.message) ||
        (typeof err === "string" && err) ||
        json.message ||
        `HeyGen ${res.status}`;
      const code = typeof err === "object" ? err?.code : undefined;
      throw new HeygenError(String(msg), res.status, code);
    }
    return (json.data ?? json) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ───────── leitura (conexão + galeria) ─────────

/** Valida a key e devolve a quota de API restante. Lança HeygenError(401) se inválida. */
export async function getRemainingQuota(apiKey: string): Promise<{ credits: number }> {
  const data = await call<{ remaining_quota?: number; details?: unknown }>(
    apiKey,
    "/v2/user/remaining_quota",
  );
  // remaining_quota vem em "unidades" internas (60 ≈ 1 crédito/minuto standard)
  const raw = typeof data.remaining_quota === "number" ? data.remaining_quota : 0;
  return { credits: raw / 60 };
}

export type HeygenAvatar = {
  id: string;
  name: string;
  kind: "avatar" | "talking_photo";
  preview_url: string | null;
};

/** Avatares "normais" + talking photos (foto-avatares) da conta do aluno. */
export async function listAvatars(apiKey: string): Promise<HeygenAvatar[]> {
  const data = await call<{
    avatars?: { avatar_id: string; avatar_name?: string; preview_image_url?: string }[];
    talking_photos?: { talking_photo_id: string; talking_photo_name?: string; preview_image_url?: string }[];
  }>(apiKey, "/v2/avatars");
  const out: HeygenAvatar[] = [];
  for (const a of data.avatars ?? []) {
    out.push({
      id: a.avatar_id,
      name: a.avatar_name || a.avatar_id,
      kind: "avatar",
      preview_url: a.preview_image_url ?? null,
    });
  }
  for (const t of data.talking_photos ?? []) {
    out.push({
      id: t.talking_photo_id,
      name: t.talking_photo_name || t.talking_photo_id,
      kind: "talking_photo",
      preview_url: t.preview_image_url ?? null,
    });
  }
  return out;
}

export type HeygenAvatarGroup = { id: string; name: string; preview_url: string | null; num_looks: number };

/** Grupos de foto-avatar (cada grupo = uma "pessoa" com N looks). */
export async function listAvatarGroups(apiKey: string): Promise<HeygenAvatarGroup[]> {
  const data = await call<{
    avatar_group_list?: { id: string; name?: string; preview_image?: string; num_looks?: number }[];
  }>(apiKey, "/v2/avatar_group.list?include_public=false");
  return (data.avatar_group_list ?? []).map((g) => ({
    id: g.id,
    name: g.name || g.id,
    preview_url: g.preview_image ?? null,
    num_looks: g.num_looks ?? 0,
  }));
}

export type HeygenLook = { id: string; name: string; image_url: string | null };

/**
 * Looks (fotos) DENTRO de um grupo de foto-avatar. Feedback do Lucas (11/08):
 * a tela mostrava só a capa de cada grupo e nada era clicável — pra gerar o
 * Avatar IV com uma foto do HeyGen é preciso listar os looks um a um.
 */
export async function listGroupLooks(apiKey: string, groupId: string): Promise<HeygenLook[]> {
  const data = await call<{
    avatar_list?: {
      id: string;
      name?: string;
      image_url?: string;
      preview_image_url?: string;
      motion_preview_url?: string;
    }[];
  }>(apiKey, `/v2/avatar_group/${encodeURIComponent(groupId)}/avatars`);
  return (data.avatar_list ?? []).map((l) => ({
    id: l.id,
    name: l.name || l.id,
    image_url: l.image_url ?? l.preview_image_url ?? null,
  }));
}

// ───────── escrita (conta do ALUNO; consome créditos DELE) ─────────

/**
 * Sobe uma imagem e devolve o image_key exigido pelo av4/generate.
 *
 * ⚠️ O HeyGen CONFERE o content-type contra os bytes e recusa a divergência
 * ("Content type not match image/jpeg != image/webp", 28/08). Quem chama tem
 * que passar o tipo VERDADEIRO — use `contentTypeImagemHeygen(bytes)`, nunca
 * o header da resposta nem a extensão da chave.
 */
export async function uploadImageAsset(
  apiKey: string,
  bytes: Uint8Array,
  contentType: ContentTypeHeygen,
): Promise<{ image_key: string }> {
  const data = await call<{ image_key?: string; url?: string }>(apiKey, "/v1/asset", {
    base: UPLOAD,
    method: "POST",
    // Node 18: Uint8Array é aceito pelo fetch/undici; o lib.dom do TS não sabe.
    body: bytes as unknown as BodyInit,
    headers: { "Content-Type": contentType },
  });
  if (!data.image_key) throw new HeygenError("upload sem image_key", 500);
  return { image_key: data.image_key };
}

/**
 * Cria um GRUPO de foto-avatar (o "clone" do HeyGen) a partir de uma imagem já
 * subida como asset. Pedido do Lucas (11/08): criar o clone HeyGen com a imagem
 * gerada na plataforma, sem sair da tela.
 */
export async function createPhotoAvatarGroup(
  apiKey: string,
  args: { name: string; image_key: string },
): Promise<{ group_id: string }> {
  const data = await call<{ id?: string; group_id?: string }>(
    apiKey,
    "/v2/photo_avatar/avatar_group/create",
    {
      method: "POST",
      body: JSON.stringify({ name: args.name, image_key: args.image_key }),
    },
  );
  const id = data.group_id ?? data.id;
  if (!id) throw new HeygenError("create avatar_group sem id", 500);
  return { group_id: id };
}

/** Gera vídeo Avatar IV a partir de foto + áudio (URL pública/presigned). */
export async function generateAvatarIV(
  apiKey: string,
  args: {
    image_key: string;
    audio_url: string;
    title?: string;
    /** guia gestos/expressões (opcional; campo oficial do av4) */
    custom_motion_prompt?: string;
  },
): Promise<{ video_id: string }> {
  const data = await call<{ video_id?: string }>(apiKey, "/v2/video/av4/generate", {
    method: "POST",
    body: JSON.stringify({
      image_key: args.image_key,
      audio_url: args.audio_url,
      title: args.title ?? "FastCloner",
      ...(args.custom_motion_prompt
        ? { custom_motion_prompt: args.custom_motion_prompt }
        : {}),
    }),
  });
  if (!data.video_id) throw new HeygenError("generate sem video_id", 500);
  return { video_id: data.video_id };
}

export type HeygenVideoStatus = {
  status: "pending" | "processing" | "completed" | "failed";
  video_url: string | null;
  error: string | null;
};

export async function getVideoStatus(apiKey: string, videoId: string): Promise<HeygenVideoStatus> {
  const data = await call<{
    status?: string;
    video_url?: string;
    error?: { message?: string } | null;
  }>(apiKey, `/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`);
  const s = (data.status ?? "pending").toLowerCase();
  return {
    status: (["pending", "processing", "completed", "failed"].includes(s) ? s : "processing") as HeygenVideoStatus["status"],
    video_url: data.video_url ?? null,
    error: data.error?.message ?? null,
  };
}

/** Erros da API traduzidos pra mensagem que o aluno entende. */
export function friendlyHeygenError(e: unknown): string {
  if (e instanceof HeygenError) {
    if (e.status === 401 || e.status === 403) {
      return "Sua chave do HeyGen não foi aceita. Confira em Settings → Subscriptions & API e conecte de novo.";
    }
    if (/quota|credit|insufficient/i.test(e.message)) {
      return "Sua conta HeyGen está sem créditos de API. Recarregue lá e tente de novo.";
    }
    return `O HeyGen recusou a operação: ${e.message}`;
  }
  return "Não foi possível falar com o HeyGen agora. Tente de novo em instantes.";
}
