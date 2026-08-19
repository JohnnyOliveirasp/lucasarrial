/**
 * ler_caixa.cjs — lê a caixa do suporte@ SEM atropelar a Fast.
 * Ordem: _frank/ordens/2026-08-19_ler_caixa.md
 *
 * TRÊS REGRAS INEGOCIÁVEIS (são o card inteiro):
 *   1. BODY.PEEK[...] SEMPRE, nunca BODY[...] — BODY[] marca \Seen como efeito
 *      colateral e a Fast nunca mais vê aquele e-mail (aluno fica sem resposta).
 *   2. Busca SEEN, nunca UNSEEN. O não-lido é a fila da Fast; dela só a
 *      CONTAGEM (--fila), nunca o corpo.
 *   3. Zero STORE / EXPUNGE / MOVE / DELETE. A ferramenta lê e sai.
 *
 * Defesas estruturais (não dependem de atenção de ninguém):
 *   - A caixa é aberta com EXAMINE (read-only no protocolo): o servidor
 *     RECUSA alteração de flag mesmo que um comando errado escapasse.
 *   - Tripwire: qualquer comando contendo STORE/EXPUNGE/MOVE/DELETE/APPEND
 *     ou BODY[ sem .PEEK derruba o processo antes de ir pro socket.
 *   - Anexo nunca é baixado: mensagem acima de 2MB (mesmo teto da Fast) só
 *     tem cabeçalho + BODYSTRUCTURE lidos (foi anexo de 33MB que deixou a
 *     Fast 2 dias muda em 08/08).
 *
 * Uso:
 *   node _frank/ferramentas/ler_caixa.cjs --de aluno@exemplo.com
 *   node _frank/ferramentas/ler_caixa.cjs --ultimos 10
 *   node _frank/ferramentas/ler_caixa.cjs --enviados --para aluno@exemplo.com
 *   node _frank/ferramentas/ler_caixa.cjs --fila          (só a CONTAGEM de não-lidos)
 *   Opções: --corpo N (chars do corpo, default 4000) · --caixa NOME (força a
 *   pasta de enviados, se a detecção automática errar)
 *
 * Credenciais: as MESMAS do mail-imap.ts, lidas do frontend/.env.local
 * (SUPPORT_MAIL_HOST / SUPPORT_MAIL_USER / SUPPORT_MAIL_PASSWORD).
 * Nenhum segredo é impresso.
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

// Mesmo teto da Fast (mail-imap.ts): acima disso, só cabeçalhos.
const MAX_BYTES = Number(process.env.AGENT_MAIL_MAX_BYTES ?? 2_000_000);

// ---------- sessão IMAP (porte fiel do ImapSession de mail-imap.ts) ----------

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
    // TRIPWIRE: nada de comando de escrita sai desta ferramenta. Nunca.
    // (LOGIN é isento: é seguro por construção e a senha poderia, por azar,
    // conter uma palavra proibida — e o texto dele nunca pode ir pra erro.)
    if (!sensivel && PROIBIDOS.test(cmd)) {
      throw new Error(`comando PROIBIDO nesta ferramenta (só leitura): ${sensivel ? "LOGIN" : cmd.split(" ").slice(0, 3).join(" ")}`);
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

  async commandRaw(cmd) {
    await this.command(cmd);
    return this.buffer;
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

// ---------- parse (portado de mail-respond.ts, comportamento idêntico) ----------

function decodeWord(s) {
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (m, _cs, enc, data) => {
    try {
      if (String(enc).toUpperCase() === "B") return Buffer.from(data, "base64").toString("utf8");
      const bytes = String(data)
        .replace(/_/g, " ")
        .replace(/=([0-9A-F]{2})/gi, (_x, h) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(bytes, "latin1").toString("utf8");
    } catch {
      return m;
    }
  });
}

function header(raw, name) {
  const m = raw.match(new RegExp(`^${name}: (.*(?:\\r?\\n[ \\t].*)*)`, "mi"));
  return m ? decodeWord(m[1].replace(/\r?\n[ \t]+/g, " ").trim()) : "";
}

function stripHtml(s) {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function mailText(raw, maxChars) {
  const plainIdx = raw.search(/Content-Type:\s*text\/plain/i);
  const htmlIdx = raw.search(/Content-Type:\s*text\/html/i);
  const idx = plainIdx >= 0 ? plainIdx : htmlIdx;
  let seg = idx >= 0 ? raw.slice(idx) : raw;
  const headBlock = seg.slice(0, 400);
  const start = seg.search(/\r?\n\r?\n/);
  seg = start >= 0 ? seg.slice(start) : seg;
  const boundary = seg.search(/\r?\n--[-=_a-zA-Z0-9]{6,}/);
  if (boundary > 0) seg = seg.slice(0, boundary);
  if (/quoted-printable/i.test(headBlock)) {
    seg = seg.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  } else if (/base64/i.test(headBlock)) {
    try {
      seg = Buffer.from(seg.replace(/\s+/g, ""), "base64").toString("utf8");
    } catch {
      /* fica como está */
    }
  }
  let text = idx === htmlIdx && idx >= 0 ? stripHtml(seg) : seg.replace(/\s+/g, " ").trim();
  try {
    const round = Buffer.from(text, "latin1").toString("utf8");
    if (!/�/.test(round)) text = round;
  } catch {
    /* mantém */
  }
  return text.slice(0, maxChars);
}

/** Anexos pelo MIME cru: só NOME e tamanho estimado — o conteúdo nunca é usado. */
function anexosDoRaw(raw) {
  const out = [];
  const re = /Content-(?:Disposition|Type):[^\r\n]*(?:\r?\n[ \t][^\r\n]*)*?(?:file)?name="?([^";\r\n]+)"?/gi;
  let m;
  while ((m = re.exec(raw))) {
    const nome = decodeWord(m[1].trim());
    if (!nome || out.some((a) => a.nome === nome)) continue;
    // tamanho ~ do bloco base64 entre o fim deste header e o próximo boundary
    const depois = raw.slice(m.index);
    const corpo = depois.search(/\r?\n\r?\n/);
    let bytes = 0;
    if (corpo >= 0) {
      const resto = depois.slice(corpo);
      const fim = resto.search(/\r?\n--[-=_a-zA-Z0-9]{6,}/);
      const bloco = fim > 0 ? resto.slice(0, fim) : resto;
      bytes = Math.round(bloco.replace(/\s+/g, "").length * 0.75); // base64 → bytes
    }
    out.push({ nome, bytes });
  }
  return out;
}

/** Nomes de anexo a partir do BODYSTRUCTURE (pra mensagem que a gente NÃO baixa). */
function anexosDoBodystructure(resposta) {
  const out = [];
  const re = /\((?:"(?:file)?name"|"NAME"|"FILENAME")\s+"([^"]+)"/gi;
  let m;
  while ((m = re.exec(resposta))) {
    const nome = decodeWord(m[1]);
    if (nome && !out.includes(nome)) out.push(nome);
  }
  return out;
}

const fmtBytes = (b) =>
  b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)}MB` : b >= 1000 ? `${Math.round(b / 1000)}KB` : `${b}B`;

// ---------- núcleo ----------

function extrairLiteral(buf) {
  const cabeca = buf.subarray(0, 4096).toString("latin1");
  const m = cabeca.match(/\{(\d+)\}\r\n/);
  if (!m || m.index === undefined) return "";
  const start = m.index + m[0].length;
  return buf.subarray(start, start + Number(m[1])).toString("latin1");
}

function uidsDaBusca(res) {
  return (res.match(/^\* SEARCH([\d ]*)$/m)?.[1] ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number);
}

async function login(sessao) {
  // sensivel=true: em erro/tripwire, o texto do comando (com a senha) NÃO vaza.
  await sessao.command(`LOGIN "${USER}" "${PASS.replace(/(["\\])/g, "\\$1")}"`, true);
}

/** Nome da pasta numa linha de LIST (vem quotado OU cru: `... "/" Sent`). */
function nomeDaPasta(linha) {
  return linha?.match(/"\S*"\s+(?:"([^"]+)"|(\S+))\s*$/)?.slice(1).find(Boolean) ?? null;
}

/** Acha a pasta de enviados via LIST (Namecheap: "Sent", flag \Sent). */
async function acharEnviados(sessao) {
  const res = await sessao.command(`LIST "" "*"`);
  const linhas = res.split(/\r?\n/).filter((l) => l.startsWith("* LIST"));
  const porFlag = linhas.find((l) => /\\Sent\b/i.test(l));
  const porNome = linhas.find((l) => /(Sent(?: Items| Messages)?|INBOX\.Sent)"?\s*$/i.test(l));
  return nomeDaPasta(porFlag || porNome) || "Sent";
}

async function main() {
  const argv = process.argv.slice(2);
  const pega = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : null;
  };
  const de = pega("--de");
  const para = pega("--para");
  const ultimos = Number(pega("--ultimos") || 0);
  const enviados = argv.includes("--enviados");
  const fila = argv.includes("--fila");
  const caixas = argv.includes("--caixas");
  const maxCorpo = Number(pega("--corpo") || 4000);
  const caixaForcada = pega("--caixa");

  if (!de && !ultimos && !enviados && !fila && !caixas) {
    console.log(
      [
        "ler_caixa — leitura da caixa do suporte@ SEM marcar nada como lido",
        "",
        "  --de <email>              e-mails JÁ LIDOS vindos desse remetente (INBOX)",
        "  --ultimos <N>             os N e-mails JÁ LIDOS mais recentes (INBOX)",
        "  --enviados [--para <em>]  pasta de enviados (⚠️ hoje VAZIA: o SMTP da Fast",
        "                            não salva cópia — ver proposta de gravar no banco)",
        "  --fila                    só a CONTAGEM de não-lidos (a fila é da Fast)",
        "  --caixas                  lista as pastas e quantas mensagens tem em cada",
        "  --corpo <N>               chars do corpo (default 4000) · --caixa <nome>",
      ].join("\n"),
    );
    return;
  }
  if (!PASS) {
    console.error("SUPPORT_MAIL_PASSWORD ausente no frontend/.env.local — sem credencial, sem leitura.");
    process.exit(1);
  }

  const sessao = new Sessao();
  await sessao.connect();
  try {
    await login(sessao);

    if (caixas) {
      // LIST + STATUS: ambos read-only por definição (RFC 3501).
      const res = await sessao.command(`LIST "" "*"`);
      if (process.env.LER_CAIXA_DEBUG) console.log(res);
      const nomes = res
        .split(/\r?\n/)
        .filter((l) => l.startsWith("* LIST"))
        .map(nomeDaPasta)
        .filter(Boolean);
      for (const nome of nomes) {
        try {
          const st = await sessao.command(`STATUS "${nome}" (MESSAGES UNSEEN)`);
          const msgs = st.match(/MESSAGES (\d+)/)?.[1] ?? "?";
          const naoLidos = st.match(/UNSEEN (\d+)/)?.[1] ?? "?";
          console.log(`${nome.padEnd(24)} ${msgs} mensagens (${naoLidos} não lidas)`);
        } catch {
          console.log(`${nome.padEnd(24)} (STATUS indisponível)`);
        }
      }
      return;
    }

    if (fila) {
      // REGRA 2: da fila da Fast, SÓ a contagem. EXAMINE = read-only.
      await sessao.command("EXAMINE INBOX");
      const res = await sessao.command("UID SEARCH UNSEEN");
      const uids = uidsDaBusca(res);
      console.log(`não-lidos no INBOX (fila da Fast): ${uids.length}`);
      if (uids.length) console.log(`uids: ${uids.join(" ")}`);
      return;
    }

    const caixa = enviados ? caixaForcada || (await acharEnviados(sessao)) : "INBOX";
    await sessao.command(`EXAMINE "${caixa}"`); // read-only no protocolo

    // REGRA 2: no INBOX a busca é SEEN. Nos enviados não há colisão (a Fast
    // nunca lê de lá), mas seguimos read-only do mesmo jeito.
    let criterio = enviados ? "ALL" : "SEEN";
    if (de) criterio += ` FROM "${de.replace(/"/g, "")}"`;
    if (para) criterio += ` TO "${para.replace(/"/g, "")}"`;
    const res = await sessao.command(`UID SEARCH ${criterio}`);
    const todos = uidsDaBusca(res);
    const n = ultimos > 0 ? ultimos : 10;
    const uids = todos.slice(-n); // os mais recentes

    if (!uids.length) {
      console.log(`nada encontrado em "${caixa}" com: ${criterio}`);
      return;
    }
    console.log(`caixa "${caixa}" · critério: ${criterio} · ${todos.length} no total, mostrando ${uids.length}\n`);

    // Tamanhos ANTES de baixar (lição de 08/08 — nunca arrastar anexo gigante).
    const tamanhos = new Map();
    const info = await sessao.command(`UID FETCH ${uids.join(",")} (RFC822.SIZE)`);
    for (const linha of info.split(/\r?\n/)) {
      const m = linha.match(/UID (\d+).*RFC822\.SIZE (\d+)|RFC822\.SIZE (\d+).*UID (\d+)/);
      if (!m) continue;
      const uid = Number(m[1] ?? m[4]);
      const size = Number(m[2] ?? m[3]);
      if (uid && size) tamanhos.set(uid, size);
    }

    for (const uid of uids) {
      const tam = tamanhos.get(uid) ?? 0;
      let raw;
      let corpo;
      let anexos = [];

      if (tam > MAX_BYTES) {
        // REGRA da spec: anexo grande NÃO se baixa. Cabeçalho + estrutura só.
        const bufH = await sessao.commandRaw(
          `UID FETCH ${uid} BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)]`,
        );
        raw = extrairLiteral(bufH);
        corpo = `(corpo NÃO baixado — mensagem de ${fmtBytes(tam)}, acima do teto de ${fmtBytes(MAX_BYTES)})`;
        try {
          const bs = await sessao.command(`UID FETCH ${uid} BODYSTRUCTURE`);
          anexos = anexosDoBodystructure(bs).map((nome) => ({ nome, bytes: 0 }));
        } catch {
          /* estrutura é best-effort */
        }
      } else {
        const buf = await sessao.commandRaw(`UID FETCH ${uid} BODY.PEEK[]`);
        raw = extrairLiteral(buf);
        corpo = mailText(raw, maxCorpo);
        anexos = anexosDoRaw(raw);
      }

      const linhaAnexos = anexos.length
        ? `\nanexos: ${anexos.map((a) => `${a.nome}${a.bytes ? ` (${fmtBytes(a.bytes)})` : ""}`).join(" · ")}`
        : "";
      console.log(
        [
          "────────────────────────────────────────────────────────",
          `uid ${uid} · ${header(raw, "Date") || "(sem data)"} · ${fmtBytes(tam)}`,
          `de:      ${header(raw, "From") || "?"}`,
          `para:    ${header(raw, "To") || "?"}`,
          `assunto: ${header(raw, "Subject") || "(sem assunto)"}${linhaAnexos}`,
          "",
          corpo || "(sem corpo em texto)",
          "",
        ].join("\n"),
      );
    }
  } finally {
    sessao.close();
  }
}

main().catch((e) => {
  console.error("ler_caixa falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
