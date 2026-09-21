/**
 * "A CASA JÁ ESCREVEU PRA ESTE ALUNO?" — pergunta à pasta remota, não às tabelas.
 *
 * POR QUE EXISTE (lição da ronda de 21/09 11hZ, §7):
 * `avisos_enviados` e `emails_enviados` só começam em **2026-09-14T14:06**. Um
 * zero nelas para um caso ANTERIOR a essa data é **zero CEGO** — não é "a casa
 * não escreveu", é "a fonte não existia". Eu já transformei esse limite de
 * instrumento em propriedade do mundo uma vez hoje e quase mandei 12 cartas
 * erradas por causa disso.
 *
 * A pasta "Sent" do IMAP é **remota**: sobrevive a checkout, a worktree
 * descartável e à data em que a tabela nasceu. Para qualquer pergunta do tipo
 * "este aluno foi avisado?" cujo caso seja anterior a 14/09, é DELA que sai a
 * resposta.
 *
 * Garantias iguais às do `ler_caixa.cjs` / `dump_enviada.cjs` / `uid_por_message_id.cjs`:
 *  - só EXAMINE (nunca SELECT), então nenhuma flag é tocada e a Fast não
 *    "consome" a carta marcando como lida;
 *  - tripwire que recusa qualquer verbo de escrita do IMAP;
 *  - só lê os cabeçalhos Date/Subject/Message-ID — nunca o corpo.
 *
 * ⚠️ Zero AQUI ainda não prova silêncio absoluto: a carta pode ter saído por
 * WhatsApp, pelo chat do app, ou de um worktree cujo envio foi para outra
 * pasta. O texto de saída diz o que foi procurado e onde, para que o veredito
 * seja lido com o alcance certo.
 *
 * uso: node _frank/ferramentas/2026-09-21_cartas_para_o_aluno.cjs email@aluno [outro@aluno ...] [--pasta Sent]
 */
const path = require("node:path");
const tls = require("node:tls");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

const HOST = process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const PASS = process.env.SUPPORT_MAIL_PASSWORD || "";

const args = process.argv.slice(2);
function pega(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
const pasta = pega("--pasta") || "Sent";
const alvos = args.filter((a) => a.includes("@") && !a.startsWith("--"));

if (!alvos.length) {
  console.error(
    'uso: node _frank/ferramentas/2026-09-21_cartas_para_o_aluno.cjs email@aluno [...] [--pasta Sent]',
  );
  process.exit(1);
}
if (!PASS) {
  console.error("faltou SUPPORT_MAIL_PASSWORD no frontend/.env.local");
  process.exit(1);
}

let buf = Buffer.alloc(0);
let seq = 0;
let sock = null;

const espera = (re, ms = 120_000) =>
  new Promise((ok, no) => {
    const t0 = Date.now();
    const tick = () => {
      const cauda = buf.subarray(Math.max(0, buf.length - 8192)).toString("latin1");
      if (re.test(cauda)) return ok(buf.toString("latin1"));
      if (Date.now() - t0 > ms) return no(new Error("IMAP demorou"));
      setTimeout(tick, 50);
    };
    tick();
  });

// SELECT entra na lista: EXAMINE é o único jeito de abrir a pasta sem risco de
// mexer em flag.
const PROIBIDOS = /\b(STORE|EXPUNGE|MOVE|DELETE|APPEND|CREATE|RENAME|COPY|SELECT)\b/i;

async function cmd(c, sensivel = false) {
  if (!sensivel && PROIBIDOS.test(c)) throw new Error(`comando PROIBIDO: ${c.split(" ")[0]}`);
  const tag = `a${++seq}`;
  buf = Buffer.alloc(0);
  sock.write(`${tag} ${c}\r\n`);
  const r = await espera(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
  if (!new RegExp(`^${tag} OK`, "m").test(r)) throw new Error(r.slice(-300));
  return r;
}

function decodeAssunto(s) {
  // assunto vem em =?UTF-8?B?...?= com frequência; decodifica o suficiente pra ler
  return String(s || "").replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_, b64) => {
    try {
      return Buffer.from(b64, "base64").toString("utf8");
    } catch {
      return _;
    }
  });
}

(async () => {
  await new Promise((ok, no) => {
    sock = tls.connect({ host: HOST, port: 993, servername: HOST }, () => ok());
    sock.on("error", no);
    sock.on("data", (c) => {
      buf = Buffer.concat([buf, c]);
    });
  });
  await espera(/^\* OK/m);
  await cmd(`LOGIN "${USER}" "${PASS}"`, true);
  await cmd(`EXAMINE "${pasta}"`);

  console.log(`📬 pasta remota "${pasta}" — a fonte que sobrevive a checkout e é anterior a 14/09\n`);

  for (const alvo of alvos) {
    const r = await cmd(`UID SEARCH TO "${alvo}"`);
    const uids = (r.match(/^\* SEARCH([^\r\n]*)/m)?.[1] ?? "").trim().split(/\s+/).filter(Boolean);
    console.log(`=== ${alvo} — ${uids.length} carta(s) ===`);
    for (const u of uids) {
      const h = await cmd(`UID FETCH ${u} (BODY.PEEK[HEADER.FIELDS (DATE SUBJECT MESSAGE-ID)])`);
      const date = h.match(/^Date:\s*(.+)$/mi)?.[1]?.trim() ?? "?";
      const subj = decodeAssunto(h.match(/^Subject:\s*(.+)$/mi)?.[1]?.trim() ?? "?");
      console.log(`  uid ${u} | ${date} | ${subj}`);
    }
    if (!uids.length) {
      console.log("  (nenhuma carta NESTA pasta para este destinatário)");
    }
    console.log("");
  }

  console.log(
    "⚠️ alcance do veredito: isto cobre a pasta \"" +
      pasta +
      "\" e o cabeçalho To.\n" +
      "   Não cobre WhatsApp, chat do app, cópia oculta nem carta enviada para outra pasta.",
  );

  try {
    sock.write("aZ LOGOUT\r\n");
  } catch {
    /* ignora */
  }
  sock.end();
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
