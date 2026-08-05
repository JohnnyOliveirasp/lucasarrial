/**
 * Fast no E-MAIL (pedido Johnny 03/08): responde sozinha os e-mails que os
 * alunos mandam pro suporte@fastcloner.com, com cópia pros admins.
 *
 * Fluxo por mensagem NÃO LIDA: parse do MIME → filtros (nunca responder a
 * própria plataforma/robôs/Hotmart) → identifica o aluno pelo REMETENTE →
 * snapshot da conta → cérebro da Fast (manual + contexto de e-mail, com
 * tom de desculpas quando a falha foi nossa) → resposta SMTP pelo próprio
 * suporte@ + cópia oculta pros admins → marca como lida.
 *
 * Regras duras herdadas: dinheiro/reembolso → [ESCALAR] (a Fast acolhe e
 * avisa que a equipe confirma; nunca resolve sozinha). "PULAR" = silêncio.
 */
import { getAdmin } from "@/lib/db/admin";
import type { AgentMessageRow } from "@/lib/db/types";
import { buildAgentReply } from "./brain";
import { buildAccountContext } from "./account";
import { extractEscalation } from "./escalate";
import { agentEnabled } from "./respond";
import { fetchUnseen, markSeen, supportMailConfigured, type RawMail } from "./mail-imap";
import { sendSupportMail } from "./mail-smtp";

const BODY_MAX = 4000; // o que vai pro modelo (e-mails têm assinatura/quote longos)
const BATCH = 8; // por varredura (cron 5min) — o resto fica pra próxima

// ---------- parse MIME mínimo (texto legível de um e-mail cru) ----------

function decodeWord(s: string): string {
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (m, _cs, enc, data) => {
    try {
      if (String(enc).toUpperCase() === "B") return Buffer.from(data, "base64").toString("utf8");
      const bytes = String(data)
        .replace(/_/g, " ")
        .replace(/=([0-9A-F]{2})/gi, (_x, h) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(bytes, "latin1").toString("utf8");
    } catch {
      return m;
    }
  });
}

function header(raw: string, name: string): string {
  const m = raw.match(new RegExp(`^${name}: (.*(?:\\r?\\n[ \\t].*)*)`, "mi"));
  return m ? decodeWord(m[1].replace(/\r?\n[ \t]+/g, " ").trim()) : "";
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrai o texto do e-mail: parte text/plain (ou html sem tags). */
export function mailText(raw: string): string {
  const plainIdx = raw.search(/Content-Type:\s*text\/plain/i);
  const htmlIdx = raw.search(/Content-Type:\s*text\/html/i);
  const idx = plainIdx >= 0 ? plainIdx : htmlIdx;
  let seg = idx >= 0 ? raw.slice(idx) : raw;
  const headBlock = seg.slice(0, 400);
  const start = seg.search(/\r?\n\r?\n/);
  seg = start >= 0 ? seg.slice(start) : seg;
  const boundary = seg.search(/\r?\n--[-=_a-zA-Z0-9]{6,}/);
  if (boundary > 0) seg = seg.slice(0, boundary);
  if (/quoted-printable/i.test(headBlock)) {
    seg = seg.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  } else if (/base64/i.test(headBlock)) {
    try {
      seg = Buffer.from(seg.replace(/\s+/g, ""), "base64").toString("utf8");
    } catch {
      /* fica como está */
    }
  }
  let text = idx === htmlIdx && idx >= 0 ? stripHtml(seg) : seg.replace(/\s+/g, " ").trim();
  // Bytes UTF-8 lidos como latin1 → reconverte se sair limpo.
  try {
    const round = Buffer.from(text, "latin1").toString("utf8");
    if (!/�/.test(round)) text = round;
  } catch {
    /* mantém */
  }
  return text.slice(0, BODY_MAX);
}

// ---------- filtros: em quem a Fast NUNCA mexe ----------

const SKIP_FROM =
  /no-?reply|noreply|mailer-daemon|postmaster|hotmart|privateemail\.com|cvpunch\.ai|@fastcloner\.com|resend\.com/i;

function shouldSkip(raw: string, fromEmail: string): string | null {
  if (!fromEmail) return "sem remetente";
  if (SKIP_FROM.test(fromEmail)) return "remetente de sistema";
  if (/^auto-submitted: (?!no)/im.test(raw)) return "auto-submitted";
  if (/^precedence: (bulk|list|junk)/im.test(raw)) return "bulk";
  return null;
}

// ---------- contexto de canal pro cérebro ----------

function mailSystemExtra(accountFound: boolean): string {
  return [
    `CANAL: você está respondendo um E-MAIL enviado pro suporte@fastcloner.com. Formato: e-mail curto em texto puro (sem markdown, sem asteriscos), começando com "Oi, [nome]!" quando souber o nome, terminando com "Abraço,\nFast — suporte FastCloner".`,
    `TOM: muitos desses e-mails são de alunos chateados com falhas. Se o problema relatado tem cara de falha NOSSA (erro, crédito que não entrou, geração ruim), comece pedindo desculpas sinceras, sem se defender. Seja concreta no próximo passo.`,
    `CRÉDITOS/ACESSO NÃO LIBERADO após compra: explique que a liberação é automática quando a Hotmart aprova; peça pra pessoa entrar em fastcloner.com/app com o MESMO e-mail da compra (criar conta com ele, se ainda não tem) — os créditos aparecem no primeiro login. Se ela já fez isso e nada, diga que a equipe vai verificar [ESCALAR-TECNICO: créditos não liberados após compra].`,
    accountFound
      ? `A CONTA DO ALUNO FOI IDENTIFICADA pelo e-mail do remetente — use os dados reais abaixo.`
      : `NÃO existe conta na plataforma com o e-mail do remetente. Se a dúvida depender de conta, oriente a informar o e-mail cadastrado (ou criar conta com o e-mail da compra).`,
    `REEMBOLSO/CANCELAMENTO/COBRANÇA: acolha, lamente e diga que a equipe confirma a solicitação em breve (a garantia Hotmart de 7 dias é respeitada) e finalize com [ESCALAR: resumo]. NUNCA confirme reembolso você mesma.`,
    `Se o e-mail NÃO for um aluno/cliente pedindo ajuda (propaganda, spam, notificação de sistema, corrente), responda APENAS a palavra PULAR.`,
  ].join("\n");
}

// ---------- varredura ----------

export type MailSweepSummary = {
  scanned: number;
  replied: number;
  skipped: number;
  escalated: number;
  errors: number;
};

/**
 * Erro técnico que a Fast NÃO resolve → vira INCIDENTE (aba Falhas do /admin),
 * que é exatamente a fila que o Sentinela varre na ronda dele (pedido Johnny
 * 03/08). Dedupe por aluno: reclamação repetida soma ocorrência no mesmo
 * incidente em vez de abrir outro.
 */
async function openIncidentForSentinela(fromEmail: string, reason: string, excerpt: string): Promise<void> {
  const admin = getAdmin();
  const signature = `fast-email:${fromEmail}`;
  const now = new Date().toISOString();
  const { data: existingRaw } = await admin
    .from("incidents" as never)
    .select("id, status, occurrences, affected_emails")
    .eq("signature", signature)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const existing = existingRaw as unknown as {
    id: string;
    status: string;
    occurrences: number;
    affected_emails: string[];
  } | null;

  if (existing) {
    const reopened = existing.status === "fixed" || existing.status === "ignored";
    await admin
      .from("incidents" as never)
      .update({
        status: reopened ? "open" : existing.status,
        occurrences: (existing.occurrences ?? 1) + 1,
        last_seen_at: now,
        sample_error: excerpt.slice(0, 1000),
        description: reason,
      } as never)
      .eq("id", existing.id);
    return;
  }
  await admin.from("incidents" as never).insert({
    kind: "reported",
    cause: "reported",
    status: "open",
    signature,
    title: `Fast (e-mail): ${reason.slice(0, 90)}`,
    occurrences: 1,
    affected_emails: [fromEmail],
    sample_error: excerpt.slice(0, 1000),
    description: `Relato do aluno por e-mail ao suporte@ — a Fast não conseguiu resolver e escalou. Resumo dela: ${reason}`,
    reported_by: "fast",
    first_seen_at: now,
    last_seen_at: now,
  } as never);
}

// Pedido Johnny 05/08: cópia oculta SÓ pra ele (antes ia pra admin_emails inteira).
// admin_emails segue intacta — ela também controla o acesso ao /admin.
async function adminBccList(): Promise<string[]> {
  return ["johnny.oliveirasp@gmail.com"];
}

async function respondOne(mail: RawMail, bcc: string[]): Promise<"replied" | "skipped" | "escalated"> {
  const raw = mail.raw;
  const fromHeader = header(raw, "From");
  const fromEmail = (fromHeader.match(/<([^>]+)>/)?.[1] ?? fromHeader).trim().toLowerCase();
  const subject = header(raw, "Subject") || "(sem assunto)";
  const messageId = header(raw, "Message-ID") || null;

  const skip = shouldSkip(raw, fromEmail);
  const text = skip ? "" : mailText(raw);
  if (skip || text.length < 5) {
    await markSeen(mail.uid);
    return "skipped";
  }

  // Conta do aluno pelo remetente (identidade forte: ele escreveu DESSE e-mail).
  const admin = getAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", fromEmail)
    .maybeSingle();
  const account = profile ? await buildAccountContext(profile.id) : null;

  const history = [
    { content: `Assunto: ${subject}\n\n${text}`, from_me: false, sender_name: fromHeader.split("<")[0].trim() || null },
  ] as unknown as AgentMessageRow[];

  const replyRaw = await buildAgentReply(history, {
    account,
    systemExtra: mailSystemExtra(Boolean(account)),
  });
  if (replyRaw.trim().toUpperCase() === "PULAR") {
    await markSeen(mail.uid);
    return "skipped";
  }

  const { clean: visible, reason, technical } = extractEscalation(replyRaw);
  const replySubject = /^re:/i.test(subject) ? subject : `Re: ${subject}`;

  await sendSupportMail({
    to: fromEmail,
    subject: replySubject,
    text: visible,
    inReplyTo: messageId,
    bcc,
  });
  // Erro técnico sem solução na hora → incidente aberto pro Sentinela resolver.
  if (reason && technical) {
    try {
      await openIncidentForSentinela(fromEmail, reason, text);
    } catch (e) {
      console.error("[agent/mail] falha ao abrir incidente:", e instanceof Error ? e.message : e);
    }
  }
  await markSeen(mail.uid);
  console.log(
    `[agent/mail] respondido uid=${mail.uid} para=${fromEmail}${reason ? (technical ? " (INCIDENTE→Sentinela)" : " (ESCALADO)") : ""}`,
  );
  return reason ? "escalated" : "replied";
}

/** Uma varredura completa (chamada pelo cron). Best-effort por mensagem. */
export async function sweepSupportMail(): Promise<MailSweepSummary> {
  const summary: MailSweepSummary = { scanned: 0, replied: 0, skipped: 0, escalated: 0, errors: 0 };
  if (!supportMailConfigured() || process.env.AGENT_MAIL_ENABLED !== "1") return summary;
  if (!(await agentEnabled())) return summary; // interruptor geral da Fast vale aqui

  const unseen = await fetchUnseen(BATCH);
  summary.scanned = unseen.length;
  if (unseen.length === 0) return summary;

  const bcc = await adminBccList();
  for (const mail of unseen) {
    try {
      const outcome = await respondOne(mail, bcc);
      if (outcome === "replied") summary.replied += 1;
      else if (outcome === "escalated") summary.escalated += 1;
      else summary.skipped += 1;
    } catch (e) {
      // NÃO marca como lida — tenta de novo na próxima varredura.
      summary.errors += 1;
      console.error(`[agent/mail] falha uid=${mail.uid}:`, e instanceof Error ? e.message : e);
    }
  }
  return summary;
}
