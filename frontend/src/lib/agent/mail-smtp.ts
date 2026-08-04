/**
 * Envio SMTP mínimo (TLS 465, zero dependências) pela caixa suporte@ do
 * Private Email — assim a resposta da Fast sai DO MESMO endereço que o aluno
 * escreveu (SPF/DKIM do domínio já apontam pra lá; Resend fica só pros
 * transacionais internos).
 */
import tls from "node:tls";

const HOST = () => process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = () => process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const PASS = () => process.env.SUPPORT_MAIL_PASSWORD || "";

function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}

/** Assunto com acento vira encoded-word (RFC 2047). */
function encodeHeader(s: string): string {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
}

type SmtpReply = { code: number; text: string };

class SmtpSession {
  private socket: tls.TLSSocket | null = null;
  private pending = "";

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const s = tls.connect({ host: HOST(), port: 465, servername: HOST() }, () => resolve());
      s.on("error", reject);
      s.setTimeout(30_000, () => {
        s.destroy();
        reject(new Error("SMTP timeout"));
      });
      s.on("data", (chunk: Buffer) => {
        this.pending += chunk.toString("utf8");
      });
      this.socket = s;
    });
    await this.read(); // greeting 220
  }

  /** Lê até a última linha de resposta (código sem hífen de continuação). */
  private read(timeoutMs = 30_000): Promise<SmtpReply> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const m = this.pending.match(/^(\d{3}) [^\r\n]*\r?\n?$/m);
        if (m) {
          const reply = { code: Number(m[1]), text: this.pending };
          this.pending = "";
          return resolve(reply);
        }
        if (Date.now() - started > timeoutMs) return reject(new Error("SMTP resposta demorou"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  async send(line: string, expect: number): Promise<void> {
    if (!this.socket) throw new Error("SMTP sem conexão");
    this.socket.write(`${line}\r\n`);
    const reply = await this.read();
    if (reply.code !== expect) {
      throw new Error(`SMTP "${line.split(" ")[0]}" → ${reply.code} (esperava ${expect})`);
    }
  }

  async data(message: string): Promise<void> {
    if (!this.socket) throw new Error("SMTP sem conexão");
    this.socket.write("DATA\r\n");
    const go = await this.read();
    if (go.code !== 354) throw new Error(`SMTP DATA → ${go.code}`);
    // Dot-stuffing + terminador.
    const body = message.replace(/\r?\n/g, "\r\n").replace(/\r\n\./g, "\r\n..");
    this.socket.write(`${body}\r\n.\r\n`);
    const done = await this.read(60_000);
    if (done.code !== 250) throw new Error(`SMTP envio → ${done.code}`);
  }

  close(): void {
    try {
      this.socket?.write("QUIT\r\n");
      this.socket?.end();
    } catch {
      /* já caiu */
    }
  }
}

export type SupportMailArgs = {
  to: string;
  subject: string;
  text: string;
  /** Message-ID do e-mail respondido (threading no cliente do aluno). */
  inReplyTo?: string | null;
  /** Cópias ocultas (admins acompanham cada resposta da Fast). */
  bcc?: string[];
};

/** Envia texto puro como suporte@fastcloner.com. Lança em falha (caller trata). */
export async function sendSupportMail(args: SupportMailArgs): Promise<void> {
  if (!PASS()) throw new Error("SUPPORT_MAIL_PASSWORD ausente");
  const session = new SmtpSession();
  await session.connect();
  try {
    await session.send(`EHLO fastcloner.com`, 250);
    await session.send("AUTH LOGIN", 334);
    await session.send(b64(USER()), 334);
    await session.send(b64(PASS()), 235);
    await session.send(`MAIL FROM:<${USER()}>`, 250);
    const rcpts = [args.to, ...(args.bcc ?? [])];
    for (const r of rcpts) await session.send(`RCPT TO:<${r}>`, 250);

    const headers = [
      `From: Fast - FastCloner <${USER()}>`,
      `To: ${args.to}`,
      `Subject: ${encodeHeader(args.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <fast-${Date.now()}-${Math.random().toString(36).slice(2)}@fastcloner.com>`,
      ...(args.inReplyTo ? [`In-Reply-To: ${args.inReplyTo}`, `References: ${args.inReplyTo}`] : []),
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: base64",
    ].join("\r\n");
    // Corpo em base64 quebrado a 76 colunas (padrão MIME).
    const body = b64(args.text).replace(/(.{76})/g, "$1\r\n");
    await session.data(`${headers}\r\n\r\n${body}`);
  } finally {
    session.close();
  }
}
