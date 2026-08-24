/**
 * Cliente IMAP mínimo (TLS puro, zero dependências — padrão do projeto de
 * falar protocolo na mão, igual Resend/RunPod via REST).
 *
 * Só o que a Fast precisa: listar NÃO LIDOS do INBOX, baixar a mensagem
 * crua e marcar como lida. Servidor: Namecheap Private Email (suporte@).
 *
 * Envs: SUPPORT_MAIL_HOST (default mail.privateemail.com) ·
 * SUPPORT_MAIL_USER (default suporte@fastcloner.com) · SUPPORT_MAIL_PASSWORD.
 */
import tls from "node:tls";

const HOST = () => process.env.SUPPORT_MAIL_HOST || "mail.privateemail.com";
const USER = () => process.env.SUPPORT_MAIL_USER || "suporte@fastcloner.com";
const PASS = () => process.env.SUPPORT_MAIL_PASSWORD || "";

export function supportMailConfigured(): boolean {
  return Boolean(PASS());
}

/** Sessão IMAP: comandos sequenciais com tag, resposta acumulada em Buffer. */
class ImapSession {
  private socket: tls.TLSSocket | null = null;
  private buffer = Buffer.alloc(0);
  private seq = 0;

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const s = tls.connect({ host: HOST(), port: 993, servername: HOST() }, () => resolve());
      s.on("error", reject);
      s.setTimeout(30_000, () => {
        s.destroy();
        reject(new Error("IMAP timeout"));
      });
      s.on("data", (chunk: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
      });
      this.socket = s;
    });
    await this.waitFor(/^\* OK/m); // greeting
  }

  /**
   * Espera o buffer casar com o padrão (linha de conclusão do comando).
   *
   * ⚠️ Só olha o FIM do buffer. A versão antiga convertia o buffer inteiro em
   * texto a cada 50ms: com uma mensagem de 33MB na caixa (aconteceu em 08/08),
   * eram 33MB moídos 20 vezes por segundo — a checagem ficava mais lenta que a
   * chegada dos dados e o timeout estourava SEMPRE. A Fast ficou 2 dias muda
   * por causa disso, tentando a mesma mensagem de 5 em 5 minutos.
   */
  private waitFor(pattern: RegExp, timeoutMs = 30_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        // A linha de conclusão está sempre no fim; 4KB cobrem com folga.
        const cauda = this.buffer.subarray(Math.max(0, this.buffer.length - 4096)).toString("latin1");
        if (pattern.test(cauda)) return resolve(this.buffer.toString("latin1"));
        if (Date.now() - started > timeoutMs) return reject(new Error("IMAP resposta demorou"));
        setTimeout(tick, 50);
      };
      tick();
    });
  }

  /** Executa um comando e devolve a resposta completa (até o tag OK/NO/BAD). */
  async command(cmd: string): Promise<string> {
    if (!this.socket) throw new Error("IMAP sem conexão");
    const tag = `a${++this.seq}`;
    this.buffer = Buffer.alloc(0);
    this.socket.write(`${tag} ${cmd}\r\n`);
    const res = await this.waitFor(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) {
      throw new Error(`IMAP ${cmd.split(" ")[0]} falhou: ${res.slice(-200)}`);
    }
    return res;
  }

  /** Como command(), mas devolve o Buffer cru (pra literais binários). */
  async commandRaw(cmd: string): Promise<Buffer> {
    await this.command(cmd);
    return this.buffer;
  }

  /**
   * APPEND: grava uma mensagem crua numa pasta (usado pra copiar o que a gente
   * ENVIA pra pasta de enviados — sem isso a caixa Sent fica vazia e ninguém
   * consegue responder "esse aluno já foi avisado?", achado de 19/08).
   *
   * Protocolo: o literal `{N}` exige esperar a continuação `+` do servidor
   * antes de mandar os bytes — mandar direto quebra em servidor sem LITERAL+.
   */
  async append(mailbox: string, flags: string, data: Buffer): Promise<void> {
    if (!this.socket) throw new Error("IMAP sem conexão");
    const tag = `a${++this.seq}`;
    this.buffer = Buffer.alloc(0);
    this.socket.write(`${tag} APPEND "${mailbox}" (${flags}) {${data.length}}\r\n`);
    // Ou o servidor pede continuação ("+ ...") ou já recusa com o tag.
    const go = await this.waitFor(new RegExp(`(^\\+|^${tag} (OK|NO|BAD))`, "m"));
    if (new RegExp(`^${tag} (NO|BAD)`, "m").test(go)) {
      throw new Error(`IMAP APPEND recusado: ${go.slice(-200)}`);
    }
    this.buffer = Buffer.alloc(0);
    this.socket.write(data);
    this.socket.write("\r\n");
    const res = await this.waitFor(new RegExp(`^${tag} (OK|NO|BAD)`, "m"));
    if (!new RegExp(`^${tag} OK`, "m").test(res)) {
      throw new Error(`IMAP APPEND falhou: ${res.slice(-200)}`);
    }
  }

  close(): void {
    try {
      this.socket?.write(`a${++this.seq} LOGOUT\r\n`);
      this.socket?.end();
    } catch {
      /* já caiu */
    }
  }
}

export type RawMail = {
  uid: number;
  raw: string;
  /** Mensagem grande demais: só os cabeçalhos foram baixados (ver MAIL_MAX_BYTES). */
  oversized?: boolean;
  /** Tamanho real da mensagem na caixa, em bytes. */
  sizeBytes?: number;
  /**
   * Só no caso oversized: o TEXTO que o aluno escreveu, buscado sozinho via
   * BODY.PEEK[n] da parte MIME de texto (o anexo continua sem ser baixado).
   * Já decodificado (quoted-printable/base64 + charset), mas ainda cru:
   * quando bodyTextHtml=true é HTML e precisa de stripHtml antes de usar.
   * Ausente quando a mensagem não tem parte de texto (ex.: só anexo) ou
   * quando qualquer passo da busca falhou — aí vale o fluxo antigo.
   */
  bodyText?: string;
  bodyTextHtml?: boolean;
};

/**
 * Teto do que a gente aceita baixar de uma mensagem.
 *
 * A caixa do suporte não é canal de arquivo: um e-mail de 33MB (aluno mandando
 * áudio anexado, 08/08) travou a Fast por 2 dias — ela tentava baixar o mesmo
 * anexo a cada 5 minutos e nunca chegava nos e-mails seguintes da fila.
 * Acima deste teto a gente lê só os cabeçalhos, responde explicando que a
 * caixa não recebe anexo, e segue a vida.
 */
const MAIL_MAX_BYTES = Number(process.env.AGENT_MAIL_MAX_BYTES ?? 2_000_000);

/**
 * Teto PRÓPRIO da parte de texto, deliberadamente separado do MAIL_MAX_BYTES.
 * MAIL_MAX_BYTES olha a mensagem INTEIRA (anexo incluso) e existe pra nunca
 * arrastar 33MB pelo socket. Mas mensagem grande quase sempre é grande POR
 * CAUSA DO ANEXO: o text/plain do aluno tem poucos KB e cabe num BODY.PEEK[n]
 * sozinho. 200KB é folgado pra qualquer e-mail escrito por humano (e pra html
 * pesado de cliente de e-mail) — se a "parte de texto" estourar isso, é anexo
 * disfarçado e a gente prefere não baixar (não trocar um estouro por outro).
 */
const MAIL_MAX_TEXT_PART_BYTES = Number(process.env.AGENT_MAIL_MAX_TEXT_PART_BYTES ?? 200_000);

// ---------- BODYSTRUCTURE: achar e baixar SÓ a parte de texto ----------
//
// Técnica provada em _frank/ferramentas/ler_caixa.cjs (commit 43500d9) contra
// a caixa real: mensagem acima do teto não perde mais o que o aluno ESCREVEU —
// o BODYSTRUCTURE localiza a parte MIME de texto (poucos KB) e ela é buscada
// sozinha com BODY.PEEK[n]. Sem isso, 5 alunos escreveram com anexo grande e o
// texto deles nunca foi lido por ninguém (incidente 531b6529, uma aluna 62h
// sem resposta). O parser abaixo é o MESMO do ler_caixa.cjs (que por sua vez
// espelha _anexos.cjs) portado pra TS — não deixe as cópias divergirem.

type BsNode = string | null | BsNode[];

type MimePart = {
  /** Número IMAP da parte (1, 2, 1.1, ...). */
  numero: string;
  tipo: string;
  subtipo: string;
  encoding: string;
  bytes: number;
  nome: string | null;
  disposition: string | null;
};

/** Tokeniza a resposta: parênteses, strings quotadas (com \" escapado) e átomos. */
function tokenizar(s: string): Array<"(" | ")" | { str: string } | { atom: string }> {
  const toks: Array<"(" | ")" | { str: string } | { atom: string }> = [];
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
      // é melhor do que apontar pra parte errada (quem chama cai no fallback).
      throw new Error("BODYSTRUCTURE veio com literal {n} — parser não suporta");
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
function montarArvore(toks: ReturnType<typeof tokenizar>): BsNode[] {
  let pos = 0;
  function lista(): BsNode[] {
    const out: BsNode[] = [];
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
        if (typeof t === "object") out.push("str" in t ? t.str : t.atom === "NIL" ? null : t.atom);
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
function paresParaObjeto(lista: BsNode): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  if (!Array.isArray(lista)) return out;
  for (let i = 0; i + 1 < lista.length; i += 2) {
    const k = lista[i];
    const v = lista[i + 1];
    if (typeof k === "string") out[k.toUpperCase()] = typeof v === "string" ? v : null;
  }
  return out;
}

/** Numera as partes como o IMAP numera (1, 2, 1.1, ...) e devolve as folhas. */
function coletarPartes(no: BsNode[], prefixo: string): MimePart[] {
  if (Array.isArray(no) && Array.isArray(no[0])) {
    const partes: MimePart[] = [];
    let i = 0;
    while (i < no.length && Array.isArray(no[i])) {
      const numero = prefixo ? `${prefixo}.${i + 1}` : String(i + 1);
      partes.push(...coletarPartes(no[i] as BsNode[], numero));
      i++;
    }
    return partes;
  }
  const [tipo, subtipo, params, , , encoding, tamanho, ...resto] = no;
  const paramsObj = paresParaObjeto(params ?? null);
  let dispTipo: string | null = null;
  let dispParams: Record<string, string | null> = {};
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
function ehAnexo(p: MimePart): boolean {
  return p.disposition === "ATTACHMENT" || Boolean(p.nome);
}

/**
 * Folhas do BODYSTRUCTURE de uma resposta de UID FETCH (lança se não parsear).
 * Exportada pra ferramenta/prova poder usar o MESMO parser da produção.
 */
export function partesDoBodystructure(resposta: string): MimePart[] {
  const linhaFetch = resposta
    .split(/\r?\n/)
    .find((l) => /^\* \d+ FETCH/i.test(l) && /BODYSTRUCTURE/i.test(l));
  if (!linhaFetch) throw new Error("sem linha de BODYSTRUCTURE na resposta");
  const idx = linhaFetch.search(/BODYSTRUCTURE/i);
  return coletarPartes(montarArvore(tokenizar(linhaFetch.slice(idx + "BODYSTRUCTURE".length))), "");
}

/** Primeira parte de texto LEGÍVEL (text/plain > text/html) que não é anexo. */
export function parteDeTexto(partes: MimePart[]): MimePart | null {
  const corpoDeTexto = (p: MimePart) => p.tipo === "TEXT" && !ehAnexo(p);
  return (
    partes.find((p) => corpoDeTexto(p) && p.subtipo === "PLAIN") ||
    partes.find((p) => corpoDeTexto(p) && p.subtipo === "HTML") ||
    null
  );
}

/** Decodifica o bloco baixado conforme o encoding declarado no BODYSTRUCTURE. */
export function decodificarParte(textoLatin1: string, encoding: string): Buffer {
  if (encoding === "BASE64") return Buffer.from(textoLatin1.replace(/\s+/g, ""), "base64");
  if (encoding === "QUOTED-PRINTABLE") {
    const s = textoLatin1
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)));
    return Buffer.from(s, "latin1");
  }
  // 7BIT / 8BIT / BINARY: latin1 preserva byte a byte
  return Buffer.from(textoLatin1, "latin1");
}

/** Buffer → string: tenta utf8 e cai pra latin1 se vier caractere de troca. */
export function textoDoBuffer(buf: Buffer): string {
  const utf8 = buf.toString("utf8");
  return /�/.test(utf8) ? buf.toString("latin1") : utf8;
}

/**
 * Busca os e-mails NÃO LIDOS do INBOX (até `limit`), SEM marcar como lidos
 * (BODY.PEEK). Marcação é passo separado — só depois de responder com sucesso.
 *
 * AGENT_MAIL_SINCE (ex.: "4-Aug-2026") limita ao que chegou DEPOIS da
 * ativação — o backlog antigo (já resolvido/estale) fica pro fluxo humano.
 */
export async function fetchUnseen(limit = 10): Promise<RawMail[]> {
  const session = new ImapSession();
  await session.connect();
  try {
    // LOGIN com literal não é preciso: senha sem aspas problemáticas → quoted.
    await session.command(`LOGIN "${USER()}" "${PASS().replace(/(["\\])/g, "\\$1")}"`);
    await session.command("SELECT INBOX");
    const since = (process.env.AGENT_MAIL_SINCE || "").trim();
    const search = await session.command(
      since ? `UID SEARCH UNSEEN SINCE ${since}` : "UID SEARCH UNSEEN",
    );
    const uids = (search.match(/^\* SEARCH([\d ]*)$/m)?.[1] ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number)
      .slice(0, limit);

    // PERGUNTA O TAMANHO ANTES de baixar qualquer coisa. Sem isso, uma única
    // mensagem gigante trava a fila inteira (incidente de 08/08).
    const tamanhos = new Map<number, number>();
    if (uids.length) {
      const info = await session.command(`UID FETCH ${uids.join(",")} (RFC822.SIZE)`);
      for (const linha of info.split(/\r?\n/)) {
        const m = linha.match(/UID (\d+).*RFC822\.SIZE (\d+)|RFC822\.SIZE (\d+).*UID (\d+)/);
        if (!m) continue;
        const uid = Number(m[1] ?? m[4]);
        const size = Number(m[2] ?? m[3]);
        if (uid && size) tamanhos.set(uid, size);
      }
    }

    const out: RawMail[] = [];
    for (const uid of uids) {
      const tamanho = tamanhos.get(uid) ?? 0;

      if (tamanho > MAIL_MAX_BYTES) {
        // Só os cabeçalhos: dá pra saber quem escreveu e sobre o quê, sem
        // arrastar o anexo. Quem responde decide o que fazer (ver mail-respond).
        //
        // X-FAILED-RECIPIENTS entrou na lista por causa do #201: bounce carrega
        // a mensagem original anexada e pode passar do teto. Sem esse cabeçalho
        // o bounce truncado não diz PARA QUEM a entrega falhou — a triagem
        // morreria justamente no dado que a torna útil.
        const bufH = await session.commandRaw(
          `UID FETCH ${uid} BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID REPLY-TO X-FAILED-RECIPIENTS)]`,
        );
        const raw = extrairLiteral(bufH);
        // A mensagem é grande POR CAUSA DO ANEXO — o texto que o aluno escreveu
        // é um MIME part de poucos KB e dá pra buscar SOZINHO, sem arrastar o
        // anexo. Best-effort: se falhar, fica o comportamento antigo (só
        // cabeçalhos) e o mail-respond responde "reenvia menor" como sempre.
        const parte = await buscarParteDeTexto(session, uid);
        out.push({
          uid,
          raw,
          oversized: true,
          sizeBytes: tamanho,
          ...(parte ? { bodyText: parte.texto, bodyTextHtml: parte.html } : {}),
        });
        continue;
      }

      const buf = await session.commandRaw(`UID FETCH ${uid} BODY.PEEK[]`);
      const raw = extrairLiteral(buf);
      if (raw) out.push({ uid, raw, sizeBytes: tamanho });
    }
    return out;
  } finally {
    session.close();
  }
}

/**
 * Busca SÓ a parte MIME de texto de uma mensagem acima do teto.
 *
 * BODY.PEEK também aqui — buscar o texto NÃO pode marcar \Seen: a fila da
 * Fast é UID SEARCH UNSEEN, e marcar lido antes de responder tira o aluno da
 * fila pra sempre, em silêncio. Qualquer falha devolve null (nunca lança):
 * degradar pro aviso antigo é seguro; degradar pra corpo vazio em silêncio
 * foi exatamente o que causou o incidente 531b6529.
 */
async function buscarParteDeTexto(
  session: ImapSession,
  uid: number,
): Promise<{ texto: string; html: boolean } | null> {
  try {
    const bs = await session.command(`UID FETCH ${uid} BODYSTRUCTURE`);
    const pt = parteDeTexto(partesDoBodystructure(bs));
    if (!pt || pt.bytes <= 0 || pt.bytes > MAIL_MAX_TEXT_PART_BYTES) return null;
    const bufT = await session.commandRaw(`UID FETCH ${uid} BODY.PEEK[${pt.numero}]`);
    const bruto = extrairLiteral(bufT);
    if (!bruto) return null;
    const texto = textoDoBuffer(decodificarParte(bruto, pt.encoding));
    if (!texto.trim()) return null;
    return { texto, html: pt.subtipo === "HTML" };
  } catch {
    return null;
  }
}

/** Conteúdo do literal IMAP da resposta: `... {N}\r\n<N bytes>`. */
function extrairLiteral(buf: Buffer): string {
  const cabeca = buf.subarray(0, 4096).toString("latin1");
  const m = cabeca.match(/\{(\d+)\}\r\n/);
  if (!m || m.index === undefined) return "";
  const start = m.index + m[0].length;
  return buf.subarray(start, start + Number(m[1])).toString("latin1");
}

/** Marca uma mensagem como lida (a Fast processou — não reprocessar). */
export async function markSeen(uid: number): Promise<void> {
  const session = new ImapSession();
  await session.connect();
  try {
    await session.command(`LOGIN "${USER()}" "${PASS().replace(/(["\\])/g, "\\$1")}"`);
    await session.command("SELECT INBOX");
    await session.command(`UID STORE ${uid} +FLAGS (\\Seen)`);
  } finally {
    session.close();
  }
}

/**
 * Descobre o nome da pasta de enviados pelo atributo \Sent do LIST — o nome
 * MUDA por servidor ("INBOX.Sent", "Sent", "Sent Items"...), então nome fixo
 * quebra em silêncio (mesma lição do --enviados do ler_caixa.cjs). Cacheado
 * por processo: a pasta não muda entre um envio e outro.
 */
let sentFolderCache: string | null = null;

async function discoverSentFolder(session: ImapSession): Promise<string> {
  if (sentFolderCache) return sentFolderCache;
  const linhas = (await session.command(`LIST "" "*"`))
    .split(/\r?\n/)
    .filter((l) => l.startsWith("* LIST"));
  const nome = (l: string): string =>
    l.match(/"([^"]*)"\s*$/)?.[1] || l.trim().split(/\s+/).pop() || "";
  const porAtributo = linhas.find((l) => /\\Sent/i.test(l));
  const achado = porAtributo
    ? nome(porAtributo)
    : ["INBOX.Sent", "Sent", "Sent Items", "INBOX.Sent Items"].find((c) =>
        linhas.some((l) => nome(l).toLowerCase() === c.toLowerCase()),
      );
  if (!achado) {
    throw new Error(`pasta de enviados não encontrada. Caixas: ${linhas.map(nome).join(", ")}`);
  }
  sentFolderCache = achado;
  return achado;
}

/**
 * Grava a cópia de um e-mail ENVIADO na pasta de enviados (\Seen, pra não
 * inflar contador de não-lido). Chamado pelo mail-smtp DEPOIS do envio — quem
 * chama trata falha como aviso, nunca como erro do envio (o e-mail já saiu).
 */
export async function appendToSentFolder(rawMessage: string): Promise<void> {
  const session = new ImapSession();
  await session.connect();
  try {
    await session.command(`LOGIN "${USER()}" "${PASS().replace(/(["\\])/g, "\\$1")}"`);
    const folder = await discoverSentFolder(session);
    // CRLF obrigatório no literal IMAP (mesma normalização do envio SMTP).
    const data = Buffer.from(rawMessage.replace(/\r?\n/g, "\r\n"), "utf8");
    await session.append(folder, "\\Seen", data);
  } finally {
    session.close();
  }
}
