/**
 * CORPO LEGÍVEL de um e-mail cru. Módulo PURO (zero IO, zero import) — o lado
 * que decide o que fazer com o texto vive em `mail-respond.ts`. A separação é
 * o mesmo desenho do `mail-bounce.ts` e existe por um motivo prático: assim o
 * parser roda em `node --test` sem arrastar Supabase, SMTP e alias `@/` junto.
 *
 * POR QUE EXISTE (incidente #261, medido 05/09). A parte era escolhida pela
 * PRESENÇA do cabeçalho, nunca pelo conteúdo dela:
 *
 *     const idx = plainIdx >= 0 ? plainIdx : htmlIdx;   // ← o bug
 *
 * Em `multipart/alternative` de Apple Mail e Gmail o `text/plain` pode vir
 * VAZIO (o boundary da próxima parte vem logo depois do cabeçalho) com a
 * mensagem inteira no `text/html`. O `idx` casava o plain, o recorte devolvia
 * string vazia, e o html — que tinha tudo — nunca era olhado. Lá em cima, no
 * mail-respond, corpo vazio caía num `markSeen` calado: sem resposta, sem
 * escalação, sem incidente, sem rastro. Foi assim que a mensagem de uma aluna
 * (uid 436 do INBOX, 04/09, 7 KB) ficou ~20h no vazio e ninguém soube.
 *
 * A CORREÇÃO é tentar as partes EM ORDEM e aceitar a primeira que tenha
 * conteúdo de verdade: plain primeiro (é o que o humano escreveu, sem tag),
 * html como rede. Ninguém perde nada — quando o plain tem texto, o resultado é
 * byte a byte o de antes.
 *
 * ⚠️ ARMADILHA ao trocar de parte no meio do caminho: a decisão de
 * quoted-printable/base64 sai do `headBlock`, e o headBlock é da parte
 * ESCOLHIDA. Reaproveitar o headBlock do plain pra decodificar o html devolve
 * lixo (base64 aplicado em texto puro, `=3D` sobrando na tela). Por isso
 * `extrairParte()` recebe o índice e recalcula TUDO — recorte, headBlock,
 * boundary e encoding — a cada tentativa. Não existe estado compartilhado
 * entre uma tentativa e outra de propósito.
 */

/** O que vai pro modelo (e-mail tem assinatura e quote longos). */
export const BODY_MAX = 4000;

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
 * Recorta e decodifica UMA parte MIME, do índice do `Content-Type` dela até o
 * próximo boundary. `idx < 0` significa "não achei cabeçalho de parte nenhum":
 * trata a mensagem inteira como corpo, que é o comportamento antigo pra
 * e-mail sem multipart.
 *
 * Tudo aqui é derivado do `idx` recebido. Nada vem de fora — é essa
 * propriedade que torna seguro chamar a função duas vezes com partes
 * diferentes.
 */
function extrairParte(raw: string, idx: number, html: boolean): string {
  let seg = idx >= 0 ? raw.slice(idx) : raw;
  // headBlock SEMPRE desta parte: é ele que manda no decode logo abaixo.
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
  // Bytes UTF-8 lidos como latin1 → reconverte se sair limpo.
  try {
    const round = Buffer.from(text, "latin1").toString("utf8");
    if (!/�/.test(round)) text = round;
  } catch {
    /* mantém */
  }
  return text;
}

/**
 * Texto do e-mail: `text/plain` quando ele tem conteúdo, `text/html` sem tags
 * quando o plain vem vazio, a mensagem crua quando não há parte nenhuma.
 *
 * Devolve "" só quando NENHUMA das partes tem texto — e nesse caso quem chama
 * precisa tratar isso como evento, não como silêncio (ver #261 no
 * mail-respond).
 */
export function mailText(raw: string): string {
  const plainIdx = raw.search(/Content-Type:\s*text\/plain/i);
  const htmlIdx = raw.search(/Content-Type:\s*text\/html/i);

  const tentativas: Array<{ idx: number; html: boolean }> = [];
  if (plainIdx >= 0) tentativas.push({ idx: plainIdx, html: false });
  if (htmlIdx >= 0) tentativas.push({ idx: htmlIdx, html: true });
  // Sem cabeçalho de parte: o corpo é a mensagem inteira (e-mail simples).
  if (tentativas.length === 0) tentativas.push({ idx: -1, html: false });

  for (const t of tentativas) {
    const texto = extrairParte(raw, t.idx, t.html);
    if (texto.trim()) return texto.slice(0, BODY_MAX);
  }
  return "";
}
