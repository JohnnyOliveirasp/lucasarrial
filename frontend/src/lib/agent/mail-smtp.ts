/**
 * Envio SMTP mínimo (porta 587 + STARTTLS, zero dependências) pela caixa
 * suporte@ do Private Email — a resposta da Fast sai DO MESMO endereço que o
 * aluno escreveu. ⚠️ Hetzner BLOQUEIA a 465 (implicit TLS); a 587 é aberta —
 * por isso o fluxo é: conexão plana → EHLO → STARTTLS → TLS → AUTH.
 */
import net from "node:net";
import tls from "node:tls";
import { appendToSentFolder } from "./mail-imap";

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

class SmtpSession {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private pending = "";

  private attach(socket: net.Socket | tls.TLSSocket): void {
    this.socket = socket;
    socket.setTimeout(30_000, () => socket.destroy(new Error("SMTP timeout")));
    socket.on("data", (chunk: Buffer) => {
      this.pending += chunk.toString("utf8");
    });
  }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const s = net.connect({ host: HOST(), port: 587 }, () => resolve());
      s.on("error", reject);
      this.attach(s);
    });
    await this.expect(220); // greeting
  }

  /** Sobe a conexão pra TLS depois do STARTTLS (mesmo socket, novo canal). */
  async upgradeTls(): Promise<void> {
    const plain = this.socket as net.Socket;
    plain.removeAllListeners("data");
    await new Promise<void>((resolve, reject) => {
      const secure = tls.connect({ socket: plain, servername: HOST() }, () => resolve());
      secure.on("error", reject);
      this.attach(secure);
    });
  }

  /** Lê até a última linha da resposta (código sem hífen de continuação). */
  private read(timeoutMs = 30_000): Promise<number> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const m = this.pending.match(/^(\d{3}) [^\r\n]*\r?\n?$/m);
        if (m) {
          this.pending = "";
          return resolve(Number(m[1]));
        }
        if (Date.now() - started > timeoutMs) return reject(new Error("SMTP resposta demorou"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  private async expect(code: number): Promise<void> {
    const got = await this.read();
    if (got !== code) throw new Error(`SMTP esperava ${code}, veio ${got}`);
  }

  async send(line: string, expect: number): Promise<void> {
    if (!this.socket) throw new Error("SMTP sem conexão");
    this.socket.write(`${line}\r\n`);
    const got = await this.read();
    if (got !== expect) {
      throw new Error(`SMTP "${line.split(" ")[0]}" → ${got} (esperava ${expect})`);
    }
  }

  async data(message: string): Promise<void> {
    if (!this.socket) throw new Error("SMTP sem conexão");
    this.socket.write("DATA\r\n");
    const go = await this.read();
    if (go !== 354) throw new Error(`SMTP DATA → ${go}`);
    // Dot-stuffing + terminador.
    const body = message.replace(/\r?\n/g, "\r\n").replace(/\r\n\./g, "\r\n..");
    this.socket.write(`${body}\r\n.\r\n`);
    const done = await this.read(60_000);
    if (done !== 250) throw new Error(`SMTP envio → ${done}`);
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
  /**
   * Para onde vai a resposta de quem receber (Reply-To). Usado quando a Fast
   * ENCAMINHA o caso de um aluno pro time: quem abrir responde direto pra ele,
   * sem ter que copiar e colar endereço.
   */
  replyTo?: string | null;
};

/** Envia texto puro como suporte@fastcloner.com. Lança em falha (caller trata). */
export async function sendSupportMail(args: SupportMailArgs): Promise<void> {
  if (!PASS()) throw new Error("SUPPORT_MAIL_PASSWORD ausente");

  // A mensagem é montada ANTES do envio pra mesma cópia byte a byte ir depois
  // pra pasta de enviados (auditoria: "esse aluno já foi avisado?").
  const headers = [
    `From: Fast - FastCloner <${USER()}>`,
    `To: ${args.to}`,
    `Subject: ${encodeHeader(args.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <fast-${Date.now()}-${Math.random().toString(36).slice(2)}@fastcloner.com>`,
    ...(args.inReplyTo ? [`In-Reply-To: ${args.inReplyTo}`, `References: ${args.inReplyTo}`] : []),
    ...(args.replyTo ? [`Reply-To: ${args.replyTo}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
  ].join("\r\n");
  // Corpo em base64 quebrado a 76 colunas (padrão MIME).
  const body = b64(args.text).replace(/(.{76})/g, "$1\r\n");
  const message = `${headers}\r\n\r\n${body}`;

  const session = new SmtpSession();
  await session.connect();
  try {
    await session.send("EHLO fastcloner.com", 250);
    await session.send("STARTTLS", 220);
    await session.upgradeTls();
    await session.send("EHLO fastcloner.com", 250);
    await session.send("AUTH LOGIN", 334);
    await session.send(b64(USER()), 334);
    await session.send(b64(PASS()), 235);
    await session.send(`MAIL FROM:<${USER()}>`, 250);
    const rcpts = [args.to, ...(args.bcc ?? [])];
    for (const r of rcpts) await session.send(`RCPT TO:<${r}>`, 250);
    await session.data(message);
  } finally {
    session.close();
  }

  // O e-mail JÁ FOI ENTREGUE. Gravar a cópia em enviados é best-effort: a
  // caixa Sent estava VAZIA (achado 19/08) e sem cópia ninguém audita o que a
  // Fast respondeu — mas falhar AQUI depois do envio seria pior (o caller
  // trataria como "não enviado" e reenviaria pro aluno). Loga e segue.
  try {
    await appendToSentFolder(message);
  } catch (e) {
    console.error(
      `[agent/mail-smtp] enviado para ${args.to}, mas falhou ao gravar cópia em enviados:`,
      e instanceof Error ? e.message : e,
    );
  }
}
