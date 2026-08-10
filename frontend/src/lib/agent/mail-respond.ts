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
import { winbackContextByEmail, applyWinbackMarkers } from "@/lib/winback/conversation";

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

/**
 * Quem recebe o material que a Fast NÃO consegue abrir (vídeo em link/anexo).
 * Pedido do Johnny 10/08: em vez de só escalar por dentro, encaminhar o e-mail
 * do aluno direto pra caixa de quem vai olhar. Env AGENT_VIDEO_REVIEW_EMAILS
 * (separado por vírgula) permite somar/trocar sem deploy.
 */
function revisoresDeVideo(): string[] {
  const env = (process.env.AGENT_VIDEO_REVIEW_EMAILS || "").trim();
  const lista = env ? env.split(",").map((e) => e.trim()).filter(Boolean) : [];
  return lista.length ? lista : ["johnny.oliveirasp@gmail.com"];
}

/**
 * Encaminha pro time o e-mail que a Fast não consegue avaliar sozinha (vídeo
 * anexado ou em link do Drive). O texto do aluno vai inteiro, com o e-mail
 * dele no responder-para: quem abrir responde direto, sem intermediário.
 */
export async function encaminharParaRevisao(args: {
  fromEmail: string;
  subject: string;
  corpo: string;
  motivo: string;
}): Promise<void> {
  const texto =
    `A Fast recebeu isto e não consegue avaliar sozinha (${args.motivo}).\n\n` +
    `De: ${args.fromEmail}\nAssunto: ${args.subject}\n\n` +
    `--- mensagem do aluno ---\n${args.corpo}\n--- fim ---\n\n` +
    `Responda direto pro aluno (o responder-para já está apontando pra ele).`;
  try {
    await sendSupportMail({
      to: revisoresDeVideo().join(", "),
      subject: `[VER VÍDEO] ${args.fromEmail} — ${args.subject}`.slice(0, 180),
      text: texto,
      replyTo: args.fromEmail,
    });
    console.log(`[agent/mail] encaminhado pra revisão: ${args.fromEmail} (${args.motivo})`);
  } catch (e) {
    console.error("[agent/mail] falha ao encaminhar pra revisão:", e instanceof Error ? e.message : e);
  }
}

/**
 * Mensagem grande demais (anexo pesado): a gente NÃO baixa o conteúdo — só os
 * cabeçalhos. Responde explicando que a caixa não recebe anexo e marca como
 * lida, senão ela trava a fila pra sempre (foi o que aconteceu em 08/08: um
 * e-mail de 33MB deixou a Fast 2 dias sem responder ninguém).
 */
async function responderAnexoGrande(
  mail: RawMail,
  fromEmail: string,
  subject: string,
  messageId: string | null,
  bcc: string[],
): Promise<"replied"> {
  const mb = Math.round((mail.sizeBytes ?? 0) / 1_000_000);
  const texto =
    "Oi! Tudo bem?\n\n" +
    `Recebi seu e-mail, mas ele veio com um anexo grande demais (${mb} MB) e o nosso ` +
    "suporte por e-mail não consegue abrir arquivos desse tamanho — por isso não consegui " +
    "ler o que você mandou.\n\n" +
    "Me reenvia só o texto, por favor, explicando o que aconteceu? Se for um áudio, uma " +
    "gravação ou um vídeo, o melhor caminho é fazer o upload direto na plataforma, ou me " +
    "mandar um link (Google Drive, WeTransfer, YouTube não listado).\n\n" +
    "Se for um print de erro, pode colar a imagem no corpo do e-mail mesmo, que costuma " +
    "vir bem menor.\n\n" +
    "Desculpe o transtorno e obrigada!\n\n" +
    "Fast — FastCloner";

  await sendSupportMail({
    to: fromEmail,
    subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
    text: texto,
    inReplyTo: messageId,
    bcc,
  });
  // O time precisa saber que existe material esperando — mesmo sem o anexo,
  // o assunto e o remetente bastam pra ir atrás na caixa do suporte@.
  await encaminharParaRevisao({
    fromEmail,
    subject,
    corpo: `(anexo de ${mb} MB — grande demais pra Fast abrir; a mensagem original está na caixa do suporte@)`,
    motivo: `anexo de ${mb} MB`,
  });
  await markSeen(mail.uid);
  console.log(`[agent/mail] anexo grande (${mb}MB) uid=${mail.uid} de=${fromEmail} — respondido e liberado`);
  return "replied";
}

async function respondOne(mail: RawMail, bcc: string[]): Promise<"replied" | "skipped" | "escalated"> {
  const raw = mail.raw;
  const fromHeader = header(raw, "From");
  const fromEmail = (fromHeader.match(/<([^>]+)>/)?.[1] ?? fromHeader).trim().toLowerCase();
  const subject = header(raw, "Subject") || "(sem assunto)";
  const messageId = header(raw, "Message-ID") || null;

  if (mail.oversized) {
    if (shouldSkip(raw, fromEmail) || !fromEmail.includes("@")) {
      await markSeen(mail.uid); // robô/plataforma com anexo: só destrava a fila
      return "skipped";
    }
    return responderAnexoGrande(mail, fromEmail, subject, messageId, bcc);
  }

  const skip = shouldSkip(raw, fromEmail);
  const text = skip ? "" : mailText(raw);
  if (skip || text.length < 5) {
    await markSeen(mail.uid);
    return "skipped";
  }

  // Link de arquivo (Drive & cia): a Fast não abre, o time abre. Encaminha o
  // e-mail inteiro pra quem vai olhar — ela ainda responde o aluno dizendo que
  // pediu análise (regra 6b do manual).
  const linkArquivo = text.match(
    /https?:\/\/(?:drive\.google\.com|docs\.google\.com|[\w.-]*wetransfer\.com|[\w.-]*dropbox\.com|1drv\.ms|[\w.-]*onedrive\.[\w.]+|youtu\.be|(?:www\.)?youtube\.com)\/\S+/i,
  );
  if (linkArquivo) {
    await encaminharParaRevisao({
      fromEmail,
      subject,
      corpo: text,
      motivo: `link de arquivo: ${linkArquivo[0].slice(0, 200)}`,
    });
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

  // RESGATE: se fomos NÓS que escrevemos primeiro (pessoa que cancelou), a
  // Fast troca de missão — escuta o motivo, argumenta e pode devolver crédito.
  // Sem isto ela atenderia como suporte comum, sem saber do cancelamento.
  const winback = await winbackContextByEmail(fromEmail);

  const replyRaw = await buildAgentReply(history, {
    account,
    systemExtra: [mailSystemExtra(Boolean(account)), winback?.systemExtra].filter(Boolean).join("\n\n"),
  });
  if (replyRaw.trim().toUpperCase() === "PULAR") {
    await markSeen(mail.uid);
    return "skipped";
  }

  const { clean: semEscalacao, reason, technical } = extractEscalation(replyRaw);
  // Executa o que ela decidiu no resgate (motivo, crédito, opt-out) e tira os
  // marcadores antes de enviar.
  let visible = semEscalacao;
  if (winback) {
    const aplicado = await applyWinbackMarkers(winback.target, semEscalacao);
    if (aplicado.clean) visible = aplicado.clean;
    if (aplicado.creditou > 0) {
      console.log(`[winback/email] creditou ${aplicado.creditou} para ${fromEmail}`);
    }
  }
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

  // TRAVA contra duas varreduras ao mesmo tempo (10/08: o cron de 5min e uma
  // chamada manual rodaram juntos e alguns alunos receberam a resposta DUAS
  // vezes — a marcação como lida só acontece depois de responder, então as
  // duas leram a mesma caixa). Uma rodada com fila cheia passa de 5 minutos,
  // então isso aconteceria sozinho mais cedo ou mais tarde.
  const { data: peguei } = await getAdmin().rpc("claim_alert", {
    p_key: "mail_sweep",
    p_cooldown_seconds: 240,
  });
  if (peguei === false) {
    console.log("[agent/mail-sweep] outra varredura em andamento — esta rodada sai");
    return summary;
  }

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
