/**
 * "QUAIS CHAMADOS ABERTOS JA TIVERAM CARTA?" — leitura pura, pasta "Sent".
 *
 * POR QUE EXISTE (medido na ronda de 19/09 ~17hZ, quatro vezes seguidas)
 * Os quatro cartoes que peguei nesta ronda, escolhidos pelo criterio "mais
 * abandonado por ULTIMA NOTA", estavam TODOS ja resolvidos. O que faltava em
 * cada um era alguem VOLTAR e escrever a nota:
 *
 *   #322 novabbla@        aluno respondido 09/09 15:26Z, 81s depois da nota
 *                         do executor -> ficou 10 dias em investigating
 *   #333 aviso-orfao      conserto commitado 10/09 01:51Z, TRES MINUTOS depois
 *                         do cartao abrir -> ficou 9 dias em investigating
 *   #334 rearielo@        duplicata ja cancelada, sem cobranca -> 9 dias
 *   #321 grupouniprox@    aluno respondido 09/09 14:27Z, 67s depois da nota
 *                         do executor -> 10 dias
 *
 * Isso nao e fila de trabalho: e fila de CONTABILIDADE. E ela custa caro de
 * duas maneiras. Primeiro, esconde o trabalho real no meio de 88 cartoes que
 * parecem todos iguais de fora. Segundo, e pior: fez a casa quase escrever uma
 * SEGUNDA carta pra aluno que ja tinha sido respondido (#322 e #334 desta
 * ronda, e a Katia em 19/09 ~12hZ, que originou o modo --para do
 * `2026-09-19_uid_por_message_id.cjs`).
 *
 * O QUE ESTE SCRIPT FAZ: para cada chamado open/investigating com UM aluno
 * nomeado, pergunta a pasta "Sent" se saiu carta pra aquele endereco DEPOIS
 * que o cartao nasceu. Uma conexao IMAP, um SEARCH por endereco.
 *
 * ⚠️ O QUE ELE **NAO** FAZ, E ISTO E O PONTO MAIS IMPORTANTE DAQUI:
 * ele NAO diz que o chamado esta resolvido, e NINGUEM pode fechar cartao com
 * a saida dele. Carta depois da abertura e INDICIO, nao prova: a carta pode
 * ser sobre outro assunto, pode ser aviso automatico, pode ate ser a carta que
 * ERROU (foi o caso do #334, em que a carta que saiu falava da conta duplicada
 * e dava a entender que a assinatura inteira da aluna tinha acabado). O que
 * este script entrega e ORDEM DE VISITA: por onde comecar a ler. Quem fecha
 * abre a carta (`2026-09-18_dump_enviada.cjs <uid> --texto`), confere o estado
 * do aluno e decide. A regra 14 continua inteira.
 *
 * Tambem NAO conclui silencio no sentido contrario: "nenhuma carta" aqui pode
 * ser carta mandada de um worktree que nao registrou, ou resposta dada por
 * WhatsApp/chat. Zero aqui e "olhe com mais cuidado", nunca "ninguem falou".
 *
 * Garantias de leitura, iguais as do `ler_caixa.cjs` e do `dump_enviada.cjs`:
 * `EXAMINE` (read-only no protocolo), nenhuma flag alterada, e uma tripwire
 * que derruba o processo se um comando de escrita escapar.
 *
 * uso: node _frank/ferramentas/2026-09-19_aberto_mas_ja_respondido.cjs [--pasta Sent]
 */
const path = require("node:path");
const tls = require("node:tls");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});
const { supa } = require(path.join(__dirname, "_comum.cjs"));

const HOST = process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const PASS = process.env.SUPPORT_MAIL_PASSWORD || "";

const args = process.argv.slice(2);
const pega = (k) => {
  const comIgual = args.find((a) => a.startsWith(`${k}=`));
  if (comIgual) return comIgual.slice(k.length + 1);
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : null;
};
const pasta = pega("--pasta") || "Sent";

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

// SELECT entra na lista: EXAMINE e o unico jeito de abrir a pasta sem risco
// de mexer em flag de mensagem.
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

/** UIDs da pasta cujo cabecalho To contem o endereco. */
async function uidsPara(email) {
  const r = await cmd(`UID SEARCH HEADER "To" "${email}"`);
  const linha = r.match(/^\* SEARCH([^\r\n]*)/m)?.[1] ?? "";
  return linha.trim().split(/\s+/).filter(Boolean);
}

/** Date (cabecalho) de cada UID, em uma tacada. */
async function datasDos(uids) {
  if (!uids.length) return new Map();
  const r = await cmd(`UID FETCH ${uids.join(",")} (BODY.PEEK[HEADER.FIELDS (DATE SUBJECT)])`);
  const fora = new Map();
  // cada bloco comeca com "* <n> FETCH (UID <uid> ..."
  const blocos = r.split(/^\* \d+ FETCH /m).slice(1);
  for (const b of blocos) {
    const uid = b.match(/UID (\d+)/)?.[1];
    if (!uid) continue;
    const data = b.match(/^Date:\s*(.+)$/im)?.[1]?.trim() ?? null;
    const assunto = b.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() ?? "";
    const t = data ? Date.parse(data) : NaN;
    fora.set(uid, { data, assunto, ms: Number.isNaN(t) ? null : t });
  }
  return fora;
}

(async () => {
  if (!PASS) {
    console.error("faltou SUPPORT_MAIL_PASSWORD");
    process.exit(1);
  }

  const db = supa();
  const { data: incidentes, error } = await db
    .from("incidents")
    .select("numero, id, status, created_at, signature, affected_emails, agent_notes")
    .in("status", ["open", "investigating"]);
  if (error) throw new Error(`incidents: ${error.message}`);

  // Um aluno nomeado so. Cartao com 10 e-mails (leva) nao se decide por carta.
  const alvos = (incidentes || [])
    .filter((i) => Array.isArray(i.affected_emails) && i.affected_emails.length === 1)
    .map((i) => {
      const notas = Array.isArray(i.agent_notes) ? i.agent_notes : [];
      const ultima = notas
        .map((n) => Date.parse(n?.at ?? ""))
        .filter((t) => !Number.isNaN(t))
        .sort((a, b) => b - a)[0];
      return {
        numero: i.numero,
        id: i.id,
        status: i.status,
        sig: i.signature || "",
        email: String(i.affected_emails[0]).trim().toLowerCase(),
        nasceu: Date.parse(i.created_at),
        ultimaNota: ultima ?? null,
      };
    });

  console.log(`chamados open/investigating com UM aluno nomeado: ${alvos.length}`);
  console.log(`pasta consultada: "${pasta}" (EXAMINE, leitura pura)\n`);

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

  // Um SEARCH por endereco DISTINTO (varios cartoes podem ser do mesmo aluno).
  const porEmail = new Map();
  for (const email of [...new Set(alvos.map((a) => a.email))]) {
    const uids = await uidsPara(email);
    porEmail.set(email, uids.length ? await datasDos(uids) : new Map());
  }

  try {
    sock.write("aZ LOGOUT\r\n");
  } catch {
    /* ignora */
  }
  sock.end();

  const comCarta = [];
  const semCarta = [];
  for (const a of alvos) {
    const cartas = [...(porEmail.get(a.email) || new Map()).entries()]
      .map(([uid, d]) => ({ uid, ...d }))
      .filter((c) => c.ms !== null && c.ms > a.nasceu)
      .sort((x, y) => y.ms - x.ms);
    if (cartas.length) comCarta.push({ ...a, cartas });
    else semCarta.push(a);
  }

  const dia = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : "—");
  const paradoDias = (a) =>
    ((Date.now() - (a.ultimaNota ?? a.nasceu)) / 86_400_000).toFixed(1);

  comCarta.sort((x, y) => (x.ultimaNota ?? x.nasceu) - (y.ultimaNota ?? y.nasceu));

  console.log("═".repeat(70));
  console.log(`📮 ABERTOS QUE JA TIVERAM CARTA DEPOIS DE NASCER: ${comCarta.length}`);
  console.log("═".repeat(70));
  for (const a of comCarta) {
    const c = a.cartas[0];
    console.log(
      `  #${a.numero} · ${a.status} · nasceu ${dia(a.nasceu)} · nota parada ha ${paradoDias(a)}d`,
    );
    console.log(`     ${a.email} · ${a.sig.slice(0, 58)}`);
    console.log(
      `     ultima carta: uid ${c.uid} · ${dia(c.ms)} · ${String(c.assunto).slice(0, 70)}`,
    );
    if (a.cartas.length > 1) console.log(`     (+${a.cartas.length - 1} carta(s) antes desta)`);
  }

  console.log(`\n📭 sem carta depois de nascer: ${semCarta.length}`);
  console.log(
    "   (isto NAO e prova de silencio: carta mandada de worktree que nao registrou,\n" +
      "    resposta por WhatsApp ou pelo chat nao aparecem aqui)",
  );

  console.log("\n" + "═".repeat(70));
  console.log(`>>> NUMERO PRO RELATORIO: ${comCarta.length} chamado(s) abertos com carta ja enviada`);
  console.log("    Isto e ORDEM DE VISITA, NAO veredito. Antes de fechar qualquer um:");
  console.log("    node _frank/ferramentas/2026-09-18_dump_enviada.cjs <uid> --texto");
  console.log("    e confira o estado do aluno. Carta que saiu pode ter sido sobre");
  console.log("    outro assunto — ou pode ter sido a carta errada.");
  console.log("═".repeat(70));
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
