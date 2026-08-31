/**
 * varrer_bounces.mjs — tria os bounces que JÁ estão na caixa do suporte@.
 * Contexto: chamado #201 (21 bounces de 07/08 a 30/08, nenhum tratado).
 *
 * O conserto no código (mail-bounce.ts + mail-respond.ts) só pega bounce NOVO.
 * Os que já chegaram estão marcados como lidos e não voltam pela varredura —
 * esta ferramenta é como se olha PRA TRÁS, sem tocar em nada.
 *
 * REGRAS INEGOCIÁVEIS (as mesmas do ler_caixa.cjs, pelos mesmos motivos):
 *   1. EXAMINE, nunca SELECT — a caixa é aberta read-only NO PROTOCOLO, então
 *      o servidor recusa alteração de flag mesmo que um comando errado escape.
 *   2. BODY.PEEK[...], nunca BODY[...] — BODY[] marca \Seen de efeito colateral.
 *   3. Zero STORE/EXPUNGE/MOVE/DELETE/APPEND. Lê e sai.
 *   4. Busca SEEN por padrão: o não-lido é a FILA DA FAST e não é assunto
 *      desta ferramenta. (Os 21 bounces do #201 já estão lidos — foi a própria
 *      Fast que os marcou, ao descartá-los como "remetente de sistema".)
 *
 * ⚠️ Esta ferramenta NÃO grava chamado e NÃO manda mensagem. Ela RELATA. O que
 * fazer com o backlog é decisão de quem lê — registrar 21 chamados de uma vez
 * a partir de um script é o tipo de coisa que se faz com aval, não sozinho.
 *
 * A classificação NÃO é reimplementada aqui: importa o mesmo mail-bounce.ts que
 * roda em produção. Duas cópias da mesma regra é como elas divergem em
 * silêncio, e aí o relatório passa a mentir sobre o que a Fast faz de verdade.
 *
 * Uso:
 *   node _frank/ferramentas/varrer_bounces.mjs
 *   node _frank/ferramentas/varrer_bounces.mjs --desde 1-Aug-2026
 *   node _frank/ferramentas/varrer_bounces.mjs --limite 50 --json
 *   node _frank/ferramentas/varrer_bounces.mjs --incluir-nao-lidos   (só leitura, ainda)
 *
 * Credenciais: as MESMAS do mail-imap.ts, de frontend/.env.local. Nada é impresso.
 */
import path from "node:path";
import tls from "node:tls";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..", "..");
const require = createRequire(import.meta.url);
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

// Mesma regra que roda na produção — importada, nunca copiada.
const { parseBounce, ORIENTACAO } = await import(
  path.join(RAIZ, "frontend", "src", "lib", "agent", "mail-bounce.ts")
);

const HOST = process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USUARIO = process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const SENHA = process.env.SUPPORT_MAIL_PASSWORD || "";

/** Endereços nossos — cópia oculta que quicou não é aluno sem resposta. */
const INTERNOS = [
  `@${USUARIO.split("@")[1]}`,
  "@fastcloner.com",
  "@lucasarrial.com",
  "johnny.oliveirasp@gmail.com",
  "lucas.m.arrial@gmail.com",
  ...(process.env.AGENT_MAIL_INTERNAL || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
];

// ---------------------------------------------------------------- argumentos

const argv = process.argv.slice(2);
const opcao = (nome, padrao = null) => {
  const i = argv.indexOf(nome);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : padrao;
};
const temFlag = (nome) => argv.includes(nome);

const LIMITE = Number(opcao("--limite", "200"));
const DESDE = opcao("--desde", null);
const JSON_SAIDA = temFlag("--json");
const INCLUIR_NAO_LIDOS = temFlag("--incluir-nao-lidos");

// ---------------------------------------------------------------- sessão IMAP

/** Comandos que esta ferramenta NUNCA emite. Se aparecer, é bug: morre aqui. */
const PROIBIDOS = /\b(STORE|EXPUNGE|MOVE|DELETE|APPEND|CREATE|RENAME|COPY|SELECT)\b|\bBODY\[/i;

class Sessao {
  constructor() {
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.seq = 0;
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const s = tls.connect({ host: HOST, port: 993, servername: HOST }, () => resolve());
      s.on("error", reject);
      s.setTimeout(30_000, () => {
        s.destroy();
        reject(new Error("IMAP timeout"));
      });
      s.on("data", (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
      });
      this.socket = s;
    });
    await this.waitFor(/^\* OK/m);
  }

  // Só olha o FIM do buffer (lição do incidente de 08/08 — mensagem de 33MB).
  waitFor(pattern, timeoutMs = 30_000) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const cauda = this.buffer.subarray(Math.max(0, this.buffer.length - 4096)).toString("latin1");
        if (pattern.test(cauda)) return resolve(this.buffer.toString("latin1"));
        if (Date.now() - started > timeoutMs) return reject(new Error("IMAP resposta demorou"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  async command(cmd, sensivel = false) {
    if (!this.socket) throw new Error("IMAP sem conexão");
    // TRIPWIRE: nenhum comando de escrita sai daqui. (LOGIN é isento: é seguro
    // por construção e a senha poderia, por azar, conter palavra proibida —
    // e o texto dele nunca pode ir pra mensagem de erro.)
    if (!sensivel && PROIBIDOS.test(cmd)) {
      throw new Error(`comando PROIBIDO nesta ferramenta (só leitura): ${cmd.split(" ").slice(0, 3).join(" ")}`);
    }
    const tag = `a${++this.seq}`;
    this.buffer = Buffer.alloc(0);
    this.socket.write(`${tag} ${cmd}\r\n`);
    const res = await this.waitFor(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) {
      throw new Error(`IMAP ${sensivel ? "LOGIN" : cmd.split(" ")[0]} falhou: ${res.slice(-200)}`);
    }
    return res;
  }

  close() {
    try {
      this.socket?.write(`a${++this.seq} LOGOUT\r\n`);
      this.socket?.end();
    } catch {
      /* já caiu */
    }
  }
}

/** Conteúdo do literal IMAP: `... {N}\r\n<N bytes>`. */
function extrairLiteral(texto) {
  const m = texto.match(/\{(\d+)\}\r\n/);
  if (!m) return "";
  const inicio = m.index + m[0].length;
  return texto.slice(inicio, inicio + Number(m[1]));
}

// ---------------------------------------------------------------- varredura

async function principal() {
  if (!SENHA) {
    console.error("SUPPORT_MAIL_PASSWORD ausente em frontend/.env.local — nada a fazer.");
    process.exit(1);
  }

  const s = new Sessao();
  await s.connect();
  try {
    await s.command(`LOGIN "${USUARIO}" "${SENHA.replace(/(["\\])/g, "\\$1")}"`, true);
    // EXAMINE = read-only no protocolo. A defesa que não depende de atenção.
    await s.command("EXAMINE INBOX");

    // OR em IMAP é prefixado e binário: `OR OR k1 k2 k3` = k1 ou k2 ou k3.
    const daemons = 'OR OR FROM "mailer-daemon" FROM "postmaster" SUBJECT "Delivery Status Notification"';
    const partes = [INCLUIR_NAO_LIDOS ? null : "SEEN", DESDE ? `SINCE ${DESDE}` : null, daemons].filter(Boolean);
    const busca = await s.command(`UID SEARCH ${partes.join(" ")}`);
    const uids = (busca.match(/^\* SEARCH([\d ]*)$/m)?.[1] ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);

    const candidatos = uids.slice(-LIMITE);
    const achados = [];
    for (const uid of candidatos) {
      // BODY.PEEK — nunca BODY. O tripwire acima também recusaria.
      const resposta = await s.command(`UID FETCH ${uid} BODY.PEEK[]`);
      const raw = extrairLiteral(resposta);
      if (!raw) continue;
      const b = parseBounce(raw, INTERNOS);
      if (!b) continue;
      const data = raw.match(/^Date:[ \t]*(.+)$/mi)?.[1]?.trim() ?? "";
      achados.push({ uid, data, ...b });
    }

    relatar(achados, uids.length);
  } finally {
    s.close();
  }
}

function relatar(achados, examinados) {
  const falhas = achados.filter((a) => a.tipo === "falha");
  const atrasos = achados.filter((a) => a.tipo === "atraso");

  // Por ALUNO, que é a unidade que importa: quem está em silêncio sem saber.
  const porAluno = new Map();
  for (const a of falhas) {
    for (const d of a.destinatarios.filter((x) => !x.interno && x.acao !== "delayed")) {
      const atual = porAluno.get(d.email) ?? { email: d.email, vezes: 0, classes: new Set(), assuntos: new Set(), ultimo: "" };
      atual.vezes += 1;
      atual.classes.add(d.classe);
      if (a.assuntoOriginal) atual.assuntos.add(a.assuntoOriginal);
      atual.ultimo = a.data || atual.ultimo;
      porAluno.set(d.email, atual);
    }
  }

  if (JSON_SAIDA) {
    console.log(
      JSON.stringify(
        {
          examinados,
          bounces: achados.length,
          falhas: falhas.length,
          atrasos: atrasos.length,
          alunos: [...porAluno.values()].map((a) => ({
            email: a.email,
            vezes: a.vezes,
            classes: [...a.classes],
            assuntos: [...a.assuntos],
            ultimo: a.ultimo,
          })),
          detalhe: falhas.map((f) => ({
            uid: f.uid,
            data: f.data,
            assuntoOriginal: f.assuntoOriginal,
            messageIdOriginal: f.messageIdOriginal,
            destinatarios: f.destinatarios,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  // DENOMINADOR SEMPRE: "0 bounces" só é boa notícia junto do quanto se olhou.
  console.log(
    `\nExaminadas ${examinados} mensagens candidatas na INBOX (EXAMINE + BODY.PEEK, nada foi marcado).\n` +
      `Relatórios de entrega reconhecidos: ${achados.length} — ${falhas.length} FALHA, ${atrasos.length} atraso (não é falha).\n`,
  );

  if (porAluno.size === 0) {
    console.log("Nenhum ALUNO ficou sem resposta nas mensagens examinadas.");
  } else {
    console.log(`ALUNOS QUE NÃO RECEBERAM (${porAluno.size}):\n`);
    for (const a of [...porAluno.values()].sort((x, y) => y.vezes - x.vezes)) {
      const classes = [...a.classes];
      console.log(`  ${a.email} — ${a.vezes} bounce(s) · ${classes.join(", ")}`);
      console.log(`      último: ${a.ultimo || "?"}`);
      for (const c of classes) console.log(`      ${c}: ${ORIENTACAO[c].passo}`);
      for (const s of [...a.assuntos].slice(0, 3)) console.log(`      não chegou: "${s}"`);
      console.log("");
    }
  }

  const internosSo = falhas.filter((f) => f.destinatarios.every((d) => d.interno));
  if (internosSo.length) {
    console.log(`(${internosSo.length} bounce(s) pegaram SÓ a cópia interna — nenhum aluno sem resposta, mas a saída recusou.)`);
  }
  console.log("\nEsta ferramenta não gravou chamado nem mandou mensagem. Registro do backlog é decisão de quem lê.");
}

principal().catch((e) => {
  console.error("falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
