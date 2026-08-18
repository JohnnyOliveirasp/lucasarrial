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
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");

  const smtp = new Smtp();
  await smtp.conectar();
  await smtp.enviar(USER, destinos, mensagem);
  console.log(`✅ enviado para ${dest}${bcc ? ` (bcc ${bcc})` : ""}`);
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
