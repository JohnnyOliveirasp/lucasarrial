/**
 * Cliente IMAP mínimo (TLS puro, zero dependências — padrão do projeto de
 * falar protocolo na mão, igual Resend/RunPod via REST).
 *
 * Só o que a Fast precisa: listar NÃO LIDOS do INBOX, baixar a mensagem
 * crua e marcar como lida. Servidor: Namecheap Private Email (suporte@).
 *
 * Envs: SUPPORT_MAIL_HOST (default mail.privateemail.com) ·
 * SUPPORT_MAIL_USER (default suporte@fastcloner.com) · SUPPORT_MAIL_PASSWORD.
 */
import tls from "node:tls";
import { header, mailText } from "./mail-charset";

const HOST = () => process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = () => process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const PASS = () => process.env.SUPPORT_MAIL_PASSWORD || "";

export function supportMailConfigured(): boolean {
  return Boolean(PASS());
}

/** Sessão IMAP: comandos sequenciais com tag, resposta acumulada em Buffer. */
class ImapSession {
  private socket: tls.TLSSocket | null = null;
  private buffer = Buffer.alloc(0);
  private seq = 0;

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const s = tls.connect({ host: HOST(), port: 993, servername: HOST() }, () => resolve());
      s.on("error", reject);
      s.setTimeout(30_000, () => {
        s.destroy();
        reject(new Error("IMAP timeout"));
      });
      s.on("data", (chunk: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
      });
      this.socket = s;
    });
    await this.waitFor(/^\* OK/m); // greeting
  }

  /**
   * Espera o buffer casar com o padrão (linha de conclusão do comando).
   *
   * ⚠️ Só olha o FIM do buffer. A versão antiga convertia o buffer inteiro em
   * texto a cada 50ms: com uma mensagem de 33MB na caixa (aconteceu em 08/08),
   * eram 33MB moídos 20 vezes por segundo — a checagem ficava mais lenta que a
   * chegada dos dados e o timeout estourava SEMPRE. A Fast ficou 2 dias muda
   * por causa disso, tentando a mesma mensagem de 5 em 5 minutos.
   */
  private waitFor(pattern: RegExp, timeoutMs = 30_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        // A linha de conclusão está sempre no fim; 4KB cobrem com folga.
        const cauda = this.buffer.subarray(Math.max(0, this.buffer.length - 4096)).toString("latin1");
        if (pattern.test(cauda)) return resolve(this.buffer.toString("latin1"));
        if (Date.now() - started > timeoutMs) return reject(new Error("IMAP resposta demorou"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  /** Executa um comando e devolve a resposta completa (até o tag OK/NO/BAD). */
  async command(cmd: string): Promise<string> {
    if (!this.socket) throw new Error("IMAP sem conexão");
    const tag = `a${++this.seq}`;
    this.buffer = Buffer.alloc(0);
    this.socket.write(`${tag} ${cmd}\r\n`);
    const res = await this.waitFor(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) {
      throw new Error(`IMAP ${cmd.split(" ")[0]} falhou: ${res.slice(-200)}`);
    }
    return res;
  }

  /** Como command(), mas devolve o Buffer cru (pra literais binários). */
  async commandRaw(cmd: string): Promise<Buffer> {
    await this.command(cmd);
    return this.buffer;
  }

  /**
   * APPEND: grava uma mensagem crua numa pasta (usado pra copiar o que a gente
   * ENVIA pra pasta de enviados — sem isso a caixa Sent fica vazia e ninguém
   * consegue responder "esse aluno já foi avisado?", achado de 19/08).
   *
   * Protocolo: o literal `{N}` exige esperar a continuação `+` do servidor
   * antes de mandar os bytes — mandar direto quebra em servidor sem LITERAL+.
   */
  async append(mailbox: string, flags: string, data: Buffer): Promise<void> {
    if (!this.socket) throw new Error("IMAP sem conexão");
    const tag = `a${++this.seq}`;
    this.buffer = Buffer.alloc(0);
    this.socket.write(`${tag} APPEND "${mailbox}" (${flags}) {${data.length}}\r\n`);
    // Ou o servidor pede continuação ("+ ...") ou já recusa com o tag.
    const go = await this.waitFor(new RegExp(`(^\\+|^${tag} (OK|NO|BAD))`, "m"));
    if (new RegExp(`^${tag} (NO|BAD)`, "m").test(go)) {
      throw new Error(`IMAP APPEND recusado: ${go.slice(-200)}`);
    }
    this.buffer = Buffer.alloc(0);
    this.socket.write(data);
    this.socket.write("\r\n");
    const res = await this.waitFor(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) {
      throw new Error(`IMAP APPEND falhou: ${res.slice(-200)}`);
    }
  }

  close(): void {
    try {
      this.socket?.write(`a${++this.seq} LOGOUT\r\n`);
      this.socket?.end();
    } catch {
      /* já caiu */
    }
  }
}

export type RawMail = {
  uid: number;
  raw: string;
  /** Mensagem grande demais: só os cabeçalhos foram baixados (ver MAIL_MAX_BYTES). */
  oversized?: boolean;
  /** Tamanho real da mensagem na caixa, em bytes. */
  sizeBytes?: number;
};

/**
 * Teto do que a gente aceita baixar de uma mensagem.
 *
 * A caixa do suporte não é canal de arquivo: um e-mail de 33MB (aluno mandando
 * áudio anexado, 08/08) travou a Fast por 2 dias — ela tentava baixar o mesmo
 * anexo a cada 5 minutos e nunca chegava nos e-mails seguintes da fila.
 * Acima deste teto a gente lê só os cabeçalhos, responde explicando que a
 * caixa não recebe anexo, e segue a vida.
 */
const MAIL_MAX_BYTES = Number(process.env.AGENT_MAIL_MAX_BYTES ?? 2_000_000);

/**
 * Busca os e-mails NÃO LIDOS do INBOX (até `limit`), SEM marcar como lidos
 * (BODY.PEEK). Marcação é passo separado — só depois de responder com sucesso.
 *
 * AGENT_MAIL_SINCE (ex.: "4-Aug-2026") limita ao que chegou DEPOIS da
 * ativação — o backlog antigo (já resolvido/estale) fica pro fluxo humano.
 */
export async function fetchUnseen(limit = 10): Promise<RawMail[]> {
  const session = new ImapSession();
  await session.connect();
  try {
    // LOGIN com literal não é preciso: senha sem aspas problemáticas → quoted.
    await session.command(`LOGIN "${USER()}" "${PASS().replace(/(["\\])/g, "\\$1")}"`);
    await session.command("SELECT INBOX");
    const since = (process.env.AGENT_MAIL_SINCE || "").trim();
    const search = await session.command(
      since ? `UID SEARCH UNSEEN SINCE ${since}` : "UID SEARCH UNSEEN",
    );
    const uids = (search.match(/^\* SEARCH([\d ]*)$/m)?.[1] ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .slice(0, limit);

    // PERGUNTA O TAMANHO ANTES de baixar qualquer coisa. Sem isso, uma única
    // mensagem gigante trava a fila inteira (incidente de 08/08).
    const tamanhos = new Map<number, number>();
    if (uids.length) {
      const info = await session.command(`UID FETCH ${uids.join(",")} (RFC822.SIZE)`);
      for (const linha of info.split(/\r?\n/)) {
        const m = linha.match(/UID (\d+).*RFC822\.SIZE (\d+)|RFC822\.SIZE (\d+).*UID (\d+)/);
        if (!m) continue;
        const uid = Number(m[1] ?? m[4]);
        const size = Number(m[2] ?? m[3]);
        if (uid && size) tamanhos.set(uid, size);
      }
    }

    const out: RawMail[] = [];
    for (const uid of uids) {
      const tamanho = tamanhos.get(uid) ?? 0;

      if (tamanho > MAIL_MAX_BYTES) {
        // Só os cabeçalhos: dá pra saber quem escreveu e sobre o quê, sem
        // arrastar o anexo. Quem responde decide o que fazer (ver mail-respond).
        //
        // X-FAILED-RECIPIENTS entrou na lista por causa do #201: bounce carrega
        // a mensagem original anexada e pode passar do teto. Sem esse cabeçalho
        // o bounce truncado não diz PARA QUEM a entrega falhou — a triagem
        // morreria justamente no dado que a torna útil.
        const bufH = await session.commandRaw(
          `UID FETCH ${uid} BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID REPLY-TO X-FAILED-RECIPIENTS)]`,
        );
        const raw = extrairLiteral(bufH);
        out.push({ uid, raw, oversized: true, sizeBytes: tamanho });
        continue;
      }

      const buf = await session.commandRaw(`UID FETCH ${uid} BODY.PEEK[]`);
      const raw = extrairLiteral(buf);
      if (raw) out.push({ uid, raw, sizeBytes: tamanho });
    }
    return out;
  } finally {
    session.close();
  }
}

/** Conteúdo do literal IMAP da resposta: `... {N}\r\n<N bytes>`. */
function extrairLiteral(buf: Buffer): string {
  const cabeca = buf.subarray(0, 4096).toString("latin1");
  const m = cabeca.match(/\{(\d+)\}\r\n/);
  if (!m || m.index === undefined) return "";
  const start = m.index + m[0].length;
  return buf.subarray(start, start + Number(m[1])).toString("latin1");
}

/** Marca uma mensagem como lida (a Fast processou — não reprocessar). */
export async function markSeen(uid: number): Promise<void> {
  const session = new ImapSession();
  await session.connect();
  try {
    await session.command(`LOGIN "${USER()}" "${PASS().replace(/(["\\])/g, "\\$1")}"`);
    await session.command("SELECT INBOX");
    await session.command(`UID STORE ${uid} +FLAGS (\\Seen)`);
  } finally {
    session.close();
  }
}

/**
 * Descobre o nome da pasta de enviados pelo atributo \Sent do LIST — o nome
 * MUDA por servidor ("INBOX.Sent", "Sent", "Sent Items"...), então nome fixo
 * quebra em silêncio (mesma lição do --enviados do ler_caixa.cjs). Cacheado
 * por processo: a pasta não muda entre um envio e outro.
 */
let sentFolderCache: string | null = null;

async function discoverSentFolder(session: ImapSession): Promise<string> {
  if (sentFolderCache) return sentFolderCache;
  const linhas = (await session.command(`LIST "" "*"`))
    .split(/\r?\n/)
    .filter((l) => l.startsWith("* LIST"));
  const nome = (l: string): string =>
    l.match(/"([^"]*)"\s*$/)?.[1] || l.trim().split(/\s+/).pop() || "";
  const porAtributo = linhas.find((l) => /\\Sent/i.test(l));
  const achado = porAtributo
    ? nome(porAtributo)
    : ["INBOX.Sent", "Sent", "Sent Items", "INBOX.Sent Items"].find((c) =>
        linhas.some((l) => nome(l).toLowerCase() === c.toLowerCase()),
      );
  if (!achado) {
    throw new Error(`pasta de enviados não encontrada. Caixas: ${linhas.map(nome).join(", ")}`);
  }
  sentFolderCache = achado;
  return achado;
}

/**
 * Grava a cópia de um e-mail ENVIADO na pasta de enviados (\Seen, pra não
 * inflar contador de não-lido). Chamado pelo mail-smtp DEPOIS do envio — quem
 * chama trata falha como aviso, nunca como erro do envio (o e-mail já saiu).
 */
export async function appendToSentFolder(rawMessage: string): Promise<void> {
  const session = new ImapSession();
  await session.connect();
  try {
    await session.command(`LOGIN "${USER()}" "${PASS().replace(/(["\\])/g, "\\$1")}"`);
    const folder = await discoverSentFolder(session);
    // CRLF obrigatório no literal IMAP (mesma normalização do envio SMTP).
    const data = Buffer.from(rawMessage.replace(/\r?\n/g, "\r\n"), "utf8");
    await session.append(folder, "\\Seen", data);
  } finally {
    session.close();
  }
}

/**
 * Uma mensagem do fio, já em texto. É o que a Fast precisa pra saber o que a
 * casa já disse — não é a mensagem inteira nem pretende ser.
 */
export type ThreadMail = {
  /** Message-ID normalizado (minúsculo, entre <>): é como o fio se dedupica. */
  messageId: string;
  /** true = escrita pela casa (pasta de enviados). */
  from_me: boolean;
  /** Date: do cabeçalho, em ms. 0 quando o cabeçalho veio ilegível. */
  date: number;
  subject: string;
  text: string;
};

/** Quantas mensagens do fio (somando os dois lados) no máximo. */
const THREAD_LIMIT = Number(process.env.AGENT_MAIL_THREAD_LIMIT ?? 6);
/**
 * Teto por mensagem do FIO — muito menor que o `MAIL_MAX_BYTES` da fila.
 * Aqui a mensagem é só contexto: um anexo antigo de 2MB baixado a cada
 * resposta pagaria o preço do incidente de 08/08 (fila travada) sem nenhum
 * ganho, porque o anexo não vira texto pro cérebro de qualquer jeito.
 */
const THREAD_MAX_BYTES = Number(process.env.AGENT_MAIL_THREAD_MAX_BYTES ?? 200_000);
/** Corte do texto de CADA mensagem antiga (a atual vai inteira, em outro lugar). */
const THREAD_MAX_CHARS = Number(process.env.AGENT_MAIL_THREAD_MAX_CHARS ?? 1500);

/** Endereço dentro de aspas de comando IMAP. */
function citar(v: string): string {
  return v.replace(/(["\\])/g, "\\$1");
}

/** Message-ID comparável: minúsculo e sempre entre <>. Vazio quando não há. */
function chaveDeMensagem(raw: string): string {
  const bruto = header(raw, "Message-ID").trim().toLowerCase();
  if (!bruto) return "";
  return bruto.startsWith("<") ? bruto : `<${bruto}>`;
}

/**
 * Lê as últimas mensagens TROCADAS com um endereço: o que ele mandou (INBOX) e
 * o que a casa respondeu (pasta de enviados).
 *
 * POR QUE ISTO EXISTE (#387). O e-mail era o único canal que respondia sem
 * histórico nenhum: `mail-respond` montava um array de UMA mensagem — a que
 * acabara de chegar — enquanto WhatsApp e chat do app carregam a conversa do
 * banco. Por e-mail não há banco pra ler (não existe tabela com o CORPO do que
 * foi enviado; `emails_enviados` guarda assunto e origem, e sua migration 108
 * nem foi aplicada), mas a conversa existe inteira na própria caixa: INBOX
 * de um lado, pasta de enviados do outro. É de lá que ela vem.
 *
 * Só leitura: BODY.PEEK em toda busca, nenhuma flag muda. Quem chama trata
 * falha como "sem histórico" e responde assim mesmo — perder o fio é ruim,
 * deixar o aluno sem resposta é pior.
 */
export async function fetchThread(email: string, limit = THREAD_LIMIT): Promise<ThreadMail[]> {
  const alvo = email.trim().toLowerCase();
  if (!alvo.includes("@")) return [];

  const session = new ImapSession();
  await session.connect();
  try {
    await session.command(`LOGIN "${citar(USER())}" "${citar(PASS())}"`);
    const enviados = await discoverSentFolder(session);
    const since = (process.env.AGENT_MAIL_SINCE || "").trim();
    const sinceSql = since ? ` SINCE ${since}` : "";

    const out: ThreadMail[] = [];
    const lados: { caixa: string; criterio: string; from_me: boolean }[] = [
      { caixa: "INBOX", criterio: `FROM "${citar(alvo)}"`, from_me: false },
      { caixa: enviados, criterio: `TO "${citar(alvo)}"`, from_me: true },
    ];

    for (const lado of lados) {
      await session.command(`SELECT "${citar(lado.caixa)}"`);
      const busca = await session.command(`UID SEARCH ${lado.criterio}${sinceSql}`);
      // UID crescente = ordem de chegada: os últimos são os mais recentes.
      const uids = (busca.match(/^\* SEARCH([\d ]*)$/m)?.[1] ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(Number)
        .slice(-limit);
      if (!uids.length) continue;

      // Mesma disciplina da fila: pergunta o tamanho ANTES de baixar.
      const tamanhos = new Map<number, number>();
      const info = await session.command(`UID FETCH ${uids.join(",")} (RFC822.SIZE)`);
      for (const linha of info.split(/\r?\n/)) {
        const m = linha.match(/UID (\d+).*RFC822\.SIZE (\d+)|RFC822\.SIZE (\d+).*UID (\d+)/);
        if (!m) continue;
        const uid = Number(m[1] ?? m[4]);
        const size = Number(m[2] ?? m[3]);
        if (uid && size) tamanhos.set(uid, size);
      }

      for (const uid of uids) {
        if ((tamanhos.get(uid) ?? 0) > THREAD_MAX_BYTES) continue; // contexto não paga anexo
        const buf = await session.commandRaw(`UID FETCH ${uid} BODY.PEEK[]`);
        const raw = extrairLiteral(buf);
        if (!raw) continue;
        const text = mailText(raw, THREAD_MAX_CHARS).trim();
        if (!text) continue;
        const quando = Date.parse(header(raw, "Date"));
        out.push({
          messageId: chaveDeMensagem(raw),
          from_me: lado.from_me,
          date: Number.isFinite(quando) ? quando : 0,
          subject: header(raw, "Subject"),
          text,
        });
      }
    }

    // Cronológico: é assim que vira conversa. Sem Date legível (0) a mensagem
    // vai pro começo, que é o lugar menos danoso pra uma data desconhecida.
    out.sort((a, b) => a.date - b.date);
    return out.slice(-limit);
  } finally {
    session.close();
  }
}
