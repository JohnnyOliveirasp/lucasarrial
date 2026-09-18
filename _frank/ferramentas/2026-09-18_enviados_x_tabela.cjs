/**
 * enviados_x_tabela.cjs — A CARTA QUE SAIU ESTÁ NO LIVRO-CAIXA DA CASA? (#101)
 *
 * POR QUE EXISTE. O #101 foi fechado `fixed` em 16/09 12:04Z e o Vigia deixou,
 * às 18:17Z do mesmo dia, uma OBJEÇÃO que nunca foi respondida: cruzando a
 * pasta Enviados do suporte@ com `emails_enviados`, ele achou cartas REAIS sem
 * linha nenhuma na tabela (valdirtrentotrg@ uids 2456/2465, lucianodepinho@
 * uid 2494, andy.silvestre@) — em horários em que a tabela comprovadamente
 * estava viva. Ou seja: não é falta de cobertura por data, é BURACO.
 *
 * A pergunta que a objeção NÃO fez, e que é a que decide o cartão:
 *   o buraco é só PASSIVO (cartas velhas, anteriores ao conserto), ou ainda
 *   está ABERTO hoje — isto é, ainda sai carta da casa que não entra no livro?
 * Essas duas respostas pedem ações opostas (backfill × achar o caminho que
 * escapa), e ninguém pode escolher sem medir. É isso que este script mede.
 *
 * O QUE ELE FAZ: lê os CABEÇALHOS das mensagens da pasta Enviados desde uma
 * data, lê `emails_enviados`, e casa as duas listas por Message-ID (com queda
 * para destinatário+janela de tempo). O que sobra da pasta sem par na tabela é
 * buraco, e sai listado com data, destinatário e assunto.
 *
 * ⚠️ SÓ LEITURA, e as mesmas três regras do `ler_caixa.cjs` (ordem de 19/08):
 *   1. BODY.PEEK[HEADER.FIELDS ...] — nunca BODY[], que marcaria \Seen.
 *   2. EXAMINE, nunca SELECT: o servidor recusa mudança de flag.
 *   3. Zero STORE/EXPUNGE/MOVE/DELETE/APPEND. Tripwire derruba o processo
 *      antes de o comando ir pro socket.
 * Aqui o risco de marcar lida é menor que no INBOX (a Fast não lê de Enviados),
 * mas a trava é a mesma de propósito: foi BODY[] em caixa errada que já deixou
 * aluno sem resposta, e ferramenta de ronda não pode ter regra mais frouxa que
 * a irmã.
 *
 * ⚠️ NÃO LÊ CORPO — só ENVELOPE/cabeçalho. É de propósito: o #351 mostrou que
 * TODA cópia local de parse de MIME apodrece contra a produção. Não havendo
 * corpo, não há parse pra apodrecer.
 *
 * ⚠️ A PASTA ENVIADOS NÃO É A VERDADE INTEIRA (#210): quando o APPEND falha 3x,
 * o `enviar_email.cjs` grava o envio em `_frank/prova/enviados_local.jsonl`.
 * Esse arquivo é lido junto — sem ele, carta entregue apareceria como "nunca
 * enviada" e a conta do buraco sairia inflada pro lado errado.
 *
 * USO:
 *   node _frank/ferramentas/2026-09-18_enviados_x_tabela.cjs
 *   node _frank/ferramentas/2026-09-18_enviados_x_tabela.cjs --desde 14-Sep-2026
 *   ... --corte "2026-09-16T11:26:00Z"   (instante que separa passivo × hoje)
 *   ... --json /tmp/buracos.json         (grava o detalhe pra outra ferramenta)
 */
const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

const HOST = process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const PASS = process.env.SUPPORT_MAIL_PASSWORD || "";

/** merge do PR #311 (366e1cd) — a partir daqui a carta da RONDA registra. */
const CORTE_PADRAO = "2026-09-16T11:26:00Z";
/** migration 108: antes disto a tabela não existia, buraco aqui não é defeito. */
const TABELA_VIVA_DESDE = "2026-09-14T14:06:31Z";

// ---------- sessão IMAP (mesma do ler_caixa.cjs; só leitura) ----------
const PROIBIDOS = /\b(STORE|EXPUNGE|MOVE|DELETE|APPEND|CREATE|RENAME|COPY|SELECT)\b|\bBODY\[(?!HEADER)/i;

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
      s.setTimeout(60_000, () => {
        s.destroy();
        reject(new Error("IMAP timeout"));
      });
      s.on("data", (c) => {
        this.buffer = Buffer.concat([this.buffer, c]);
      });
      this.socket = s;
    });
    await this.waitFor(/^\* OK/m);
  }
  waitFor(pattern, timeoutMs = 60_000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        const cauda = this.buffer.subarray(Math.max(0, this.buffer.length - 4096)).toString("latin1");
        if (pattern.test(cauda)) return resolve(this.buffer.toString("latin1"));
        if (Date.now() - t0 > timeoutMs) return reject(new Error("IMAP resposta demorou"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }
  async command(cmd, sensivel = false) {
    if (!this.socket) throw new Error("IMAP sem conexão");
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

function nomeDaPasta(linha) {
  return linha?.match(/"\S*"\s+(?:"([^"]+)"|(\S+))\s*$/)?.slice(1).find(Boolean) ?? null;
}
async function acharEnviados(sessao) {
  const res = await sessao.command(`LIST "" "*"`);
  const linhas = res.split(/\r?\n/).filter((l) => l.startsWith("* LIST"));
  const porFlag = linhas.find((l) => /\\Sent\b/i.test(l));
  const porNome = linhas.find((l) => /(Sent(?: Items| Messages)?|INBOX\.Sent)"?\s*$/i.test(l));
  return nomeDaPasta(porFlag || porNome) || "Sent";
}

/** Message-ID comparável: sem <>, sem espaço, minúsculo. */
function normId(v) {
  return (v || "").replace(/[<>\s]/g, "").toLowerCase() || null;
}
/** primeiro endereço de um header To/Cc, minúsculo */
function primeiroEndereco(v) {
  const m = (v || "").match(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/);
  return m ? m[0].toLowerCase() : null;
}
/** todos os endereços do header (o bcc do suporte@ costuma vir junto) */
function todosEnderecos(v) {
  return [...new Set((v || "").match(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/g) || [])].map((x) => x.toLowerCase());
}

function cabecalhosDoBloco(txt) {
  // desdobra continuação (linha começando com espaço/tab)
  const linhas = txt.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/);
  const out = {};
  for (const l of linhas) {
    const m = l.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

async function lerEnviados(desde) {
  const s = new Sessao();
  await s.connect();
  await s.command(`LOGIN "${USER}" "${PASS.replace(/(["\\])/g, "\\$1")}"`, true);
  const caixa = await acharEnviados(s);
  await s.command(`EXAMINE "${caixa}"`);
  const busca = await s.command(`UID SEARCH SINCE ${desde}`);
  const uids = (busca.match(/^\* SEARCH([\d\s]*)/m)?.[1] || "").trim().split(/\s+/).filter(Boolean).map(Number);
  const msgs = [];
  for (let i = 0; i < uids.length; i += 50) {
    const lote = uids.slice(i, i + 50);
    const res = await s.command(
      `UID FETCH ${lote.join(",")} (BODY.PEEK[HEADER.FIELDS (DATE TO CC SUBJECT MESSAGE-ID)])`,
    );
    // cada mensagem vem como: * N FETCH (UID u BODY[...] {len}\r\n<bloco>)
    const re = /UID (\d+) BODY\[HEADER\.FIELDS[^\]]*\] \{(\d+)\}\r?\n/g;
    let m;
    while ((m = re.exec(res))) {
      const uid = Number(m[1]);
      const len = Number(m[2]);
      const bloco = res.slice(m.index + m[0].length, m.index + m[0].length + len);
      const h = cabecalhosDoBloco(bloco);
      msgs.push({
        uid,
        caixa,
        messageId: normId(h["message-id"]),
        para: primeiroEndereco(h.to),
        destinatarios: todosEnderecos(`${h.to || ""} ${h.cc || ""}`),
        assunto: h.subject || null,
        dataHeader: h.date || null,
        quando: h.date ? new Date(h.date) : null,
      });
    }
  }
  s.close();
  return { caixa, uids, msgs };
}

function lerRegistroLocal() {
  const arq = path.join(RAIZ, "_frank", "prova", "enviados_local.jsonl");
  if (!fs.existsSync(arq)) return [];
  return fs
    .readFileSync(arq, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function lerTabela(desdeIso) {
  const { supa } = require(path.join(__dirname, "_comum.cjs"));
  const db = supa();
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("emails_enviados")
      .select("id, enviado_em, message_id, to_email, assunto, origem, bounce_em, bounce_classe")
      .gte("enviado_em", desdeIso)
      .order("enviado_em", { ascending: true })
      .range(de, de + 999);
    if (error) throw new Error(`emails_enviados: ${error.message}`);
    linhas.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return linhas;
}

function fmt(d) {
  return d ? new Date(d).toISOString().replace("T", " ").slice(0, 19) + "Z" : "?";
}

(async () => {
  const argv = process.argv.slice(2);
  const pega = (k) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : null;
  };
  const desde = pega("--desde") || "14-Sep-2026";
  const corte = new Date(pega("--corte") || CORTE_PADRAO);
  const saidaJson = pega("--json");

  console.log(`📤 pasta Enviados desde ${desde} × tabela emails_enviados`);
  console.log(`   corte passivo × hoje: ${fmt(corte)} (merge do PR #311)\n`);

  const { caixa, uids, msgs } = await lerEnviados(desde);
  console.log(`caixa "${caixa}": ${uids.length} uid(s) na busca, ${msgs.length} com cabeçalho lido`);
  if (uids.length !== msgs.length) {
    console.log(`   ⚠️  ${uids.length - msgs.length} uid(s) não renderam cabeçalho — NÃO conte como buraco, conte como não-medido`);
  }

  const tabela = await lerTabela(new Date(TABELA_VIVA_DESDE).toISOString());
  console.log(`tabela: ${tabela.length} linha(s) desde ${fmt(TABELA_VIVA_DESDE)}`);
  const local = lerRegistroLocal();
  console.log(`registro local (#210, APPEND falhou): ${local.length} linha(s)\n`);

  const porId = new Map();
  for (const t of tabela) {
    const k = normId(t.message_id);
    if (k) porId.set(k, t);
  }

  const buracos = [];
  let casadoPorId = 0;
  let casadoPorJanela = 0;
  let semData = 0;

  for (const m of msgs) {
    if (m.messageId && porId.has(m.messageId)) {
      casadoPorId++;
      continue;
    }
    if (!m.quando || Number.isNaN(m.quando.getTime())) {
      semData++;
      continue;
    }
    // queda: mesmo destinatário, ±10 min. Frouxo de propósito — aqui um falso
    // "casado" só faz a conta de buraco ficar CONSERVADORA, que é o lado certo
    // pra errar quando a conclusão vai virar decisão de backfill.
    const alvo = m.quando.getTime();
    const perto = tabela.find(
      (t) =>
        m.destinatarios.includes((t.to_email || "").toLowerCase()) &&
        Math.abs(new Date(t.enviado_em).getTime() - alvo) < 10 * 60_000,
    );
    if (perto) {
      casadoPorJanela++;
      continue;
    }
    buracos.push(m);
  }

  console.log(`casadas por Message-ID: ${casadoPorId}`);
  console.log(`casadas por destinatário+janela de 10min: ${casadoPorJanela}`);
  if (semData) console.log(`sem header Date legível (não classificadas): ${semData}`);
  console.log("");

  const vivo = new Date(TABELA_VIVA_DESDE).getTime();
  const relevantes = buracos.filter((b) => b.quando && b.quando.getTime() >= vivo);
  const antesDaTabela = buracos.length - relevantes.length;
  const passivo = relevantes.filter((b) => b.quando.getTime() < corte.getTime());
  const hoje = relevantes.filter((b) => b.quando.getTime() >= corte.getTime());

  console.log("═".repeat(70));
  console.log(`🕳️  CARTAS NA PASTA SEM LINHA NA TABELA: ${relevantes.length}`);
  console.log("═".repeat(70));
  if (antesDaTabela) console.log(`   (+${antesDaTabela} anteriores a ${fmt(TABELA_VIVA_DESDE)} — a tabela não existia, não é defeito)\n`);

  const bloco = (titulo, lista) => {
    console.log(`\n── ${titulo}: ${lista.length}`);
    for (const b of lista.sort((a, z) => a.quando - z.quando)) {
      console.log(`   uid ${b.uid} · ${fmt(b.quando)} · ${b.para || "(sem To)"}`);
      console.log(`      "${(b.assunto || "(sem assunto)").slice(0, 78)}"`);
    }
  };
  bloco(`PASSIVO — antes do corte (${fmt(corte)})`, passivo);
  bloco("AINDA ABERTO — DEPOIS do corte", hoje);

  console.log("\n" + "═".repeat(70));
  if (hoje.length === 0) {
    console.log(">>> VEREDITO: o buraco é PASSIVO. Depois do corte, 0 carta da pasta");
    console.log("    ficou fora da tabela. O que resta é decidir o backfill das");
    console.log(`    ${passivo.length} antigas — decisão, não defeito novo.`);
  } else {
    console.log(`>>> VEREDITO: o buraco AINDA ESTÁ ABERTO — ${hoje.length} carta(s) depois do corte`);
    console.log("    saíram sem entrar no livro-caixa. Ache o CAMINHO de envio que");
    console.log("    escapa antes de discutir backfill: backfill de cano furado");
    console.log("    enche de novo amanhã.");
  }
  console.log("═".repeat(70));

  if (saidaJson) {
    fs.writeFileSync(saidaJson, JSON.stringify({ corte, passivo, hoje, antesDaTabela }, null, 2));
    console.log(`\ndetalhe gravado em ${saidaJson}`);
  }
})().catch((e) => {
  console.error("FALHOU:", e instanceof Error ? e.message : e);
  process.exit(1);
});
