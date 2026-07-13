/**
 * Agente de suporte — F4: identidade e contexto da conta. Server-only.
 *
 * Cadeia: JID do WhatsApp → telefone real → perfil do aluno → snapshot
 * SÓ-LEITURA (plano, saldo, jobs recentes, falhas) injetado no prompt.
 *
 * - GOWS identifica contatos por LID (anônimo); o telefone vem do store do
 *   whatsmeow via WAHA GET /lids/{lid} (mapeamento lid→pn).
 * - A plataforma NÃO coleta telefone no cadastro — o match é com o
 *   checkout_phone que a Hotmart manda no webhook (payment_events.payload).
 *   Telefone é evidência forte (ninguém "chuta" o telefone de outro aluno);
 *   NUNCA vincular por e-mail dito na conversa (qualquer um alegaria).
 * - Best-effort: qualquer falha aqui devolve null e a Mary responde sem
 *   contexto (nunca derruba o pipeline).
 */
import { getAdmin } from "@/lib/db/admin";
import { agentProvider } from "@/lib/agent/provider";
import { wahaLidToPhone } from "@/lib/agent/waha";
import type { AgentChatRow, ProfileRow } from "@/lib/db/types";

/** Telefone (dígitos) a partir do JID do chat. @lid → consulta a WAHA. */
async function phoneFromJid(jid: string): Promise<string | null> {
  if (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@c.us")) {
    const digits = jid.split("@")[0].replace(/\D/g, "");
    return digits || null;
  }
  if (jid.endsWith("@lid") && agentProvider() === "waha") {
    return wahaLidToPhone(jid);
  }
  return null;
}

/**
 * Variantes do telefone pra casar com o checkout_phone da Hotmart, que vem
 * em formato LOCAL sem o código do país (ex.: "21983033483"). O WhatsApp
 * entrega com país (ex.: "5521983033483") e números BR antigos podem não
 * ter o 9º dígito — gera as combinações razoáveis.
 */
function phoneCandidates(digits: string): string[] {
  const out = new Set<string>([digits]);
  if (digits.startsWith("55") && digits.length >= 12) {
    const local = digits.slice(2); // DDD + número
    out.add(local);
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);
    if (rest.length === 8) out.add(`${ddd}9${rest}`); // sem 9 → com 9
    if (rest.length === 9 && rest.startsWith("9")) out.add(`${ddd}${rest.slice(1)}`); // com 9 → sem 9
  }
  return [...out];
}

/** Acha o perfil do aluno pelo telefone (via checkout_phone da Hotmart). */
async function matchProfileByPhone(digits: string): Promise<string | null> {
  const admin = getAdmin();
  const { data } = await admin
    .from("payment_events")
    .select("buyer_email, received_at")
    .in("payload->data->buyer->>checkout_phone", phoneCandidates(digits))
    .not("buyer_email", "is", null)
    .order("received_at", { ascending: false })
    .limit(5);
  const rows = (data ?? []) as { buyer_email: string | null }[];
  const email = rows.find((r) => r.buyer_email)?.buyer_email;
  if (!email) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return (profile as { id: string } | null)?.id ?? null;
}

/**
 * Garante wa_phone e profile_id no chat (privado). Telefone resolve UMA vez;
 * o match com perfil re-tenta a cada mensagem enquanto não achar (o aluno
 * pode comprar depois da primeira conversa). Devolve o profile_id ou null.
 */
export async function ensureChatIdentity(chat: AgentChatRow): Promise<string | null> {
  try {
    if (chat.kind !== "private") return null;
    if (chat.profile_id) return chat.profile_id;

    const admin = getAdmin();
    let phone = chat.wa_phone;
    if (!phone) {
      phone = await phoneFromJid(chat.wa_jid);
      if (!phone) return null;
      await admin.from("agent_chats").update({ wa_phone: phone } as never).eq("id", chat.id);
    }

    const profileId = await matchProfileByPhone(phone);
    if (!profileId) return null;
    await admin.from("agent_chats").update({ profile_id: profileId } as never).eq("id", chat.id);
    return profileId;
  } catch {
    return null;
  }
}

const dtBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "?";

type JobLine = { label: string; name: string | null; status: string | null; error: string | null; at: string | null };

function jobLines(lines: JobLine[]): string {
  return lines
    .map((j) => {
      const err = j.status === "failed" && j.error ? ` — erro: ${j.error.slice(0, 120)}` : "";
      return `  - ${j.label}${j.name ? ` "${j.name}"` : ""}: ${j.status ?? "?"} (${dtBR(j.at)})${err}`;
    })
    .join("\n");
}

/**
 * Snapshot compacto da conta pro system prompt da Mary (SÓ leitura).
 * Últimos jobs de cada produto + saldo + transações recentes de crédito.
 */
export async function buildAccountContext(profileId: string): Promise<string | null> {
  try {
    const admin = getAdmin();
    const { data: p } = await admin.from("profiles").select("*").eq("id", profileId).maybeSingle();
    if (!p) return null;
    const profile = p as ProfileRow;

    const recent = (table: string, cols: string) =>
      admin.from(table as never).select(cols).eq("user_id", profileId).order("created_at", { ascending: false }).limit(3);

    const [voices, gens, clones, images, videos, txs] = await Promise.all([
      recent("voices", "name,status,error_message,created_at"),
      recent("generations", "name,status,error_message,created_at"),
      recent("video_clones", "name,status,error_message,created_at"),
      recent("image_generations", "name,status,error_message,created_at"),
      recent("video_projects", "name,status,error_message,created_at"),
      admin.from("credit_transactions").select("kind,amount,note,created_at").eq("user_id", profileId).order("created_at", { ascending: false }).limit(6),
    ]);

    type R = { name?: string | null; status?: string | null; error_message?: string | null; created_at?: string | null };
    const lines = (label: string, rows: unknown): JobLine[] =>
      ((rows ?? []) as R[]).map((r) => ({ label, name: r.name ?? null, status: r.status ?? null, error: r.error_message ?? null, at: r.created_at ?? null }));

    const jobs = [
      ...lines("Voz (treino)", voices.data),
      ...lines("Áudio (TTS)", gens.data),
      ...lines("Vídeo Clone", clones.data),
      ...lines("Imagem", images.data),
      ...lines("Vídeo História", videos.data),
    ];

    const txLines = ((txs.data ?? []) as { kind: string; amount: number; note: string | null; created_at: string }[])
      .map((t) => `  - ${dtBR(t.created_at)}: ${t.amount > 0 ? "+" : ""}${t.amount} cr (${t.kind}${t.note ? ` — ${t.note.slice(0, 80)}` : ""})`)
      .join("\n");

    const saldo = (profile.credits_subscription ?? 0) + (profile.credits_extra ?? 0);
    const acesso = profile.access_until
      ? `ativo até ${dtBR(profile.access_until)}`
      : profile.access_source
        ? "ativo"
        : "SEM assinatura ativa";

    return [
      `Nome: ${profile.display_name ?? "?"} · E-mail: ${profile.email}`,
      `Plano: ${profile.plan} · Acesso: ${acesso}${profile.pending_payment_at ? " · ⚠️ Pix/boleto PENDENTE aguardando pagamento" : ""}`,
      `Saldo: ${saldo.toLocaleString("pt-BR")} créditos (${(profile.credits_subscription ?? 0).toLocaleString("pt-BR")} do plano + ${(profile.credits_extra ?? 0).toLocaleString("pt-BR")} avulsos)`,
      `Cadastro em: ${dtBR(profile.created_at)}`,
      jobs.length ? `Últimos trabalhos (3 por produto):\n${jobLines(jobs)}` : "Nenhum trabalho ainda (conta sem uso).",
      txLines ? `Últimas movimentações de crédito:\n${txLines}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return null;
  }
}
