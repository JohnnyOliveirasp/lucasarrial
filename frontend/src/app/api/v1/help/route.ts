/**
 * Mary no app — balão de ajuda da plataforma.
 *   GET  → histórico do chat do usuário logado (últimas 50)
 *   POST → { text, pathname?, image?: { data(base64), media_type } } → resposta da Mary
 *
 * Mesmo cérebro do WhatsApp (manual + Sonnet + visão), mas identidade vem do
 * LOGIN (sem telefone): o contexto da conta é sempre o do próprio usuário.
 * Escalação [ESCALAR/-TECNICO] → e-mail pra equipe (WhatsApp está pausado).
 * Rate-limit por usuário/dia (HELP_RATE_LIMIT_PER_DAY, default 60).
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonError, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { buildAgentReply, type AgentImage } from "@/lib/agent/brain";
import { buildAccountContext } from "@/lib/agent/account";
import { extractEscalation } from "@/lib/agent/escalate";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";
import type { AgentMessageRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 40;
const TEXT_MAX = 2000;
const RATE_LIMIT_PER_DAY = Number(process.env.HELP_RATE_LIMIT_PER_DAY ?? 60);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_MAX_B64 = 6_000_000; // ~4,5MB de imagem (limite da API com folga)

type HelpRow = {
  id: string;
  from_me: boolean;
  content: string;
  pathname: string | null;
  has_image: boolean;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { data, error } = await getAdmin()
    .from("help_messages")
    .select("id, from_me, content, pathname, has_image, created_at")
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return serverError("Failed to load help chat");
  return jsonOk({ messages: ((data ?? []) as HelpRow[]).reverse() });
}

/** Contexto do canal web pro system prompt (substitui o "mundo WhatsApp"). */
function webSystemExtra(pathname: string | null, locale: string): string {
  return [
    `CANAL: você está no CHAT DE AJUDA DENTRO DA PLATAFORMA (balão flutuante no app), não no WhatsApp. A pessoa está LOGADA e navegando agora.`,
    pathname ? `PÁGINA ATUAL do aluno: ${pathname} — use isso pra orientar ("clica em...", "nesse menu à esquerda...").` : "",
    `IDIOMA: a interface do aluno está em "${locale}". Responda SEMPRE nesse idioma (se a pessoa escrever em outro, siga o idioma dela).`,
    `PRINTS: quando o aluno mandar um print da tela, descreva o que fazer apontando os elementos que aparecem nele.`,
    `Não mencione WhatsApp como canal seu; se precisar de humano, diga que a equipe foi avisada e responde por e-mail (suporte@fastcloner.com).`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Escalação no canal web: e-mail pra equipe (zap da Mary está pausado). */
async function emailEscalation(args: {
  email: string;
  reason: string;
  lastText: string;
  pathname: string | null;
  technical: boolean;
}): Promise<void> {
  try {
    const admin = getAdmin();
    const to = new Set<string>([SUPPORT_EMAIL]);
    if (!args.technical) {
      const { data } = await admin.from("admin_emails").select("email");
      for (const r of (data ?? []) as { email: string | null }[]) {
        if (r.email) to.add(r.email.toLowerCase());
      }
    }
    await sendEmail({
      to: [...to],
      subject: `${args.technical ? "⚙️ ERRO TÉCNICO" : "🙋 Aluno pedindo humano"} — help do app — ${args.email}`,
      html:
        `<p>Escalação da Mary no <strong>chat de ajuda do app</strong>.</p><ul>` +
        `<li><strong>Aluno:</strong> ${escapeHtml(args.email)}</li>` +
        `<li><strong>Situação:</strong> ${escapeHtml(args.reason)}</li>` +
        (args.pathname ? `<li><strong>Página:</strong> ${escapeHtml(args.pathname)}</li>` : "") +
        `<li><strong>Última mensagem:</strong> "${escapeHtml(args.lastText.slice(0, 300))}"</li>` +
        `</ul><p>Responda o aluno por e-mail (o chat do app não tem resposta humana ainda).</p>`,
    });
  } catch {
    /* best-effort */
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: {
    text?: unknown;
    pathname?: unknown;
    locale?: unknown;
    image?: { data?: unknown; media_type?: unknown } | null;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const pathname =
    typeof body.pathname === "string" ? body.pathname.slice(0, 200) : null;
  const locale = typeof body.locale === "string" ? body.locale.slice(0, 8) : "pt-BR";

  let image: AgentImage | null = null;
  if (body.image && typeof body.image === "object") {
    const data = typeof body.image.data === "string" ? body.image.data : "";
    const mediaType = typeof body.image.media_type === "string" ? body.image.media_type : "";
    if (!IMAGE_TYPES.has(mediaType)) return badRequest("Formato de imagem não suportado");
    if (!data || data.length > IMAGE_MAX_B64) return badRequest("Imagem grande demais (máx ~4MB)");
    image = { data, mediaType };
  }

  if (!text && !image) return badRequest("Mensagem vazia");
  if (text.length > TEXT_MAX) return badRequest(`Mensagem máx ${TEXT_MAX} caracteres`);

  const admin = getAdmin();

  // Rate-limit: respostas da Mary pra este usuário nas últimas 24h.
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const { count } = await admin
    .from("help_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user_id)
    .eq("from_me", true)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_PER_DAY) {
    return jsonError(
      "rate_limited",
      "Você atingiu o limite de mensagens de hoje no chat de ajuda. Escreva pra suporte@fastcloner.com que a equipe continua de lá.",
      429,
    );
  }

  // Grava a mensagem do aluno.
  const userContent = text || "[imagem]";
  const { error: insErr } = await admin.from("help_messages").insert({
    user_id: auth.user_id,
    from_me: false,
    content: image && text ? `${text}\n[o aluno anexou um print]` : userContent,
    pathname,
    has_image: Boolean(image),
  } as never);
  if (insErr) return serverError("Failed to save message");

  // Histórico → formato do cérebro (só content/from_me/sender_name importam).
  const { data: hist } = await admin
    .from("help_messages")
    .select("from_me, content, created_at")
    .eq("user_id", auth.user_id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const history = ((hist ?? []) as HelpRow[])
    .reverse()
    .map(
      (m) =>
        ({
          content: m.content,
          from_me: m.from_me,
          sender_name: null,
        }) as unknown as AgentMessageRow,
    );

  // Conta SEMPRE identificada (login). Falhou o snapshot → aviso neutro (sem
  // cair no texto "não localizada pelo telefone", que é do WhatsApp).
  const account =
    (await buildAccountContext(auth.user_id)) ??
    "Conta logada identificada, mas o snapshot não carregou agora. Responda normalmente; pra saldo/pagamento exatos, oriente recarregar a página ou escrever pra suporte@fastcloner.com.";

  let reply: string;
  try {
    reply = await buildAgentReply(history, {
      account,
      image,
      systemExtra: webSystemExtra(pathname, locale),
    });
  } catch (e) {
    console.error("[help] Mary falhou:", e instanceof Error ? e.message : e);
    return serverError("Assistente indisponível agora — tente de novo em instantes.");
  }

  const { clean, reason, technical } = extractEscalation(reply);
  if (reason) {
    await emailEscalation({ email: auth.email ?? "?", reason, lastText: userContent, pathname, technical });
  }
  const finalReply = clean || reply;

  const { data: saved, error: repErr } = await admin
    .from("help_messages")
    .insert({ user_id: auth.user_id, from_me: true, content: finalReply, pathname } as never)
    .select("id, from_me, content, pathname, has_image, created_at")
    .single();
  if (repErr) return serverError("Failed to save reply");

  return jsonOk({ message: saved });
}
