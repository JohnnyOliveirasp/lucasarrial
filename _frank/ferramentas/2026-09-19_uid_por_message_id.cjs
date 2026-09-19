/**
 * UID DE UMA CARTA A PARTIR DO Message-ID — leitura pura.
 *
 * POR QUE EXISTE: a tabela `emails_enviados` guarda `message_id`, mas NAO guarda
 * o corpo. Entao, pra saber o que a casa REALMENTE escreveu pra um aluno, a
 * ronda precisa abrir a carta na pasta "Sent" — e o `2026-09-18_dump_enviada.cjs`
 * pede um UID, que e numero de caixa e nao existe em lugar nenhum do banco.
 * Faltava a ponte entre os dois. Sem ela, a ronda de 19/09 ~12hZ quase escreveu
 * uma 2a carta pra mesma aluna (Katia) sem saber o que a 1a dizia — duplicar
 * carta contradizendo a anterior e pior que o silencio.
 *
 * Garantias iguais as do `ler_caixa.cjs` e do `dump_enviada.cjs`:
 * `EXAMINE` (read-only no protocolo) + nenhuma flag alterada + tripwire que
 * derruba o processo se um comando de escrita escapar. Este script NAO baixa
 * corpo: so resolve Message-ID -> UID. O corpo e assunto do outro.
 *
 * uso: node _frank/ferramentas/2026-09-19_uid_por_message_id.cjs "<id@host>" [pasta]
 *      (a pasta padrao e "Sent"; aceita o id com ou sem os <>)
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

// Dois modos, porque a ronda faz DUAS perguntas diferentes:
//   1) "abre ESTA carta"            -> por Message-ID (o que `emails_enviados` guarda)
//   2) "a casa JA escreveu pra ele?" -> por destinatario (--para)
// O modo 2 existe porque `emails_enviados` só nasceu em ~14/09: para aluno que
// reclamou ANTES disso, 0 linha na tabela NÃO prova que ninguém escreveu. A pasta
// "Sent" é remota e sobrevive a qualquer checkout — é a fonte que vale.
const args = process.argv.slice(2);
const pega = (k) => {
  const comIgual = args.find((a) => a.startsWith(`${k}=`));
  if (comIgual) return comIgual.slice(k.length + 1);
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : null;
};
const para = pega("--para");
const pasta = pega("--pasta") || "Sent";
const alvo = (para ? para : args[0] || "").trim().replace(/^<|>$/g, "");
const cabecalho = para ? "To" : "Message-ID";
if (!alvo) {
  console.error(
    'uso: node _frank/ferramentas/2026-09-19_uid_por_message_id.cjs "<id@host>" [--pasta Sent]\n' +
      '     node _frank/ferramentas/2026-09-19_uid_por_message_id.cjs --para aluno@exemplo.com',
  );
  process.exit(1);
}

let buf = Buffer.alloc(0);
let seq = 0;
let sock = null;

const espera = (re, ms = 120_000) =>
  new Promise((ok, no) => {
    const t0 = Date.now();
    const tick = () => {
      const cauda = buf.subarray(Math.max(0, buf.length - 4096)).toString("latin1");
      if (re.test(cauda)) return ok(buf.toString("latin1"));
      if (Date.now() - t0 > ms) return no(new Error("IMAP demorou"));
      setTimeout(tick, 50);
    };
    tick();
  });

// mesma tripwire do dump: SELECT tambem entra, porque EXAMINE e o unico jeito
// de abrir a pasta sem risco de mexer em flag.
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

(async () => {
  if (!PASS) {
    console.error("faltou SUPPORT_MAIL_PASSWORD");
    process.exit(1);
  }
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

  const r = await cmd(`UID SEARCH HEADER "${cabecalho}" "${alvo}"`);
  const linha = r.match(/^\* SEARCH([^\r\n]*)/m)?.[1] ?? "";
  const uids = linha.trim().split(/\s+/).filter(Boolean);

  try {
    sock.write("aZ LOGOUT\r\n");
  } catch {
    /* ignora */
  }
  sock.end();

  if (!uids.length) {
    // zero aqui NAO prova que a carta nao saiu: pode estar em outra pasta.
    // Por isso o texto diz o que foi procurado e onde.
    console.log(`NADA na pasta "${pasta}" com ${cabecalho} ${alvo}`);
    console.log("(zero nesta pasta nao prova que a carta nao saiu — tente outra pasta)");
    process.exit(2);
  }
  console.log(`${uids.length} carta(s) na pasta "${pasta}" com ${cabecalho} ${alvo}:`);
  console.log(uids.join(" "));
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
