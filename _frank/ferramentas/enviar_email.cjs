/**
 * ENVIAR E-MAIL PRO ALUNO — Node puro, roda em qualquer sistema, direto da
 * máquina do Frank (não precisa de servidor, bash nem curl).
 *
 * Fala SMTP na mão (mesma receita do lib/agent/mail-smtp.ts que a Fast usa):
 * porta 587 + STARTTLS + AUTH PLAIN. A 465 está bloqueada no Hetzner.
 *
 * ⚠️ NUNCA use Resend pra falar com aluno: chega como "AI Clone Verse"
 * (domínio antigo) e queima a confiança — já aconteceu na frente de cliente.
 *
 *   node _frank/ferramentas/enviar_email.cjs aluno@x.com "Assunto" corpo.html
 *   node _frank/ferramentas/enviar_email.cjs aluno@x.com "Assunto" corpo.html --bcc suporte@lucasarrial.com
 *   node _frank/ferramentas/enviar_email.cjs aluno@x.com "Assunto" corpo.html --dry-run
 *
 * --dry-run é o ENSAIO: imprime destinatário, remetente, assunto, bcc e o
 * corpo inteiro SEM enviar nada. E-mail não tem desfazer — destinatário
 * errado já chegou na caixa da pessoa. Ensaie antes.
 *
 * Teste SEMPRE mandando pra você mesmo antes de mandar pro aluno.
 */
const fs = require("node:fs");
const net = require("node:net");
const tls = require("node:tls");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

// Separa flags dos posicionais pra --dry-run/--bcc funcionarem em qualquer posição.
const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
let bcc = null;
const posicionais = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--dry-run") continue;
  if (argv[i] === "--bcc") {
    bcc = argv[i + 1] || null;
    i++;
    continue;
  }
  posicionais.push(argv[i]);
}
const [dest, assunto, arquivo] = posicionais;

if (!dest || !assunto || !arquivo) {
  console.error('uso: node enviar_email.cjs <destino> "<assunto>" <corpo.html> [--bcc <email>] [--dry-run]');
  process.exit(1);
}

const HOST = process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const PASS = process.env.SUPPORT_MAIL_PASSWORD || "";
if (!PASS) {
  console.error("SUPPORT_MAIL_PASSWORD ausente no frontend/.env.local");
  process.exit(1);
}

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
/** Assunto com acento precisa virar encoded-word (RFC 2047). */
const cabecalho = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

class Smtp {
  constructor() {
    this.socket = null;
    this.buffer = "";
  }
  attach(socket) {
    this.socket = socket;
    socket.setTimeout(30000, () => socket.destroy(new Error("SMTP timeout")));
    socket.on("data", (c) => (this.buffer += c.toString("utf8")));
  }
  ler(timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        const m = this.buffer.match(/^(\d{3}) [^\r\n]*\r?\n?$/m);
        if (m) {
          this.buffer = "";
          return resolve(Number(m[1]));
        }
        if (Date.now() - t0 > timeoutMs) return reject(new Error("SMTP demorou a responder"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }
  async cmd(linha, esperado) {
    this.socket.write(`${linha}\r\n`);
    const got = await this.ler();
    if (got !== esperado) {
      throw new Error(`SMTP "${linha.split(" ")[0]}" → ${got} (esperava ${esperado})`);
    }
  }
  async conectar() {
    await new Promise((resolve, reject) => {
      const s = net.connect({ host: HOST, port: 587 }, resolve);
      s.on("error", reject);
      this.attach(s);
    });
    if ((await this.ler()) !== 220) throw new Error("SMTP sem saudação");
    await this.cmd(`EHLO ${HOST}`, 250);
    await this.cmd("STARTTLS", 220);
    const plain = this.socket;
    plain.removeAllListeners("data");
    await new Promise((resolve, reject) => {
      const secure = tls.connect({ socket: plain, servername: HOST }, resolve);
      secure.on("error", reject);
      this.attach(secure);
    });
    await this.cmd(`EHLO ${HOST}`, 250);
    await this.cmd(`AUTH PLAIN ${b64(`\0${USER}\0${PASS}`)}`, 235);
  }
  async enviar(de, paraTodos, mensagem) {
    await this.cmd(`MAIL FROM:<${de}>`, 250);
    for (const p of paraTodos) await this.cmd(`RCPT TO:<${p}>`, 250);
    this.socket.write("DATA\r\n");
    if ((await this.ler()) !== 354) throw new Error("SMTP recusou o DATA");
    // Linha que começa com ponto precisa de ponto extra (dot-stuffing).
    const corpo = mensagem.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    this.socket.write(`${corpo}\r\n.\r\n`);
    if ((await this.ler(60000)) !== 250) throw new Error("SMTP recusou a mensagem");
    await this.cmd("QUIT", 221).catch(() => {});
    this.socket.end();
  }
}

/**
 * IMAP mínimo só pro APPEND: depois do envio, grava a cópia na pasta de
 * enviados. Sem isso a Sent fica VAZIA (conferido 19/08) e ninguém consegue
 * responder "esse aluno já foi avisado?" — a resolution_note do caso
 * katiasalvador32 afirmou um envio que ninguém pôde confirmar.
 * Descoberta da pasta = mesma receita do ler_caixa.cjs (atributo \Sent).
 */
class Imap {
  constructor() { this.buf = Buffer.alloc(0); this.seq = 0; this.sock = null; }
  connect() {
    return new Promise((ok, err) => {
      const s = tls.connect({ host: HOST, port: 993, servername: HOST }, () => ok());
      s.on("error", err);
      s.setTimeout(30000, () => { s.destroy(); err(new Error("IMAP timeout")); });
      s.on("data", (c) => { this.buf = Buffer.concat([this.buf, c]); });
      this.sock = s;
    }).then(() => this.wait(/^\* OK/m));
  }
  wait(re, ms = 30000) {
    return new Promise((ok, err) => {
      const t0 = Date.now();
      const tick = () => {
        const cauda = this.buf.subarray(Math.max(0, this.buf.length - 4096)).toString("latin1");
        if (re.test(cauda)) return ok(this.buf.toString("latin1"));
        if (Date.now() - t0 > ms) return err(new Error("IMAP demorou"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }
  async cmd(c) {
    const tag = `a${++this.seq}`;
    this.buf = Buffer.alloc(0);
    this.sock.write(`${tag} ${c}\r\n`);
    const res = await this.wait(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) throw new Error(`IMAP ${c.split(" ")[0]}: ${res.slice(-200)}`);
    return res;
  }
  /** APPEND com literal: espera a continuação "+" antes de mandar os bytes. */
  async append(pasta, mensagem) {
    const data = Buffer.from(mensagem.replace(/\r?\n/g, "\r\n"), "utf8");
    const tag = `a${++this.seq}`;
    this.buf = Buffer.alloc(0);
    this.sock.write(`${tag} APPEND "${pasta}" (\\Seen) {${data.length}}\r\n`);
    const go = await this.wait(new RegExp(`(^\\+|^${tag} (OK|NO|BAD))`, "m"));
    if (new RegExp(`^${tag} (NO|BAD)`, "m").test(go)) throw new Error(`APPEND recusado: ${go.slice(-200)}`);
    this.buf = Buffer.alloc(0);
    this.sock.write(data);
    this.sock.write("\r\n");
    const res = await this.wait(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) throw new Error(`APPEND falhou: ${res.slice(-200)}`);
  }
  close() { try { this.sock.write(`a${++this.seq} LOGOUT\r\n`); this.sock.end(); } catch {} }
}

async function gravarEmEnviados(mensagem) {
  const s = new Imap();
  await s.connect();
  try {
    await s.cmd(`LOGIN "${USER}" "${PASS.replace(/(["\\])/g, "\\$1")}"`);
    // Nome da pasta muda por servidor — descobre pelo atributo \Sent (mesma
    // lógica do ler_caixa.cjs; nome fixo "INBOX.Sent" dava NO neste servidor).
    const linhas = (await s.cmd(`LIST "" "*"`)).split(/\r?\n/).filter((l) => l.startsWith("* LIST"));
    const nome = (l) => l.match(/"([^"]*)"\s*$/)?.[1] || l.trim().split(/\s+/).pop();
    const porAtributo = linhas.find((l) => /\\Sent/i.test(l));
    const achado = porAtributo
      ? nome(porAtributo)
      : ["INBOX.Sent", "Sent", "Sent Items", "INBOX.Sent Items"].find((c) =>
          linhas.some((l) => nome(l)?.toLowerCase() === c.toLowerCase()));
    if (!achado) throw new Error(`pasta de enviados nao encontrada. Caixas: ${linhas.map(nome).join(", ")}`);
    await s.append(achado, mensagem);
  } finally {
    s.close();
  }
}

(async () => {
  const html = fs.readFileSync(path.resolve(arquivo), "utf8");

  if (dryRun) {
    // Ensaio: mostra exatamente o que sairia e para aqui. Nada toca o SMTP.
    console.log("========== MODO SECO — NADA FOI ENVIADO ==========");
    console.log(`Destinatário: ${dest}`);
    console.log(`Remetente:    Fast - FastCloner <${USER}>`);
    console.log(`Assunto:      ${assunto}`);
    if (bcc) console.log(`Bcc:          ${bcc}`);
    console.log("--- CORPO INTEIRO ---");
    console.log(html);
    console.log("--- FIM DO CORPO ---");
    console.log("========== MODO SECO — NADA FOI ENVIADO ==========");
    return;
  }

  const destinos = [dest, ...(bcc ? [bcc] : [])];
  const mensagem = [
    `From: Fast - FastCloner <${USER}>`,
    `To: ${dest}`,
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${cabecalho(assunto)}`,
    // Date/Message-ID: sem eles a cópia gravada em enviados fica sem data e
    // sem identidade — o servidor SMTP até completa em trânsito, mas o APPEND
    // grava a mensagem exatamente como está aqui.
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <frank-${Date.now()}-${Math.random().toString(36).slice(2)}@fastcloner.com>`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    // ⚠️ SEM ESTA LINHA O ALUNO LÊ "vocÃª". Medido em 25/08 no e-mail do
    // Luciano (enviados uid 103): o cabeçalho dizia charset UTF-8, mas o corpo
    // saía em bytes 8-bit CRUS, sem declarar codificação de transferência. O
    // padrão quando este campo falta é 7bit, que proíbe byte acima de 127 —
    // então cada acento vira dois caracteres sujos e sobra pro cliente
    // adivinhar. O mailer da Fast (frontend/src/lib/agent/mail-smtp.ts:141)
    // sempre mandou base64, e por isso na MESMA pasta de enviados os e-mails
    // DELA apareciam limpos e os NOSSOS não. Vale pra todo e-mail que este
    // script mandou pra aluno antes desta data.
    "Content-Transfer-Encoding: base64",
    "",
    // Base64 quebrado em 76 colunas (limite do MIME).
    b64(html).replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");

  const smtp = new Smtp();
  await smtp.conectar();
  await smtp.enviar(USER, destinos, mensagem);
  console.log(`✅ enviado para ${dest}${bcc ? ` (bcc ${bcc})` : ""}`);

  // O e-mail JÁ SAIU — daqui pra baixo é auditoria, nunca pode virar "FALHOU"
  // (o operador reenviaria e o aluno receberia duas vezes).
  try {
    await gravarEmEnviados(mensagem);
    console.log("🗂  cópia gravada na pasta de enviados");
  } catch (e) {
    console.error(`⚠️ e-mail ENVIADO, mas a cópia NÃO foi gravada em enviados: ${e.message}`);
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
