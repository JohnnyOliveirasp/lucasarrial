/**
 * POST /api/v1/onboarding/import
 *
 * Webhook do onboarding via planilha (Apps Script → aqui). Recebe uma linha
 * "Recebido" da planilha DFY e faz o serviço completo:
 *   1. Cria a conta do aluno (email+senha da planilha, e-mail já confirmado).
 *      Conta nasce ZERO créditos e travada — estado padrão de não-assinante.
 *   2. Importa as fotos do Drive pro acervo (1 vira referência do clone).
 *   3. Importa os áudios do Drive pra área de treino (SEM disparar treino).
 *
 * Segurança: header X-Onboarding-Secret contra ONBOARDING_WEBHOOK_SECRET,
 * comparação em tempo constante (mesmo padrão do webhook Hotmart).
 *
 * Idempotente de ponta a ponta: reprocessar a mesma linha não duplica conta,
 * foto nem áudio (chaves R2 determinísticas por fileId do Drive).
 *
 * Payload (Apps Script):
 *   { email, password, name?, whatsapp?, images?: string[], audios?: string[], row? }
 *   images/audios = fileIds do Drive já tornados "qualquer um com link – leitor".
 */
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { importImages, importTrainingAudios } from "@/lib/onboarding/import";

export const maxDuration = 300; // áudios de treino podem ser grandes

type Body = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
  whatsapp?: unknown;
  images?: unknown;
  audios?: unknown;
  row?: unknown;
};

function validSecret(header: string | null): boolean {
  const expected = process.env.ONBOARDING_WEBHOOK_SECRET;
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Aceita array de fileIds (strings) e ignora lixo. */
function asFileIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => /^[a-zA-Z0-9_-]{10,}$/.test(x));
}

/**
 * Garante o usuário no Auth. Retorna { userId, created }.
 * Conta já existente (profile OU auth órfão) → reusa, não mexe na senha.
 */
async function ensureUser(
  admin: ReturnType<typeof getAdmin>,
  email: string,
  password: string,
  name: string | null,
  whatsapp: string | null,
): Promise<{ userId: string; created: boolean }> {
  const { data: prof } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (prof?.id) return { userId: prof.id as string, created: false };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...(name ? { full_name: name } : {}),
      ...(whatsapp ? { whatsapp } : {}),
      onboarding_source: "planilha",
    },
  });
  if (!error && data.user) return { userId: data.user.id, created: true };

  // Auth já tem o e-mail mas o profile sumiu/nunca existiu → acha pelo scan
  // (mesmo recurso do /api/v1/generations pra listar usuários).
  const msg = (error?.message ?? "").toLowerCase();
  if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
    for (let page = 1; page <= 5; page++) {
      const { data: batch } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const hit = batch?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
      if (hit) return { userId: hit.id, created: false };
      if (!batch || batch.users.length < 1000) break;
    }
  }
  throw new Error(`createUser falhou: ${error?.message ?? "sem detalhe"}`);
}

export async function POST(request: NextRequest) {
  if (!validSecret(request.headers.get("x-onboarding-secret"))) return unauthorized();

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return badRequest("JSON inválido");
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() || null : null;
  const whatsapp = typeof body.whatsapp === "string" ? body.whatsapp.trim() || null : null;
  const images = asFileIds(body.images);
  const audios = asFileIds(body.audios);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("E-mail inválido");
  if (password.length < 6) return badRequest("Senha precisa de 6+ caracteres");

  const admin = getAdmin();

  let userId: string;
  let created: boolean;
  try {
    ({ userId, created } = await ensureUser(admin, email, password, name, whatsapp));
  } catch (e) {
    console.error("[onboarding/import] conta:", e instanceof Error ? e.message : e);
    return serverError(e instanceof Error ? e.message : "Falha ao criar a conta");
  }

  // O trigger handle_new_user cria o profile no signup, mas não recria se
  // faltar (mesma blindagem do auth/callback). Best-effort.
  await admin
    .from("profiles")
    .upsert(
      { id: userId, email, display_name: name },
      { onConflict: "id", ignoreDuplicates: true },
    );

  const imagesResult = await importImages(admin, userId, images).catch((e) => {
    console.error("[onboarding/import] imagens:", e instanceof Error ? e.message : e);
    return { imported: 0, skipped: 0, failed: images.map((id) => ({ id, error: "falha geral" })), reference_key: null };
  });

  let audiosResult;
  try {
    audiosResult = await importTrainingAudios(admin, userId, audios);
  } catch (e) {
    console.error("[onboarding/import] áudios:", e instanceof Error ? e.message : e);
    audiosResult = {
      imported: 0,
      skipped: 0,
      failed: audios.map((id) => ({ id, error: "falha geral" })),
      voice_id: null,
      voice_status: null,
    };
  }

  // "ok" = nada falhou → Apps Script marca Realizado; qualquer falha parcial →
  // Erro na planilha com o detalhe (a idempotência deixa re-tentar de graça).
  const ok = imagesResult.failed.length === 0 && audiosResult.failed.length === 0;

  return jsonOk({
    ok,
    user: { id: userId, created },
    images: imagesResult,
    audios: audiosResult,
    row: typeof body.row === "number" ? body.row : null,
  });
}
