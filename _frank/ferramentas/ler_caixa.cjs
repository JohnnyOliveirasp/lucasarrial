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
 *     Fast 2 dias muda em 08/08) — MAIS a parte MIME de texto sozinha, via
 *     BODY.PEEK[n], que tem poucos KB. Desistir do corpo inteiro por causa do
 *     anexo deixou 5 alunos sem resposta (um deles 62h): o anexo continua sem
 *     ser baixado, mas o que o aluno ESCREVEU sempre aparece.
 *
 * Uso:
 *   node _frank/ferramentas/ler_caixa.cjs --de aluno@exemplo.com
 *   node _frank/ferramentas/ler_caixa.cjs --ultimos 10
 *   node _frank/ferramentas/ler_caixa.cjs --enviados --para aluno@exemplo.com
 *   node _frank/ferramentas/ler_caixa.cjs --fila          (só a CONTAGEM de não-lidos)
 *   node _frank/ferramentas/ler_caixa.cjs --anexos 179 [--salvar-em /tmp/x]
 *     (baixa os anexos DAQUELE uid pra _Bugs/anexos/<uid>/ — nunca na listagem;
 *      teto próprio de 10MB/anexo em _anexos.cjs; PEEK+EXAMINE: não marca lida)
 *   Opções: --corpo N (chars do corpo, default 4000) · --caixa NOME (força a
 *   pasta de enviados, se a detecção automática errar)
 *
 * Credenciais: as MESMAS do mail-imap.ts, lidas do frontend/.env.local
 * (SUPPORT_MAIL_HOST / SUPPORT_MAIL_USER / SUPPORT_MAIL_PASSWORD).
 * Nenhum segredo é impresso.
 */
const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");

const RAIZ = path.resolve(__dirname, "..", "..");
try {
  require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
    path: path.join(RAIZ, "frontend", ".env.local"),
  });
} catch {
  // Sem dotenv instalado (worktree limpo, CI) o arquivo continua REQUERÍVEL
  // e as funções puras dão pra testar. Sem credencial a CLI não roda: o
  // `if (!PASS)` do main() barra com mensagem clara, em vez de stack trace.
}

const HOST = process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const PASS = process.env.SUPPORT_MAIL_PASSWORD || "";

// Mesmo teto da Fast (mail-imap.ts): acima disso, só cabeçalhos.
const MAX_BYTES = Number(process.env.AGENT_MAIL_MAX_BYTES ?? 2_000_000);

/**
 * Teto PRÓPRIO da parte de texto, deliberadamente separado do MAX_BYTES.
 * MAX_BYTES olha a mensagem INTEIRA (anexo incluso) e existe pra nunca arrastar
 * 33MB pelo socket. Mas mensagem grande quase sempre é grande POR CAUSA DO
 * ANEXO: o text/plain do aluno tem poucos KB e cabe num BODY.PEEK[n] sozinho.
 * 200KB é folgado pra qualquer e-mail escrito por humano (e pra html pesado de
 * cliente de e-mail) e continua barato — se estourar isso, é anexo disfarçado
 * de texto e a gente prefere não baixar.
 */
const MAX_PARTE_TEXTO_BYTES = 200_000;

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

/**
 * Recorta e decodifica UMA parte MIME. Espelho do `extrairParte` de
 * `frontend/src/lib/agent/mail-corpo.ts` — as duas cópias existem porque esta
 * ferramenta é .cjs solta e aquela é o caminho de produção; se uma mudar, a
 * outra muda junto, senão a ferramenta volta a ser cega pro bug da produção.
 *
 * Tudo é derivado do `idx` recebido, headBlock incluso: é o que torna seguro
 * chamar duas vezes com partes diferentes (ver a armadilha em mail-corpo.ts).
 */
function extrairParte(raw, idx, html) {
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
  let text = html ? stripHtml(seg) : seg.replace(/\s+/g, " ").trim();
  try {
    const round = Buffer.from(text, "latin1").toString("utf8");
    if (!/�/.test(round)) text = round;
  } catch {
    /* mantém */
  }
  return text;
}

/**
 * Texto do e-mail. MESMA correção do #261 que entrou na produção: a parte é
 * escolhida pelo CONTEÚDO, não pela presença do cabeçalho. text/plain vazio
 * cai pro text/html em vez de devolver "" (que aqui virava a linha
 * "(sem corpo em texto)" — o sintoma do #248, fechado como ignored porque
 * ninguém tinha reproduzido a causa ainda).
 *
 * Era esta cegueira que impedia a ferramenta de mostrar o bug da Fast: quem
 * abrisse a caixa pra conferir via o mesmo nada que ela viu.
 */
function mailText(raw, maxChars) {
  const plainIdx = raw.search(/Content-Type:\s*text\/plain/i);
  const htmlIdx = raw.search(/Content-Type:\s*text\/html/i);

  const tentativas = [];
  if (plainIdx >= 0) tentativas.push({ idx: plainIdx, html: false });
  if (htmlIdx >= 0) tentativas.push({ idx: htmlIdx, html: true });
  if (tentativas.length === 0) tentativas.push({ idx: -1, html: false });

  for (const t of tentativas) {
    const texto = extrairParte(raw, t.idx, t.html);
    if (texto.trim()) return texto.slice(0, maxChars);
  }
  return "";
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

// ---------- BODYSTRUCTURE: parser espelhado de _anexos.cjs ----------
//
// _anexos.cjs exporta só { baixarAnexos, MAX_ANEXO_BYTES }; o parser interno
// dele (tokenizar / montarArvore / paresParaObjeto / coletarPartes / ehAnexo /
// decodificarParte) NÃO é exportável, e mexer naquele arquivo estava fora do
// escopo desta correção. Então o parser está espelhado aqui SEM mudança de
// comportamento — é a mesma lógica já testada pelo --anexos.
// SE um dia _anexos.cjs passar a exportar essas funções: apague este bloco e
// troque por um require. Não deixe as duas cópias divergirem.

/** Tokeniza a resposta: parênteses, strings quotadas (com \" escapado) e átomos. */
function tokenizar(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "(" || c === ")") {
      toks.push(c);
      i++;
    } else if (c === '"') {
      let j = i + 1;
      let val = "";
      while (j < s.length && s[j] !== '"') {
        if (s[j] === "\\" && j + 1 < s.length) {
          val += s[j + 1];
          j += 2;
        } else {
          val += s[j];
          j++;
        }
      }
      toks.push({ str: val });
      i = j + 1;
    } else if (/\s/.test(c)) {
      i++;
    } else if (c === "{") {
      // Literal {n} no BODYSTRUCTURE (raro). Não suportado — falhar com verdade
      // é melhor do que apontar pra parte errada.
      throw new Error("BODYSTRUCTURE veio com literal {n} — parser não suporta; me avise");
    } else {
      let j = i;
      while (j < s.length && !/[\s()"]/.test(s[j])) j++;
      toks.push({ atom: s.slice(i, j) });
      i = j;
    }
  }
  return toks;
}

/** Monta a árvore de listas a partir dos tokens. */
function montarArvore(toks) {
  let pos = 0;
  function lista() {
    const out = [];
    while (pos < toks.length) {
      const t = toks[pos];
      if (t === "(") {
        pos++;
        out.push(lista());
      } else if (t === ")") {
        pos++;
        return out;
      } else {
        pos++;
        out.push("str" in t ? t.str : t.atom === "NIL" ? null : t.atom);
      }
    }
    return out;
  }
  while (pos < toks.length && toks[pos] !== "(") pos++;
  if (pos >= toks.length) throw new Error("BODYSTRUCTURE sem lista — resposta inesperada");
  pos++;
  return lista();
}

/** (key value key value ...) → { KEY: value } */
function paresParaObjeto(lista) {
  const out = {};
  if (!Array.isArray(lista)) return out;
  for (let i = 0; i + 1 < lista.length; i += 2) {
    if (typeof lista[i] === "string") out[lista[i].toUpperCase()] = lista[i + 1];
  }
  return out;
}

/** Numera as partes como o IMAP numera (1, 2, 1.1, ...) e devolve as folhas. */
function coletarPartes(no, prefixo) {
  if (Array.isArray(no) && Array.isArray(no[0])) {
    const partes = [];
    let i = 0;
    while (i < no.length && Array.isArray(no[i])) {
      const numero = prefixo ? `${prefixo}.${i + 1}` : String(i + 1);
      partes.push(...coletarPartes(no[i], numero));
      i++;
    }
    return partes;
  }
  const [tipo, subtipo, params, , , encoding, tamanho, ...resto] = no;
  const paramsObj = paresParaObjeto(params);
  let dispTipo = null;
  let dispParams = {};
  for (const el of resto) {
    if (Array.isArray(el) && typeof el[0] === "string" && (Array.isArray(el[1]) || el[1] === null)) {
      dispTipo = el[0].toUpperCase();
      dispParams = paresParaObjeto(el[1]);
      break;
    }
  }
  const nome = dispParams.FILENAME || dispParams["FILENAME*"] || paramsObj.NAME || paramsObj["NAME*"] || null;
  return [
    {
      numero: prefixo || "1", // mensagem não-multipart: a parte única é a "1"
      tipo: String(tipo || "").toUpperCase(),
      subtipo: String(subtipo || "").toUpperCase(),
      encoding: String(encoding || "").toUpperCase(),
      bytes: Number(tamanho) || 0,
      nome,
      disposition: dispTipo,
    },
  ];
}

/** É anexo? Disposition ATTACHMENT, ou qualquer parte com nome de arquivo. */
function ehAnexo(p) {
  return p.disposition === "ATTACHMENT" || !!p.nome;
}

/** Decodifica o bloco baixado conforme o encoding declarado no BODYSTRUCTURE. */
function decodificarParte(textoLatin1, encoding) {
  if (encoding === "BASE64") return Buffer.from(textoLatin1.replace(/\s+/g, ""), "base64");
  if (encoding === "QUOTED-PRINTABLE") {
    const s = textoLatin1.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)));
    return Buffer.from(s, "latin1");
  }
  // 7BIT / 8BIT / BINARY: latin1 preserva byte a byte
  return Buffer.from(textoLatin1, "latin1");
}

/** Folhas do BODYSTRUCTURE de uma resposta de UID FETCH (lança se não parsear). */
function partesDoBodystructure(resposta) {
  const linhaFetch = resposta.split(/\r?\n/).find((l) => /^\* \d+ FETCH/i.test(l) && /BODYSTRUCTURE/i.test(l));
  if (!linhaFetch) throw new Error("sem linha de BODYSTRUCTURE na resposta");
  const idx = linhaFetch.search(/BODYSTRUCTURE/i);
  return coletarPartes(montarArvore(tokenizar(linhaFetch.slice(idx + "BODYSTRUCTURE".length))), "");
}

/**
 * Primeira parte de texto LEGÍVEL (text/plain > text/html) que não é anexo.
 *
 * A MESMA CEGUEIRA DO #261, na versão BODYSTRUCTURE: escolher o PLAIN só
 * porque ele existe. Quando o plain vem com 0 byte (Apple Mail/Gmail em
 * multipart/alternative), quem chama testa `pt.bytes > 0`, desiste, e a
 * mensagem sai como "(corpo NÃO baixado)" — com o texto do aluno inteirinho
 * no html ao lado, nunca olhado. Aqui a preferência passa a ser por parte que
 * TEM conteúdo; a ordem plain > html só decide entre as que têm.
 */
function parteDeTexto(partes) {
  const corpoDeTexto = (p) => p.tipo === "TEXT" && !ehAnexo(p);
  const comConteudo = (p) => corpoDeTexto(p) && p.bytes > 0;
  return (
    partes.find((p) => comConteudo(p) && p.subtipo === "PLAIN") ||
    partes.find((p) => comConteudo(p) && p.subtipo === "HTML") ||
    // Nenhuma com bytes: devolve a que existe pra quem chama decidir (ele já
    // trata `bytes <= 0` mantendo o aviso de corpo não baixado).
    partes.find((p) => corpoDeTexto(p) && p.subtipo === "PLAIN") ||
    partes.find((p) => corpoDeTexto(p) && p.subtipo === "HTML") ||
    null
  );
}

/** Buffer → string: tenta utf8 e cai pra latin1 se vier caractere de troca. */
function textoDoBuffer(buf) {
  const utf8 = buf.toString("utf8");
  return /�/.test(utf8) ? buf.toString("latin1") : utf8;
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

/**
 * Envios que SAÍRAM mas cuja cópia não entrou em Enviados (incidente #210).
 * O `enviar_email.cjs` grava esses casos em `_frank/prova/enviados_local.jsonl`
 * depois de 3 tentativas de APPEND falharem. Sem ler este arquivo aqui, a ronda
 * seguinte enxerga silêncio onde houve resposta e escreve de novo pro aluno —
 * que é exatamente o dano que o incidente descreve. Registro que ninguém lê não
 * conserta nada, então a leitura mora do lado da consulta.
 */
function registroLocalDeEnvios(para) {
  const arquivo = path.join(RAIZ, "_frank", "prova", "enviados_local.jsonl");
  if (!fs.existsSync(arquivo)) return [];
  return fs
    .readFileSync(arquivo, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((r) => !para || String(r.para || "").toLowerCase() === para.toLowerCase());
}

function mostrarRegistroLocal(para) {
  const linhas = registroLocalDeEnvios(para);
  if (!linhas.length) return;
  console.log("");
  console.log("⚠️  ENVIOS SEM CÓPIA EM ENVIADOS (registro local — incidente #210)");
  console.log("   O e-mail SAIU (SMTP aceitou). O que falhou foi gravar a cópia.");
  console.log("   NÃO trate como silêncio e NÃO reenvie só por não achar acima.");
  for (const r of linhas) {
    console.log(`   · ${r.at} → ${r.para} · "${r.assunto}"`);
    console.log(`     message-id ${r.message_id} · motivo: ${r.motivo}`);
  }
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
  const anexosUid = Number(pega("--anexos") || 0);
  const mimeUid = Number(pega("--mime") || 0);
  const salvarEm = pega("--salvar-em");

  if (!de && !ultimos && !enviados && !fila && !caixas && !anexosUid && !mimeUid) {
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
        "  --anexos <uid>            baixa os anexos desse uid (INBOX) pra disco",
        "  --mime <uid>              grava o MIME CRU desse uid num .eml (pra virar",
        "                            amostra de teste quando o parser erra — #261)",
        "  --salvar-em <dir|arq>     destino dos anexos (default _Bugs/anexos/<uid>/)",
        "                            ou do .eml (default _Bugs/mime/<uid>.eml)",
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

    if (anexosUid) {
      // Download DELIBERADO de anexo de UM uid (nunca acontece na listagem).
      // EXAMINE + BODY.PEEK: mesmo baixando, a mensagem NÃO vira lida — e a
      // prova é impressa (flags + contagem de UNSEEN antes/depois).
      const { baixarAnexos } = require("./_anexos.cjs");
      await sessao.command("EXAMINE INBOX");
      const flagsDe = async () =>
        (await sessao.command(`UID FETCH ${anexosUid} (FLAGS)`)).match(/FLAGS \(([^)]*)\)/)?.[1] ?? "(uid não encontrado)";
      const naoLidos = async () => uidsDaBusca(await sessao.command("UID SEARCH UNSEEN")).length;

      const [flagsAntes, filaAntes] = [await flagsDe(), await naoLidos()];
      const dir = salvarEm || path.join(RAIZ, "_Bugs", "anexos", String(anexosUid));
      const salvos = await baixarAnexos(sessao, anexosUid, dir, { extrairLiteral, decodeWord, fmtBytes });
      const [flagsDepois, filaDepois] = [await flagsDe(), await naoLidos()];

      console.log("");
      console.log(`salvos: ${salvos.length} arquivo(s) em ${dir}`);
      console.log(`flags do uid ${anexosUid} antes: [${flagsAntes}] · depois: [${flagsDepois}] ${flagsAntes === flagsDepois ? "✓ intactas" : "⚠️ MUDARAM — avise o Johnny"}`);
      console.log(`não-lidos no INBOX antes: ${filaAntes} · depois: ${filaDepois} ${filaAntes === filaDepois ? "✓ fila da Fast intacta" : "⚠️ MUDOU — avise o Johnny"}`);
      return;
    }

    if (mimeUid) {
      // MIME CRU de UM uid, pra disco. Nasceu do #261: o parser devolvia corpo
      // vazio e não existia jeito sancionado de olhar a mensagem que causou
      // isso — sem a amostra, o teste vira chute. As regras não mudam: EXAMINE
      // (read-only no protocolo) + BODY.PEEK (não marca \Seen), e a prova de
      // que nada mexeu sai impressa, igual ao --anexos.
      //
      // Vai pra ARQUIVO, nunca pro stdout: MIME de aluno tem dado pessoal e
      // este repositório é público. _Bugs/ é ignorado pelo git de propósito.
      await sessao.command("EXAMINE INBOX");
      const flagsDe = async () =>
        (await sessao.command(`UID FETCH ${mimeUid} (FLAGS)`)).match(/FLAGS \(([^)]*)\)/)?.[1] ?? "(uid não encontrado)";
      const naoLidos = async () => uidsDaBusca(await sessao.command("UID SEARCH UNSEEN")).length;

      const [flagsAntes, filaAntes] = [await flagsDe(), await naoLidos()];
      const buf = await sessao.commandRaw(`UID FETCH ${mimeUid} BODY.PEEK[]`);
      const raw = extrairLiteral(buf);
      const [flagsDepois, filaDepois] = [await flagsDe(), await naoLidos()];

      if (!raw) {
        console.error(`uid ${mimeUid}: nada veio do BODY.PEEK[] — esse uid existe no INBOX?`);
        process.exit(1);
      }
      const destino = salvarEm || path.join(RAIZ, "_Bugs", "mime", `${mimeUid}.eml`);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      // extrairLiteral devolve string LATIN1 (byte a byte). Gravar como latin1
      // devolve o MIME idêntico ao que veio do socket — se gravasse em utf8,
      // a amostra sairia corrompida justo nos acentos, que é onde o parser erra.
      fs.writeFileSync(destino, Buffer.from(raw, "latin1"));

      const texto = mailText(raw, maxCorpo);
      console.log(`MIME cru do uid ${mimeUid} salvo em ${destino} (${fmtBytes(raw.length)})`);
      console.log(`o parser tira deste MIME: ${texto ? `${texto.length} chars` : "NADA — é um caso do #261"}`);
      console.log(`flags do uid ${mimeUid} antes: [${flagsAntes}] · depois: [${flagsDepois}] ${flagsAntes === flagsDepois ? "✓ intactas" : "⚠️ MUDARAM — avise o Johnny"}`);
      console.log(`não-lidos no INBOX antes: ${filaAntes} · depois: ${filaDepois} ${filaAntes === filaDepois ? "✓ fila da Fast intacta" : "⚠️ MUDOU — avise o Johnny"}`);
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
      // Este é o caminho perigoso do #210: "nada encontrado" lido como "nunca
      // foi respondido". Se houver envio registrado localmente, ele aparece.
      if (enviados) mostrarRegistroLocal(para);
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
        let partes = [];
        try {
          const bs = await sessao.command(`UID FETCH ${uid} BODYSTRUCTURE`);
          anexos = anexosDoBodystructure(bs).map((nome) => ({ nome, bytes: 0 }));
          try {
            partes = partesDoBodystructure(bs);
          } catch {
            /* parser é best-effort: sem partes, cai no aviso de corpo não baixado */
          }
        } catch {
          /* estrutura é best-effort */
        }

        // A mensagem é grande POR CAUSA DO ANEXO — o texto que o aluno escreveu
        // é um MIME part de poucos KB e dá pra buscar SOZINHO com BODY.PEEK[n],
        // sem arrastar o anexo. Antes disso, 5 alunos escreveram com anexo
        // grande e o texto deles nunca foi lido por ninguém (uma aluna ficou 62h
        // sem resposta). Se qualquer passo falhar, o aviso acima FICA: degradar
        // pra corpo vazio, em silêncio, é o que causou o incidente.
        const pt = parteDeTexto(partes);
        if (pt && pt.bytes > 0 && pt.bytes <= MAX_PARTE_TEXTO_BYTES) {
          try {
            // PEEK também aqui: buscar o texto não pode marcar \Seen (regra 1).
            const bufT = await sessao.commandRaw(`UID FETCH ${uid} BODY.PEEK[${pt.numero}]`);
            const bruto = extrairLiteral(bufT);
            if (bruto) {
              const cru = textoDoBuffer(decodificarParte(bruto, pt.encoding));
              // Mesmo tratamento do caminho normal (mailText): html vira texto,
              // plain só colapsa espaço em branco.
              const texto = pt.subtipo === "HTML" ? stripHtml(cru) : cru.replace(/\s+/g, " ").trim();
              if (texto) {
                corpo = [
                  `(anexo não baixado — mensagem de ${fmtBytes(tam)}; texto abaixo é a parte MIME ${pt.numero})`,
                  "",
                  texto.slice(0, maxCorpo),
                ].join("\n");
              }
            }
          } catch {
            /* mantém o aviso de corpo não baixado — nunca vira vazio */
          }
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
    // Mesmo achando cópias, pode haver envio MAIS RECENTE que não foi gravado.
    if (enviados) mostrarRegistroLocal(para);
  } finally {
    sessao.close();
  }
}

// Só roda a CLI quando chamada direto. Ser `require`-ável é o que permite
// testar as funções puras sem abrir socket com o servidor de e-mail
// (`node --test _frank/ferramentas/ler_caixa.test.cjs`) — mesmo padrão do
// dryrun_trial_expiry_v2.cjs.
if (require.main === module) {
  main().catch((e) => {
    console.error("ler_caixa falhou:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

// Só as funções PURAS (zero IO). Nada de Sessao/login/main aqui: esta
// ferramenta não vira biblioteca de leitura de caixa pra ninguém.
module.exports = { mailText, stripHtml, parteDeTexto, extrairParte };
