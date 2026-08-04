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

  /** Espera o buffer casar com o padrão (linha de conclusão do comando). */
  private waitFor(pattern: RegExp, timeoutMs = 30_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const text = this.buffer.toString("latin1");
        if (pattern.test(text)) return resolve(text);
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

  close(): void {
    try {
      this.socket?.write(`a${++this.seq} LOGOUT\r\n`);
      this.socket?.end();
    } catch {
      /* já caiu */
    }
  }
}

export type RawMail = { uid: number; raw: string };

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

    const out: RawMail[] = [];
    for (const uid of uids) {
      const buf = await session.commandRaw(`UID FETCH ${uid} BODY.PEEK[]`);
      const text = buf.toString("latin1");
      // Literal IMAP: ... BODY[] {N}\r\n<N bytes>
      const m = text.match(/\{(\d+)\}\r\n/);
      if (!m || m.index === undefined) continue;
      const start = m.index + m[0].length;
      const size = Number(m[1]);
      out.push({ uid, raw: buf.subarray(start, start + size).toString("latin1") });
    }
    return out;
  } finally {
    session.close();
  }
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
