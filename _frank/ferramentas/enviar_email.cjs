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
    // Este servidor derruba conexão sozinho: medido 1 ECONNRESET em 4 conexões
    // em 31/08. No connect a queda já era tratada (a promise rejeita e NADA foi
    // enviado). Depois do connect não havia listener de "error" — e socket sem
    // listener de erro no Node derruba o processo com exceção não tratada, do
    // MEIO do envio, sem dizer se a mensagem passou. Aqui a queda vira erro
    // legível e a ambiguidade fica escrita, porque neste ponto ela é real.
    this.emUso = false;
    socket.on("error", (e) => {
      this.erroSocket = this.emUso
        ? new Error(`conexao caiu NO MEIO DO ENVIO (${e.message}) — NAO REENVIE antes de conferir a caixa do aluno: a mensagem pode ter sido entregue`)
        : e;
    });
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
        if (this.erroSocket) return reject(this.erroSocket);
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
    // A partir daqui uma queda é AMBÍGUA (pode ter entregue). De propósito NÃO
    // existe retentativa automática de envio: repetir um DATA que talvez tenha
    // passado entrega o mesmo e-mail duas vezes ao aluno. Falhar alto e deixar
    // gente decidir é mais barato que dobrar a mensagem.
    this.emUso = true;
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

/** Descobre o nome da pasta de enviados (muda por servidor). */
async function acharPastaEnviados(s) {
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
  return achado;
}

/**
 * Procura a cópia PELO Message-ID. É o que transforma "o APPEND respondeu OK"
 * em prova de que a cópia está lá — e é o que permite retentar sem gravar duas
 * vezes: se a tentativa anterior chegou a gravar antes do socket cair, a busca
 * acha e a gente não faz APPEND de novo.
 * EXAMINE = read-only no protocolo, não mexe em flag nem na fila da Fast.
 */
async function acharCopia(s, pasta, messageId) {
  await s.cmd(`EXAMINE "${pasta}"`);
  const res = await s.cmd(`UID SEARCH HEADER "Message-ID" "${messageId}"`);
  const linha = res.split(/\r?\n/).find((l) => /^\* SEARCH/i.test(l)) || "";
  const uids = linha.replace(/^\* SEARCH/i, "").trim().split(/\s+/).filter(Boolean).map(Number);
  return uids.length ? uids[uids.length - 1] : null;
}

/**
 * Grava a cópia em Enviados e VOLTA COM PROVA (o uid que a busca achou).
 *
 * Por que tem retentativa (incidente #210, medido 2× em 31/08): o APPEND é um
 * único tiro numa conexão TLS que cai sozinha — deu "IMAP timeout" às 13:55Z e
 * "read ECONNRESET" às 15:25Z, com um envio bem-sucedido no meio. Intermitente,
 * não permanente. E a pasta Enviados é a ÚNICA fonte que a ronda seguinte tem
 * pra saber se um aluno já foi respondido: cópia faltando faz a ronda seguinte
 * ler silêncio onde houve resposta, e ou escrever de novo (ruído) ou concluir
 * abandono e refazer trabalho.
 *
 * Cada tentativa abre conexão NOVA de propósito: a falha é de conexão, retentar
 * no mesmo socket morto não teria sentido.
 */
async function gravarEmEnviados(mensagem, messageId, tentativas = 3) {
  const espera = [0, 2000, 5000];
  const erros = [];
  for (let i = 0; i < tentativas; i++) {
    if (espera[i]) await new Promise((r) => setTimeout(r, espera[i]));
    const s = new Imap();
    try {
      await s.connect();
      await s.cmd(`LOGIN "${USER}" "${PASS.replace(/(["\\])/g, "\\$1")}"`);
      const pasta = await acharPastaEnviados(s);

      // A partir da 2ª tentativa, confere ANTES: se a anterior gravou e só o
      // socket caiu depois, um novo APPEND deixaria o aluno com duas cópias no
      // histórico e a próxima ronda contando resposta a mais.
      if (i > 0) {
        const jaEsta = await acharCopia(s, pasta, messageId);
        if (jaEsta) return { uid: jaEsta, tentativa: i + 1, jaEstava: true, erros };
      }

      await s.append(pasta, mensagem);

      // APPEND OK não é prova. Confirma na busca antes de afirmar que gravou —
      // a regra da casa é escrever só o que a fonte confirma DEPOIS de gravar.
      const uid = await acharCopia(s, pasta, messageId);
      if (!uid) throw new Error("APPEND respondeu OK mas a copia nao aparece na busca por Message-ID");
      return { uid, tentativa: i + 1, jaEstava: false, erros };
    } catch (e) {
      erros.push(`tentativa ${i + 1}: ${e.message}`);
    } finally {
      s.close();
    }
  }
  const falha = new Error(erros.join(" · "));
  falha.erros = erros;
  throw falha;
}

/**
 * Último recurso: se as 3 tentativas falharam, o envio NÃO pode virar silêncio.
 * Grava no repositório um registro do que saiu, pra ronda seguinte ter fonte
 * além do IMAP. O `ler_caixa.cjs --enviados --para` lê este arquivo junto.
 * Não guarda o corpo (só o hash) — o que a ronda precisa saber é PARA QUEM,
 * QUANDO e SOBRE O QUÊ, não reler o texto.
 */
function registrarLocal(registro) {
  const destino = path.join(RAIZ, "_frank", "prova", "enviados_local.jsonl");
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.appendFileSync(destino, `${JSON.stringify(registro)}\n`, "utf8");
  return destino;
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
  // O Message-ID sai daqui pra cima porque ele é a CHAVE DA PROVA: é por ele
  // que a gente confirma que a cópia entrou em Enviados e que a retentativa não
  // grava duas vezes.
  const messageId = `<frank-${Date.now()}-${Math.random().toString(36).slice(2)}@fastcloner.com>`;
  const mensagem = [
    `From: Fast - FastCloner <${USER}>`,
    `To: ${dest}`,
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${cabecalho(assunto)}`,
    // Date/Message-ID: sem eles a cópia gravada em enviados fica sem data e
    // sem identidade — o servidor SMTP até completa em trânsito, mas o APPEND
    // grava a mensagem exatamente como está aqui.
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
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
    const prova = await gravarEmEnviados(mensagem, messageId);
    const comoAchou = prova.jaEstava
      ? `já estava lá da tentativa anterior — NÃO gravei de novo`
      : `tentativa ${prova.tentativa}`;
    console.log(`🗂  cópia CONFIRMADA na pasta de enviados: uid ${prova.uid} (${comoAchou})`);
    if (prova.erros.length) console.log(`   (antes falhou: ${prova.erros.join(" · ")})`);
  } catch (e) {
    // As 3 tentativas falharam. O e-mail SAIU — o que faltou foi escrituração.
    // Silenciar aqui é o defeito do #210: a ronda seguinte leria silêncio onde
    // houve resposta. Então registra no repositório e diz onde está.
    const arquivo = registrarLocal({
      at: new Date().toISOString(),
      para: dest,
      bcc: bcc || null,
      assunto,
      message_id: messageId,
      sha256_corpo: require("node:crypto").createHash("sha256").update(html).digest("hex").slice(0, 16),
      enviado: true,
      copia_em_enviados: false,
      motivo: e.message,
    });
    console.error(`⚠️ e-mail ENVIADO, mas a cópia NÃO foi gravada em enviados após 3 tentativas: ${e.message}`);
    console.error(`📓 registrado em ${arquivo} — o ler_caixa.cjs --enviados --para ${dest} vai mostrar este envio.`);
    console.error("   NÃO reenvie por causa disto: o aluno recebeu.");
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
