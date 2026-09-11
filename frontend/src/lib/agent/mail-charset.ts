/**
 * Bytes de uma parte MIME → texto, usando o CHARSET DECLARADO pelo remetente.
 *
 * POR QUE ESTE MÓDULO EXISTE (incidente #320, medido em 09/09)
 *
 * O `mailText` antigo nunca lia o charset. Ele decodificava o transfer encoding
 * (quoted-printable/base64) para uma STRING onde cada caractere valia um BYTE
 * cru, fazia as operações de texto em cima dessa string de bytes, e só no fim
 * tentava um round-trip `latin1 → utf8` que era TUDO-OU-NADA: um único U+FFFD
 * em qualquer lugar — inclusive na CITAÇÃO do e-mail anterior, que nem é do
 * aluno — rejeitava a conversão inteira e a Fast lia a frase do aluno em
 * mojibake. 25 de 42 e-mails com acento chegaram assim.
 *
 * A CAUSA DE RAIZ é mais funda do que o charset ignorado, e foi medida byte a
 * byte nos uids 460, 484, 498 e 503: rodar `.replace(/\s+/g, " ")` sobre a
 * string de BYTES destrói UTF-8. Em JavaScript `\s` casa U+00A0, e 0xA0 é o
 * único byte de continuação UTF-8 (0x80–0xBF) que cai na classe `\s`. Ou seja,
 * o colapso de espaço em branco comia o segundo byte de qualquer sequência
 * terminada em 0xA0 — entre elas o `à` (C3 A0), campeão de frequência em
 * português ("às 10:50"). O byte 0xC3 ficava órfão e virava U+FFFD; o U+FFFD
 * então condenava o texto todo pela guarda tudo-ou-nada.
 *
 * Nos 4 e-mails auditados, 100% dos U+FFFD sumiam quando o colapso NÃO era
 * feito em cima dos bytes. Daí a regra deste módulo, e a ordem que o `mailText`
 * agora obedece:
 *
 *     bytes → TEXTO (charset declarado) → só então operações de texto
 *
 * Nunca o contrário. E a decisão nunca é tudo-ou-nada: byte ruim de verdade
 * vira U+FFFD SÓ naquele ponto, e o resto da frase continua legível.
 */

/** Charset declarado no bloco de cabeçalho da parte (`charset="utf-8"`). */
export function charsetDeclarado(headBlock: string): string | null {
  const m = headBlock.match(/charset\s*=\s*"?([A-Za-z0-9._:+-]+)"?/i);
  return m ? m[1].toLowerCase().replace(/^["']|["']$/g, "") : null;
}

type Familia = "utf-8" | "single-byte" | "utf-16le" | "utf-16be" | null;

/** Nome declarado → família que a gente sabe decodificar. `null` = não conheço. */
function familiaDe(charset: string | null): Familia {
  if (!charset) return null;
  const c = charset.replace(/[^a-z0-9]/g, "");
  if (c === "utf8" || c === "utf" || c === "unicode11utf8") return "utf-8";
  if (c === "usascii" || c === "ascii" || c === "ansix341968" || c === "iso646us") return "utf-8"; // ASCII é subconjunto
  if (/^iso8859\d*$/.test(c) || c === "latin1" || c === "latin9" || c === "l1" || c === "cp819") {
    return "single-byte";
  }
  if (c === "windows1252" || c === "cp1252" || c === "ansi" || c === "windows1250" || c === "cp1250") {
    return "single-byte";
  }
  if (c === "utf16" || c === "utf16le" || c === "ucs2" || c === "unicode") return "utf-16le";
  if (c === "utf16be") return "utf-16be";
  return null;
}

/**
 * Tabela do windows-1252 para 0x80–0x9F — a ÚNICA faixa em que ele difere do
 * latin1. É onde moram as aspas curvas e o travessão que o Outlook manda em
 * português; sem a tabela viravam caractere de controle invisível.
 * Buffer do Node não conhece cp1252, e o projeto não puxa dependência pra isso
 * (mesmo padrão do IMAP/SMTP falados na mão) — 32 entradas resolvem.
 */
const CP1252_ALTO = [
  "€", "", "‚", "ƒ", "„", "…", "†", "‡",
  "ˆ", "‰", "Š", "‹", "Œ", "", "Ž", "",
  "", "‘", "’", "“", "”", "•", "–", "—",
  "˜", "™", "š", "›", "œ", "", "ž", "Ÿ",
];

/** Bytes de 1 byte/char → texto, com a correção cp1252 na faixa 0x80–0x9F. */
function decodificarSingleByte(buf: Buffer): string {
  let out = "";
  for (const b of buf) out += b >= 0x80 && b <= 0x9f ? CP1252_ALTO[b - 0x80] : String.fromCharCode(b);
  return out;
}

/** O buffer é UTF-8 ESTRITAMENTE válido? (sem inventar U+FFFD em lugar nenhum) */
export function utf8Valido(buf: Buffer): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

function contar(texto: string, alvo: (c: string) => boolean): number {
  let n = 0;
  for (const c of texto) if (alvo(c)) n++;
  return n;
}

/**
 * Fração de U+FFFD acima da qual a gente conclui que o charset declarado MENTIU
 * (cliente que diz UTF-8 e manda latin1). Abaixo dela, os bytes ruins são
 * resíduo — tipicamente lixo colado na citação de um e-mail anterior — e a
 * decodificação declarada VALE, com o U+FFFD isolado só onde o byte era ruim.
 *
 * É este número que substitui o tudo-ou-nada: antes, 1 U+FFFD em 2908 chars
 * (0,07%) condenava o texto inteiro do aluno.
 */
const LIMITE_DECLARACAO_MENTIROSA = 0.5;

/**
 * Bytes → texto pelo charset DECLARADO, com desempate por medição quando a
 * declaração não bate com os bytes.
 *
 * Nunca é tudo-ou-nada: um byte quebrado corrompe UM caractere, jamais a
 * mensagem inteira.
 */
export function decodificarBytes(buf: Buffer, charset: string | null): string {
  if (!buf.length) return "";
  const familia = familiaDe(charset);

  if (familia === "utf-16le" || familia === "utf-16be") {
    // BOM manda mais que o rótulo; UTF-16BE precisa de swap (Node só tem LE).
    if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
      return Buffer.from(buf.subarray(2)).swap16().toString("utf16le");
    }
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.subarray(2).toString("utf16le");
    }
    const par = buf.length % 2 ? buf.subarray(0, buf.length - 1) : buf;
    return familia === "utf-16be"
      ? Buffer.from(par).swap16().toString("utf16le")
      : par.toString("utf16le");
  }

  if (familia === "single-byte") {
    // Declarou latin1/cp1252. Se na verdade vierem bytes UTF-8 válidos (cliente
    // que erra o rótulo pro outro lado), o texto sairia todo em "Ã©" — quando o
    // buffer é UTF-8 estritamente válido E tem multibyte, o rótulo está errado.
    if (utf8Valido(buf) && buf.some((b) => b >= 0x80)) return buf.toString("utf8");
    return decodificarSingleByte(buf);
  }

  // UTF-8 declarado, ou charset ausente/desconhecido: UTF-8 é o padrão da
  // internet moderna e o palpite certo na esmagadora maioria.
  const comoUtf8 = buf.toString("utf8");
  const ruins = contar(comoUtf8, (c) => c === "�");
  if (ruins === 0) return comoUtf8;

  // Sobrou byte ruim: é resíduo ou a declaração mentiu? Mede em vez de adivinhar.
  const naoAscii = contar(comoUtf8, (c) => c.codePointAt(0)! > 0x7f);
  if (naoAscii > 0 && ruins / naoAscii < LIMITE_DECLARACAO_MENTIROSA) return comoUtf8;
  return decodificarSingleByte(buf);
}

/**
 * Texto quoted-printable → BYTES (não string de bytes).
 *
 * Devolver Buffer é o ponto do módulo: é o que permite decodificar pelo charset
 * antes de qualquer operação de texto. Entrada é a parte crua lida do socket,
 * onde 1 char = 1 byte (o IMAP é lido como latin1 em mail-imap.ts).
 */
export function bytesDeQuotedPrintable(seg: string): Buffer {
  const semSoftBreak = seg.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < semSoftBreak.length; i++) {
    const c = semSoftBreak[i];
    const hex = c === "=" ? semSoftBreak.slice(i + 1, i + 3) : "";
    if (hex.length === 2 && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(semSoftBreak.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/**
 * Parte crua (string de bytes) + transfer encoding + charset → texto de verdade.
 * Único ponto do código que decide "bytes viram texto assim".
 */
export function parteParaTexto(seg: string, transferEncoding: string, charset: string | null): string {
  const enc = (transferEncoding || "").toLowerCase();
  let buf: Buffer;
  if (enc.includes("quoted-printable")) {
    buf = bytesDeQuotedPrintable(seg);
  } else if (enc.includes("base64")) {
    buf = Buffer.from(seg.replace(/\s+/g, ""), "base64");
  } else {
    buf = Buffer.from(seg, "latin1"); // 7bit/8bit/binary: já são os bytes
  }
  return decodificarBytes(buf, charset);
}

// ---------- parse MIME mínimo (texto legível de um e-mail cru) ----------

const BODY_MAX = 4000; // o que vai pro modelo (e-mails têm assinatura/quote longos)

/**
 * Decodifica encoded-words de cabeçalho (`=?UTF-8?Q?...?=`, RFC 2047).
 *
 * O charset vem DENTRO do próprio encoded-word e era descartado (o parâmetro
 * se chamava `_cs`): tudo era convertido como se fosse UTF-8, então um
 * `=?ISO-8859-1?Q?...?=` — formato que Outlook antigo ainda manda — virava
 * U+FFFD no Assunto. Mesma raiz do corpo (#320): charset declarado, ignorado.
 */
export function decodeWord(s: string): string {
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (m, cs, enc, data) => {
    try {
      const charset = String(cs).toLowerCase();
      if (String(enc).toUpperCase() === "B") {
        return decodificarBytes(Buffer.from(String(data), "base64"), charset);
      }
      return decodificarBytes(bytesDeQuotedPrintable(String(data).replace(/_/g, " ")), charset);
    } catch {
      return m;
    }
  });
}

export function header(raw: string, name: string): string {
  const m = raw.match(new RegExp(`^${name}: (.*(?:\\r?\\n[ \\t].*)*)`, "mi"));
  return m ? decodeWord(m[1].replace(/\r?\n[ \t]+/g, " ").trim()) : "";
}

export function stripHtml(s: string): string {
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
 * Extrai o texto do e-mail: parte text/plain (ou html sem tags).
 *
 * ORDEM QUE NÃO PODE SER INVERTIDA (incidente #320): primeiro os BYTES viram
 * TEXTO pelo charset declarado, e só depois vêm as operações de texto
 * (stripHtml, colapso de espaço em branco).
 *
 * A versão antiga fazia o contrário e por isso corrompia 25 de 42 e-mails com
 * acento. Dois defeitos encadeados, ambos medidos byte a byte nos uids 460,
 * 484, 498 e 503:
 *
 *   1. `.replace(/\s+/g, " ")` rodava sobre a string de BYTES. Em JavaScript
 *      `\s` casa U+00A0, e 0xA0 é o único byte de continuação UTF-8 (0x80–0xBF)
 *      que cai nessa classe — então o colapso comia o segundo byte do `à`
 *      (C3 A0), o acento mais comum do português ("às 10:50"), e deixava o
 *      0xC3 órfão. O U+FFFD NASCIA AQUI: não vinha do e-mail do aluno.
 *   2. A guarda anti-mojibake era TUDO-OU-NADA: aquele U+FFFD, mesmo tendo
 *      nascido dentro da CITAÇÃO do e-mail anterior, rejeitava a conversão do
 *      texto INTEIRO — e a fala do aluno chegava em mojibake ao cérebro da Fast.
 *
 * Nos 4 e-mails auditados, 100% dos U+FFFD desapareceram só de respeitar a
 * ordem. O charset declarado (que estava no MIME e era ignorado) passa a
 * mandar, e a decisão sobre byte ruim virou por fração, nunca tudo-ou-nada.
 * Ver `mail-charset.ts`.
 */
/**
 * As fronteiras MIME REALMENTE declaradas nos cabeçalhos da mensagem.
 *
 * ⚠️ POR QUE ISTO EXISTE (medido em 10/09/2026, incidente do Marcelo).
 * A versão anterior não lia `boundary=` nenhum: ADIVINHAVA a fronteira com
 * `/\r?\n--[-=_a-zA-Z0-9]{6,}/`, isto é, "linha que começa com `--` e mais 6
 * caracteres". Só que o Gmail abre todo encaminhamento com a linha
 *
 *     --------- Mensagem encaminhada ---------
 *
 * que casa nesse padrão (`--` + 7 hifens). O corpo inteiro era decepado no
 * caractere 1 e `mailText` devolvia STRING VAZIA — e em `mail-respond.ts:256`
 * corpo com menos de 5 chars é `markSeen` + `skipped`, ou seja a mensagem do
 * aluno era marcada como lida e descartada em silêncio.
 *
 * Custo real medido: `marcelopersonalthe32@gmail.com`, pagante, escreveu em
 * 09/09 19:37Z encaminhando o nosso próprio aviso de prazo com a frase dele no
 * fim — *"Eu não quero mais seguir no programa."* — que é exatamente o pedido
 * de saída que a casa tinha pedido por escrito ("me responda dizendo isso até
 * 11/09"). O texto estava no MIME cru (3.513 bytes de `text/plain`); a Fast
 * recebeu `""`. A janela de reembolso dele fechava em 11/09.
 *
 * A correção não é alargar o palpite: é PARAR DE ADIVINHAR. Fronteira MIME não
 * se deduz do formato da linha, ela vem declarada em `boundary=` no
 * `Content-Type` — e mensagem de uma parte só não tem fronteira nenhuma, então
 * qualquer `-----` no corpo dela é CONTEÚDO e não separador.
 */
export function fronteirasDeclaradas(raw: string): string[] {
  const achadas: string[] = [];
  // `boundary="com espaço"` ou `boundary=semaspas`; RFC 2046 permite
  // ' ( ) + _ , - . / : = ? além de alfanumérico, daí não dá pra restringir.
  const re = /boundary\s*=\s*(?:"([^"\r\n]+)"|([^\s;"\r\n]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const b = (m[1] ?? m[2] ?? "").trim();
    if (b && !achadas.includes(b)) achadas.push(b);
  }
  return achadas;
}

/** Escapa a fronteira pra ela entrar num RegExp como texto literal. */
function comoLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Corta `seg` na PRIMEIRA fronteira declarada que aparecer nele.
 * Sem fronteira declarada (mensagem de uma parte só), não corta nada.
 *
 * Segue PRIVADA de propósito. O `_frank/ferramentas/ler_caixa.cjs` consome
 * esta regra pelo `mailText` — uma porta só, em vez de remontar o pipeline por
 * fora. O #351 nasceu exatamente de remontar: a correção do #337 entrou em
 * produção e o porte da ferramenta ficou com o palpite antigo, então o Vigia
 * lia como VAZIO justamente os encaminhamentos do Gmail, que é o formato em
 * que o aluno contesta cobrança. Duas implementações da mesma regra sempre
 * voltam a divergir; uma só, não.
 */
function cortarNaFronteira(seg: string, fronteiras: string[]): string {
  let corte = -1;
  for (const b of fronteiras) {
    const i = seg.search(new RegExp(`\\r?\\n--${comoLiteral(b)}`));
    if (i > 0 && (corte < 0 || i < corte)) corte = i;
  }
  return corte > 0 ? seg.slice(0, corte) : seg;
}

/**
 * `maxChars` é opcional e o default é o teto de produção (`BODY_MAX`), então
 * toda chamada existente (`mailText(raw)`) segue idêntica. O parâmetro existe
 * pro `ler_caixa.cjs` honrar o `--corpo N` SEM precisar de um segundo
 * `mailText` — foi a segunda cópia que criou o #351.
 */
export function mailText(raw: string, maxChars: number = BODY_MAX): string {
  const plainIdx = raw.search(/Content-Type:\s*text\/plain/i);
  const htmlIdx = raw.search(/Content-Type:\s*text\/html/i);
  const idx = plainIdx >= 0 ? plainIdx : htmlIdx;
  const fronteiras = fronteirasDeclaradas(raw);
  let seg = idx >= 0 ? raw.slice(idx) : raw;
  const headBlock = seg.slice(0, 400);
  const start = seg.search(/\r?\n\r?\n/);
  seg = start >= 0 ? seg.slice(start) : seg;
  seg = cortarNaFronteira(seg, fronteiras);

  // BYTES → TEXTO. Depois desta linha não existe mais byte cru no fluxo: `seg`
  // era string onde 1 char = 1 byte, `texto` é texto de verdade.
  const encoding = /quoted-printable/i.test(headBlock)
    ? "quoted-printable"
    : /base64/i.test(headBlock)
      ? "base64"
      : "";
  let texto: string;
  try {
    texto = parteParaTexto(seg, encoding, charsetDeclarado(headBlock));
  } catch {
    texto = seg; // best-effort: pior o corpo cru do que a Fast ficar muda
  }

  // Só agora, com TEXTO na mão, as operações de texto.
  const limpo = idx === htmlIdx && idx >= 0 ? stripHtml(texto) : texto.replace(/\s+/g, " ").trim();
  return limpo.slice(0, maxChars);
}
