/**
 * Retomada de mensagem SEM RESPOSTA — a rede de segurança da Carol. Server-only.
 *
 * Caso Pati (24/08 18:49 UTC): o áudio dela chegou, foi transcrito, a Carol
 * estava montando a resposta… e 18 segundos depois o deploy matou o processo
 * (SIGKILL). A resposta morreu no meio e NADA tentava de novo: o webhook do
 * WhatsApp responde 200 na hora e o processamento vive só na memória. Uma
 * queda, um deploy, um erro de rede na LLM — e a pessoa fica no vácuo, sem
 * ninguém saber.
 *
 * Aqui: varre conversas PRIVADAS em modo automático cuja ÚLTIMA mensagem é do
 * aluno (texto/áudio/imagem), tem mais de 2 min (a Carol "humanizada" demora
 * até ~1,5 min pra responder) e menos de 24 h, e reprocessa pelo MESMO caminho
 * do webhook (`maybeRespond`). Áudio já transcrito vira texto (o conteúdo
 * salvo é a transcrição); imagem sem legenda é pulada (não dá pra rever a
 * mídia sem o webhook). Idempotente: se a Carol respondeu no meio-tempo, a
 * última mensagem já não é do aluno e nada acontece.
 *
 * Cron no Hetzner a cada 5 min (sweep_unanswered.sh), padrão dos outros sweeps.
 */
import { getAdmin } from "@/lib/db/admin";
import { maybeRespond } from "@/lib/agent/respond";
import type { AgentChatRow, AgentMessageRow } from "@/lib/db/types";

const MIN_IDADE_MIN = 2;
const MAX_IDADE_H = 24;
const LOTE = 10;

export type RetomadaSummary = {
  candidatas: number;
  retomadas: number;
  puladas: number;
  erros: number;
  chats: string[];
};

export async function retomarSemResposta(): Promise<RetomadaSummary> {
  const admin = getAdmin();
  const summary: RetomadaSummary = { candidatas: 0, retomadas: 0, puladas: 0, erros: 0, chats: [] };
  const agora = Date.now();
  const desde = new Date(agora - MAX_IDADE_H * 3600_000).toISOString();
  const ate = new Date(agora - MIN_IDADE_MIN * 60_000).toISOString();

  // Conversas privadas em automático com movimento na janela.
  const { data: chats } = await admin
    .from("agent_chats")
    .select("*")
    .eq("kind", "private")
    .eq("mode", "auto")
    .gte("last_message_at", desde)
    .order("last_message_at", { ascending: false })
    .limit(200);

  for (const chat of (chats ?? []) as AgentChatRow[]) {
    if (summary.retomadas >= LOTE) break;
    const { data: ult } = await admin
      .from("agent_messages")
      .select("*")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const m = ult as AgentMessageRow | null;
    if (!m || m.role !== "user" || m.from_me) continue;
    if (m.created_at > ate || m.created_at < desde) continue;
    summary.candidatas += 1;

    // Áudio já transcrito → texto. Imagem sem legenda → não dá pra rever.
    let kind = m.kind;
    let content = m.content;
    if (kind === "audio") {
      if (!content || !content.trim()) { summary.puladas += 1; continue; }
      kind = "text";
      content = content.replace(/^\[áudio\]\s*/i, "");
    } else if (kind === "image") {
      const legenda = (content ?? "").replace(/^\[imagem\]\s*/i, "").trim();
      if (!legenda) { summary.puladas += 1; continue; }
      kind = "text";
      content = legenda;
    } else if (kind !== "text" || !content?.trim()) {
      summary.puladas += 1;
      continue;
    }

    try {
      console.log(`[agent/retomar] ${chat.name ?? chat.wa_jid} sem resposta desde ${m.created_at} — retomando`);
      await maybeRespond({
        chat,
        messageId: m.id,
        waMessageId: m.wa_message_id,
        fromMe: false,
        kind,
        content,
        mediaUrl: null,
        mediaType: null,
        mentioned: false,
        senderJid: m.sender_jid,
        replyToId: null,
      });
      summary.retomadas += 1;
      summary.chats.push(chat.id);
    } catch (e) {
      summary.erros += 1;
      console.error("[agent/retomar] falhou:", e instanceof Error ? e.message : e);
    }
  }
  return summary;
}
