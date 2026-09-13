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
import { abrirChamadoReportado } from "@/lib/incidents/reportar";
import { reabrirPorRespostaDoAluno } from "@/lib/incidents/espera";
import { entregarAoTime } from "@/lib/incidents/entregar";
import { guardarPrints } from "./mail-anexos";
import type { AgentMessageRow } from "@/lib/db/types";
import { buildAgentReply } from "./brain";
import { buildAccountContext } from "./account";
import { extractEscalation } from "./escalate";
import { agentEnabled } from "./respond";
import { fetchUnseen, markSeen, supportMailConfigured, MAIL_MAX_BYTES, type RawMail } from "./mail-imap";
import { decidirAnexoGrande } from "./mail-anexo-grande";
import { recusasAnteriores, registrarRecusa } from "./mail-anexo-grande-canal";
import { sendSupportMail } from "./mail-smtp";
import { tratarSeForBounce } from "./mail-bounce-registro";
import { winbackContextByEmail, applyWinbackMarkers } from "@/lib/winback/conversation";

const BATCH = 8; // por varredura (cron 5min) — o resto fica pra próxima

// ---------- parse MIME mínimo ----------
// Mora em `mail-charset.ts`: são funções PURAS (bytes/MIME → texto), sem
// nenhuma dependência de `@/`, o que as deixa testáveis com `node --test`
// direto. Reexportadas aqui porque `mailText` é importada por fora
// (_frank/ferramentas/2026-09-09_medir_mojibake_na_caixa.cjs mede a função DE
// PRODUÇÃO por este caminho — mover sem reexportar quebraria a medição).
// `import` + `export` separados de propósito: `export ... from` reexporta mas
// NÃO traz o nome pro escopo local, e este arquivo chama `header`/`mailText`
// aqui dentro (o tsc pegou isso).
import { mailText, header } from "./mail-charset";
export { mailText, header };

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
    // O parêntese "(a garantia Hotmart de 7 dias é respeitada)" saiu daqui no
    // #198: lido pelo modelo como permissão pra AFIRMAR que a pessoa está na
    // janela, foi o que produziu o "você está dentro dos 7 primeiros dias"
    // enviado a uma compra de 12 dias atrás. Quem diz DENTRO/FORA agora é a
    // linha GARANTIA HOTMART do bloco da conta, calculada em account.ts.
    // O "7 dias" saiu TAMBÉM do texto abaixo no #265: a janela real varia por
    // produto (6, 7, 14, 15 ou 30 dias no que a Hotmart já nos mandou), então
    // repetir "7" aqui reintroduzia pela instrução o número que a conta parou
    // de usar.
    `REEMBOLSO/CANCELAMENTO/COBRANÇA: acolha, lamente e diga que a equipe confirma a solicitação em breve; finalize com [ESCALAR: resumo]. NUNCA confirme reembolso você mesma. Sobre a janela de garantia, seja obediente à linha GARANTIA HOTMART do bloco da conta — ela traz a DATA de fim, e a janela NÃO é sempre de 7 dias, então cite a data e nunca um número de dias: se ela disser FORA, ou não existir, NÃO afirme que há garantia — só diga que a equipe vai verificar.`,
    // Esta linha nasceu do caso de 09/09: depois de recusar um e-mail por
    // tamanho, o cliente respondeu "o arquivo não tem 2mb" — e o modelo, sem
    // saber que existe um teto de caixa, pediu desculpa e prometeu "pode
    // reenviar o arquivo, vou conseguir abrir agora". O reenvio bateu no MESMO
    // teto e levou a recusa idêntica. A promessa é que quebrou o atendimento,
    // não o limite.
    `ANEXO QUE NÃO ABRIU: o limite é da nossa CAIXA (a mensagem inteira, não o arquivo), e reenviar o mesmo anexo dá exatamente no mesmo. NUNCA prometa que vai conseguir abrir, nem peça pra reenviar o arquivo como anexo — isso é promessa que você não pode cumprir. Ofereça só o que funciona: descrever em texto, ou mandar link (Drive/WeTransfer). Se a pessoa disser que o arquivo dela é menor que o número que citamos, ela provavelmente está CERTA: o anexo engorda ~30% dentro do e-mail, então o arquivo pode ter 1,7 MB e a mensagem 2,3 MB. Dê razão a ela e explique a diferença, sem discutir número. Se já falhou duas vezes, finalize com [ESCALAR: e-mail que a caixa não consegue abrir].`,
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
  /** Relatórios de entrega que voltaram e viraram caso (#201). */
  bounces: number;
};

/**
 * Erro técnico que a Fast NÃO resolve → vira INCIDENTE (aba Falhas do /admin),
 * que é exatamente a fila que o Sentinela varre na ronda dele (pedido Johnny
 * 03/08). Dedupe por aluno: reclamação repetida soma ocorrência no mesmo
 * incidente em vez de abrir outro.
 */
async function openIncidentForSentinela(
  fromEmail: string,
  reason: string,
  excerpt: string,
  /** Prints que o aluno mandou (chaves no R2) — sem isso o incidente nasce
   *  cego e alguém precisa abrir a caixa do suporte na mão (caso Claudia,
   *  14/08). */
  prints: string[] = [],
  /** A Fast classificou como falha do produto? false = atendimento (cobrança,
   *  cancelamento, reembolso, dúvida de conta). Os dois viram incidente desde
   *  19/08 — muda o rótulo, não a existência. */
  technical = true,
): Promise<number | null> {
  // O corpo vive em lib/incidents/reportar.ts desde 22/08 — o WhatsApp precisa
  // do MESMO caminho, e duas cópias é como o zap ficou sem chamado até hoje.
  return abrirChamadoReportado({
    signature: `fast-email:${technical ? "tec" : "atend"}:${fromEmail}`,
    title: `Fast (e-mail${technical ? "" : ", atendimento"}): ${reason.slice(0, 90)}`,
    description: technical
      ? `Relato do aluno por e-mail ao suporte@ — a Fast não conseguiu resolver e escalou. Resumo dela: ${reason}`
      : `Pedido de ATENDIMENTO por e-mail ao suporte@ (cobrança, cancelamento, reembolso ou dúvida de conta) — a Fast não resolve isso sozinha e prometeu ao aluno que a equipe verificaria. Resumo dela: ${reason}`,
    reportedBy: "fast",
    categoria: technical ? "tecnico" : "atendimento",
    affectedEmails: [fromEmail],
    sampleError: excerpt,
    attachments: prints,
  });
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
 * cabeçalhos. Responde explicando que a caixa não abre a mensagem e marca como
 * lida, senão ela trava a fila pra sempre (foi o que aconteceu em 08/08: um
 * e-mail de 33MB deixou a Fast 2 dias sem responder ninguém).
 *
 * A CONTA e o TEXTO moram em `mail-anexo-grande.ts` (funções puras, testadas).
 * Aqui ficou só o encanamento: contar quantas vezes esta pessoa já levou a
 * recusa, mandar o e-mail, e — na segunda — entregar pra um humano em vez de
 * repetir a mesma receita. Ver o caso de 09/09 no cabeçalho daquele arquivo.
 */
async function responderAnexoGrande(
  mail: RawMail,
  fromEmail: string,
  subject: string,
  messageId: string | null,
  bcc: string[],
): Promise<"replied" | "escalated"> {
  const sizeBytes = mail.sizeBytes ?? 0;
  const decisao = decidirAnexoGrande({
    sizeBytes,
    limitBytes: MAIL_MAX_BYTES,
    recusasAnteriores: await recusasAnteriores(fromEmail),
  });

  await sendSupportMail({
    to: fromEmail,
    subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`,
    text: decisao.texto,
    inReplyTo: messageId,
    bcc,
  });

  // Só conta DEPOIS de ter mandado: se o SMTP falhou, o cliente não levou
  // recusa nenhuma e não pode ser tratado como reincidente na próxima.
  await registrarRecusa(fromEmail);

  // O time precisa saber que existe material esperando — mesmo sem o anexo,
  // o assunto e o remetente bastam pra ir atrás na caixa do suporte@.
  await encaminharParaRevisao({
    fromEmail,
    subject,
    corpo:
      `(${decisao.motivo} — a Fast não abriu a mensagem; ` +
      `o e-mail original está na caixa do suporte@, uid ${mail.uid})`,
    motivo: decisao.motivo,
  });

  if (decisao.escalar) {
    // Segunda recusa: a Fast JÁ prometeu resolver e não resolveu. Vira
    // incidente pra cair na aba Falhas, que é a fila que o time trabalha —
    // encaminhar por e-mail sozinho já se provou insuficiente (o caso de
    // 09/09 tinha encaminhamento nas DUAS recusas e ninguém abriu).
    await openIncidentForSentinela(
      fromEmail,
      decisao.motivo,
      `Mensagem de ${sizeBytes} bytes (uid ${mail.uid}) — acima do teto de ${MAIL_MAX_BYTES}. ` +
        `Segunda vez com este remetente: alguém precisa abrir o e-mail dele na caixa do suporte@ e responder na mão.`,
      [],
      false, // atendimento: quem resolve é uma pessoa lendo o e-mail, não código
    );
  }

  await markSeen(mail.uid);
  console.log(
    `[agent/mail] ${decisao.motivo} uid=${mail.uid} de=${fromEmail}` +
      `${decisao.escalar ? " — ESCALADO pra humano" : " — respondido e liberado"}`,
  );
  return decisao.escalar ? "escalated" : "replied";
}

async function respondOne(mail: RawMail, bcc: string[]): Promise<"replied" | "skipped" | "escalated" | "bounce"> {
  const raw = mail.raw;
  const fromHeader = header(raw, "From");
  const fromEmail = (fromHeader.match(/<([^>]+)>/)?.[1] ?? fromHeader).trim().toLowerCase();
  const subject = header(raw, "Subject") || "(sem assunto)";
  const messageId = header(raw, "Message-ID") || null;

  // BOUNCE ANTES DE TUDO (#201). A resposta que voltou chega como e-mail comum
  // na INBOX, e os dois filtros seguintes a matavam em silêncio: `SKIP_FROM`
  // casa `mailer-daemon`/`privateemail.com` e o `Auto-Submitted: auto-replied`
  // do relatório casa a regra de auto-submitted. Nos dois casos ia direto pro
  // markSeen sem ninguém olhar — 21 bounces em 23 dias, nenhum tratado.
  //
  // Fica acima do ramo `oversized` de propósito: bounce carrega a mensagem
  // original anexada e pode passar do teto. Truncado ele ainda serve, porque
  // o destinatário que falhou vem no cabeçalho (X-Failed-Recipients).
  const bounce = await tratarSeForBounce(raw);
  if (bounce) {
    await markSeen(mail.uid);
    // "atraso" e bounce de cópia interna não são silêncio de aluno: contam
    // como skipped pra métrica não inflar e ninguém achar que 5 alunos
    // ficaram sem resposta quando o servidor só ia tentar de novo.
    return bounce.tipo === "falha" && bounce.alunos.length > 0 ? "bounce" : "skipped";
  }

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

  // O aluno respondeu: traz de volta o que estava "aguardando o aluno".
  // Vem ANTES de gerar a resposta — se a Fast resolver sozinha, o time ainda
  // precisa ver que ele voltou a falar (foi assim que a resposta do Luciano
  // caiu no vazio 2h17 depois do fechamento, chamado #95).
  void reabrirPorRespostaDoAluno({ email: fromEmail, trecho: text });

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
  // TODA escalação abre incidente — técnica ou não (19/08).
  //
  // Antes era `reason && technical`: quando a Fast escalava algo que ela não
  // classificava como técnico (cobrança, cancelamento, reembolso, dúvida de
  // conta), não acontecia NADA além de um console.log. Nenhum incidente,
  // ninguém avisado — só que a Fast já tinha dito ao aluno "a equipe vai
  // verificar". A pessoa ficava esperando uma equipe que nunca soube dela.
  // Foi o caso da Viviana, e ela voltou brava com razão.
  //
  // Se a Fast decidiu escalar, é porque ela não resolveu. O que muda entre
  // técnico e não-técnico é o RÓTULO do incidente, nunca a existência dele.
  if (reason) {
    try {
      // O print é a prova: guarda ANTES de abrir o incidente.
      const prints = await guardarPrints(mail.raw, { fromEmail, uid: mail.uid });
      const numero = await openIncidentForSentinela(fromEmail, reason, text, prints, technical);
      // ATENDIMENTO = precisa de gente, não de código (#82, Johnny 24/08):
      // avisa o grupo e FECHA — a responsabilidade é do time, não do quadro.
      if (numero != null && !technical) {
        await entregarAoTime({ numero, canal: "e-mail", aluno: fromEmail, resumo: reason, texto: text });
      }
    } catch (e) {
      console.error("[agent/mail] falha ao abrir incidente:", e instanceof Error ? e.message : e);
    }
  }
  await markSeen(mail.uid);
  console.log(
    `[agent/mail] respondido uid=${mail.uid} para=${fromEmail}${reason ? (technical ? " (INCIDENTE técnico)" : " (INCIDENTE atendimento)") : ""}`,
  );
  return reason ? "escalated" : "replied";
}

/** Uma varredura completa (chamada pelo cron). Best-effort por mensagem. */
export async function sweepSupportMail(): Promise<MailSweepSummary> {
  const summary: MailSweepSummary = { scanned: 0, replied: 0, skipped: 0, escalated: 0, errors: 0, bounces: 0 };
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
      else if (outcome === "bounce") summary.bounces += 1;
      else summary.skipped += 1;
    } catch (e) {
      // NÃO marca como lida — tenta de novo na próxima varredura.
      summary.errors += 1;
      console.error(`[agent/mail] falha uid=${mail.uid}:`, e instanceof Error ? e.message : e);
    }
  }
  return summary;
}
