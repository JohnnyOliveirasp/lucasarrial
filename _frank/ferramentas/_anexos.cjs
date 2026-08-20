/**
 * _anexos.cjs — download de anexos para o ler_caixa.cjs. Não roda sozinho.
 *
 * POR QUE EXISTE: o ler_caixa listava só nome/tamanho de anexo, então o print
 * que o aluno manda ("meus créditos não foram atualizados, conforme print")
 * ficava invisível — e a regra 11 proíbe responder reclamação sem olhar a
 * evidência. Este módulo baixa a PARTE específica do anexo (BODY.PEEK[n]),
 * nunca a mensagem inteira, e nunca no fluxo normal de listagem.
 *
 * REGRAS HERDADAS do ler_caixa (ordem 2026-08-19_ler_caixa.md):
 *   - Caixa aberta com EXAMINE (read-only no protocolo) — feito pelo caller.
 *   - BODY.PEEK sempre: baixar o anexo NÃO pode marcar a mensagem como lida.
 *   - Teto PRÓPRIO por anexo (10MB): o teto de listagem (MAX_BYTES) existe
 *     porque um anexo de 33MB deixou a Fast 2 dias muda em 08/08 — aqui o
 *     download é deliberado (--anexos <uid>), então o teto é maior mas
 *     continua existindo e estourar dá mensagem clara, não travamento.
 */
const fs = require("node:fs");
const path = require("node:path");

/** Teto por anexo. Deliberadamente separado do MAX_BYTES da listagem. */
const MAX_ANEXO_BYTES = 10_000_000;

// ---------- parser de BODYSTRUCTURE (lista parentetizada do RFC 3501) ----------

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
      // Literal {n} no BODYSTRUCTURE (raro; nome de arquivo gigante). Não
      // suportado — melhor falhar com verdade do que baixar a parte errada.
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
  // pula até o primeiro "(" (o corpo do BODYSTRUCTURE)
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

/**
 * Percorre a árvore numerando as partes como o IMAP numera (1, 2, 1.1, ...).
 * Devolve toda parte-folha com o que interessa pra baixar: número, tipo,
 * encoding, tamanho (do bloco ENCODED) e nome de arquivo (disposition > params).
 */
function coletarPartes(no, prefixo) {
  // Multipart: começa com uma ou mais LISTAS (as sub-partes), depois o subtype.
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
  // Parte-folha: (type subtype (params) id desc encoding size [lines/md5] (disposition...) ...)
  const [tipo, subtipo, params, , , encoding, tamanho, ...resto] = no;
  const paramsObj = paresParaObjeto(params);
  let dispTipo = null;
  let dispParams = {};
  for (const el of resto) {
    // disposition = ("ATTACHMENT" ("FILENAME" "x.png")) — é a única lista no
    // rabo cujo primeiro elemento é string e o segundo é lista de pares.
    if (Array.isArray(el) && typeof el[0] === "string" && (Array.isArray(el[1]) || el[1] === null)) {
      dispTipo = el[0].toUpperCase();
      dispParams = paresParaObjeto(el[1]);
      break;
    }
  }
  const nome = dispParams.FILENAME || dispParams["FILENAME*"] || paramsObj.NAME || paramsObj["NAME*"] || null;
  return [
    {
      // mensagem não-multipart: a parte única é a "1"
      numero: prefixo || "1",
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
  // Disposition ATTACHMENT ou QUALQUER parte com nome de arquivo — inclusive
  // INLINE: o print do aluno chega como imagem inline ("[image: image.png]"
  // no Gmail) e é exatamente o que a gente precisa ver.
  return p.disposition === "ATTACHMENT" || !!p.nome;
}

/** Nome seguro pra disco: sem path, sem controle, sem vazio. */
function sanitizarNome(nome, fallback) {
  // [^\w.\-] preserva o ponto da extensao (.png) e troca o resto por _.
  const base = path.basename(String(nome || "").trim()).replace(/[^\w.\-]+/g, "_");
  return base && base !== "." && base !== ".." ? base.slice(0, 120) : fallback;
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

/**
 * Baixa os anexos do uid pra `dir`. O caller já fez LOGIN + EXAMINE INBOX.
 * `helpers` = { extrairLiteral, decodeWord, fmtBytes } do ler_caixa (evita duplicar).
 */
async function baixarAnexos(sessao, uid, dir, helpers) {
  const { extrairLiteral, decodeWord, fmtBytes } = helpers;

  const bs = await sessao.command(`UID FETCH ${uid} BODYSTRUCTURE`);
  const linhaFetch = bs.split(/\r?\n/).find((l) => /^\* \d+ FETCH/i.test(l) && /BODYSTRUCTURE/i.test(l));
  if (!linhaFetch) throw new Error(`uid ${uid}: sem resposta de BODYSTRUCTURE — a mensagem existe no INBOX?`);
  const idx = linhaFetch.search(/BODYSTRUCTURE/i);
  const arvore = montarArvore(tokenizar(linhaFetch.slice(idx + "BODYSTRUCTURE".length)));
  const partes = coletarPartes(arvore, "");
  const anexos = partes.filter(ehAnexo);

  if (!anexos.length) {
    console.log(`uid ${uid}: nenhuma parte de anexo no BODYSTRUCTURE (partes: ${partes.map((p) => `${p.numero}=${p.tipo}/${p.subtipo}`).join(" ")})`);
    return [];
  }

  fs.mkdirSync(dir, { recursive: true });
  const salvos = [];
  for (const [i, a] of anexos.entries()) {
    const nomeCru = a.nome ? decodeWord(a.nome) : null;
    const nome = sanitizarNome(nomeCru, `anexo-${a.numero}.${a.subtipo.toLowerCase() || "bin"}`);
    if (a.bytes > MAX_ANEXO_BYTES) {
      console.log(`✗ ${nome} (parte ${a.numero}): ${fmtBytes(a.bytes)} passa do teto de ${fmtBytes(MAX_ANEXO_BYTES)} por anexo — NÃO baixado. Se precisar mesmo, olhe pelo webmail.`);
      continue;
    }
    // BODY.PEEK[n]: só a parte do anexo, nunca a mensagem inteira, sem marcar lida.
    const buf = await sessao.commandRaw(`UID FETCH ${uid} BODY.PEEK[${a.numero}]`);
    const bruto = extrairLiteral(buf);
    if (!bruto) {
      console.log(`✗ ${nome} (parte ${a.numero}): servidor não devolveu literal — não salvo.`);
      continue;
    }
    const conteudo = decodificarParte(bruto, a.encoding);
    let destino = path.join(dir, nome);
    if (fs.existsSync(destino)) destino = path.join(dir, `${i}-${nome}`);
    fs.writeFileSync(destino, conteudo);
    console.log(`✓ ${destino} (${fmtBytes(conteudo.length)}, ${a.tipo}/${a.subtipo}, parte ${a.numero})`);
    salvos.push(destino);
  }
  return salvos;
}

module.exports = { baixarAnexos, MAX_ANEXO_BYTES };
