#!/usr/bin/env node
/**
 * DETECTOR DE ESTORNO DECLARADO — "a casa DISSE por escrito que estornou;
 * o ledger confirma?" Incidente #517 (dd1764e9). SÓ LEITURA: não credita,
 * não estorna, não escreve nada, em lugar nenhum.
 *
 * ── POR QUE EXISTE ──
 * A classe é real e já mordeu duas vezes: a Katia (#473, carta de 17/09 uid
 * 2606: "os 400 créditos ... já voltaram automaticamente" — e o ref_id
 * 019c58d1 não tinha estorno nenhum; o estorno que existia era de OUTRA
 * geração) e o Turbo (#224, carta de 02/09 uid 443: "já foi estornado" — e o
 * ledger inteiro dele não tinha UMA linha positiva). Nos dois, a casa afirmou
 * no passado uma devolução que não aconteceu, e o aluno ficou no negativo
 * acreditando que não estava.
 *
 * MAS o levantamento cru que abriu o #517 ("cartão menciona estorno" x "aluno
 * sem estorno") deu 100% de ruído nos 3 cartões abertos conferidos em 21/09:
 *   · #311 Hugo — ledger de crédito VAZIO; o caso dele é dinheiro na Hotmart.
 *     Cartão que fala "estorno" não é promessa de crédito.
 *   · #371 Alice — o estorno EXISTE e casa: image_refund_gate371 +525 contra
 *     image_generation -525 no MESMO ref_id 4100fc07. Soma zero.
 *   · #446 Paula — cartão TÉCNICO (refund.ts quebrando o webhook). Ninguém
 *     prometeu estorno a ela.
 * Por isso a FONTE aqui não é nota de cartão: é a pasta ENVIADOS do IMAP —
 * o que o aluno REALMENTE leu. E a frase tem que ser afirmação NO PASSADO.
 *
 * ── O QUE ELE MEDE ──
 * 1. Varre as cartas enviadas (via `ler_caixa.cjs --enviados`, o leitor real
 *    de produção — não uma terceira cópia de IMAP; foi cópia divergente que
 *    produziu o #351) procurando afirmação de estorno JÁ FEITO.
 * 2. Identifica o aluno pelo destinatário (header To).
 * 3. Lista os DÉBITOS do aluno na janela ANTES da carta (default 30 dias,
 *    --dias ajusta) e, pra cada débito, se existe linha positiva casada pelo
 *    MESMO ref_id com ref_type na lista inteira de REF_TYPES_ESTORNO
 *    (_estornos.cjs). Ledger paginado — o Supabase corta em 1000 em silêncio.
 *
 * ── O QUE ELE NÃO AFIRMA (o coração do card) ──
 * Ele NÃO conclui "a casa deve X". Ele ESTREITA, não decide. Débito sem
 * estorno casado é NORMAL na esmagadora maioria (o aluno usou e foi entregue).
 * O sinal é a COMBINAÇÃO carta-que-afirma + débito-sem-estorno na janela — e
 * ainda assim é SUSPEITA, pra um humano olhar. Promessa futura ("vou
 * estornar") NÃO é dívida cumprida e sai em lista SEPARADA. O que não dá pra
 * determinar (destinatário sem perfil, débito sem ref_id, corpo indisponível)
 * sai como NAO DETERMINADO — nunca chute, nunca omissão.
 *
 * ── ARMADILHAS RESPEITADAS ──
 *   - estorno se confere por ref_type CASADO COM ref_id, NUNCA por kind (o
 *     estorno grava kind='extra_purchase'; conferir por kind já quase pagou
 *     13 alunos em dobro);
 *   - a lista é a INTEIRA de REF_TYPES_ESTORNO (só generation_refund enxerga
 *     9,4% do universo);
 *   - casamento por ref_id, nunca "o aluno tem algum estorno" — foi casando
 *     por aluno que a Katia e o Turbo passaram despercebidos (o estorno de
 *     OUTRA geração dava o veredito de quitado);
 *   - toda consulta paginada por .range() com ordem estável;
 *   - `enviados_local.jsonl` (envios sem cópia em Enviados, #210) é checado e
 *     declarado — zero na pasta não é prova de silêncio.
 *
 * Uso:
 *   node _frank/ferramentas/detector_estorno_declarado.cjs
 *     [--cartas N]   quantas cartas recentes de Enviados varrer (default 200)
 *     [--dias N]     janela de débitos antes da carta (default 30)
 *     [--para email] restringe a um destinatário
 *
 * Testes (sem banco, sem rede — gabarito são os casos REAIS medidos):
 *   node --test _frank/ferramentas/detector_estorno_declarado.test.cjs
 *
 * Saída com DENOMINADOR (regra do zero mentiroso): cartas varridas, com
 * afirmação, promessas, não determinados, candidatos.
 * Exit: 0 = nenhum candidato · 2 = tem candidato pra humano olhar · 1 = falha.
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { ehEstorno } = require("./_estornos.cjs");

/* ================================================================== */
/* PARTE PURA — testável sem banco e sem IMAP                          */
/* ================================================================== */

/**
 * Normaliza SEM MUDAR O COMPRIMENTO (1 char acentuado → 1 char), pra que o
 * índice do match aponte pro mesmo lugar no texto original ao extrair trecho.
 */
const MAPA_ACENTOS = {
  á: "a", à: "a", â: "a", ã: "a", ä: "a",
  é: "e", ê: "e", è: "e", ë: "e",
  í: "i", ì: "i", î: "i", ï: "i",
  ó: "o", ô: "o", õ: "o", ò: "o", ö: "o",
  ú: "u", ù: "u", û: "u", ü: "u",
  ç: "c", ñ: "n",
};
function normalizar(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[áàâãäéêèëíìîïóôõòöúùûüçñ]/g, (c) => MAPA_ACENTOS[c] || c);
}

/**
 * Afirmação de estorno JÁ FEITO (passado). Cada padrão veio de carta REAL:
 * "já voltaram automaticamente pra sua conta" (Katia, uid 2606),
 * "e que já foi estornado" (Turbo, uid 443), "JA foram estornados" (nota #224).
 */
const PADROES_AFIRMACAO = [
  /\bja\s+voltaram\b/,
  /\bja\s+(?:foi|foram)\s+estornad\w*/,
  /\bja\s+estorn(?:ei|amos|ou)\b/,
  /\bja\s+devolv(?:i|emos|eu)\b/,
  /\bcreditos?\s+(?:ja\s+)?(?:foram?\s+)?devolvid\w*/,
  /\bdevolv(?:i|emos)\s+(?:os\s+|seus\s+)?creditos?\b/,
  /\bestorno\s+ja\b/,
];

/** Promessa FUTURA — não é dívida cumprida; sai em lista separada. */
const PADROES_PROMESSA = [
  /\bvou\s+estornar\b/,
  /\bvamos\s+estornar\b/,
  /\bir(?:ei|emos)\s+estornar\b/,
  /\bser(?:a|ao)\s+estornad\w*/,
  /\bvou\s+devolver\b/,
  /\bvamos\s+devolver\b/,
  /\bestorno\s+sera\b/,
  /\bprovidenciar(?:ei|emos)?\s+o\s+estorno\b/,
];

/** Trecho do ORIGINAL em volta do match (a normalização preserva índice). */
function trecho(original, idx, len, margem = 70) {
  const de = Math.max(0, idx - margem);
  const ate = Math.min(original.length, idx + len + margem);
  return (
    (de > 0 ? "…" : "") +
    original.slice(de, ate).replace(/\s+/g, " ").trim() +
    (ate < original.length ? "…" : "")
  );
}

/**
 * Classifica o texto de UMA carta.
 * @returns {{afirmacoes: string[], promessas: string[]}} trechos encontrados
 */
function acharFrases(texto) {
  const original = String(texto ?? "");
  const norm = normalizar(original);
  const busca = (padroes) => {
    const out = [];
    for (const re of padroes) {
      const m = norm.match(re);
      if (m && m.index !== undefined) out.push(trecho(original, m.index, m[0].length));
    }
    return out;
  };
  return { afirmacoes: busca(PADROES_AFIRMACAO), promessas: busca(PADROES_PROMESSA) };
}

/**
 * Casa cada DÉBITO da janela com linha positiva de estorno pelo MESMO ref_id.
 * `txs` é o ledger INTEIRO do aluno (as positivas podem ser de fora da
 * janela: estorno depois da carta também quita).
 *
 * Regras que este casamento carrega:
 *  - estorno é `amount > 0` com ref_type em REF_TYPES_ESTORNO — kind NÃO
 *    entra na conta (o estorno grava kind='extra_purchase');
 *  - o casamento é por ref_id. "O aluno tem algum estorno" NÃO quita nada —
 *    foi assim que a Katia e o Turbo passaram despercebidos.
 *
 * @returns {Array<{tx, status: 'quitado'|'sem_estorno'|'indeterminado', estornos: Array}>}
 */
function casarDebitos(txs, dataCarta, dias = 30) {
  const ate = new Date(dataCarta).getTime();
  const de = ate - dias * 86400e3;
  if (!Number.isFinite(ate)) return [];

  const positivasPorRef = new Map();
  for (const t of txs ?? []) {
    if ((t.amount ?? 0) > 0 && t.ref_id && ehEstorno(t.ref_type)) {
      if (!positivasPorRef.has(t.ref_id)) positivasPorRef.set(t.ref_id, []);
      positivasPorRef.get(t.ref_id).push(t);
    }
  }

  const out = [];
  for (const t of txs ?? []) {
    if ((t.amount ?? 0) >= 0) continue;
    const ts = new Date(t.created_at).getTime();
    if (!Number.isFinite(ts) || ts < de || ts > ate) continue;
    const estornos = t.ref_id ? positivasPorRef.get(t.ref_id) ?? [] : [];
    out.push({
      tx: t,
      status: !t.ref_id ? "indeterminado" : estornos.length ? "quitado" : "sem_estorno",
      estornos,
    });
  }
  return out;
}

/**
 * Veredito de UMA carta. NÃO decide dívida — estreita:
 *  - SEM_AFIRMACAO         carta não afirma estorno no passado
 *  - NAO_DETERMINADO       destinatário sem perfil, ou só débitos sem ref_id
 *  - SEM_DEBITO_NA_JANELA  afirma, mas não há débito pra casar (caso Hugo:
 *                          ledger vazio → o assunto pode ser dinheiro Hotmart,
 *                          fora do alcance deste detector) — NÃO ACUSA
 *  - ESTORNO_CASADO        afirma e TODOS os débitos têm estorno casado
 *                          (caso Alice) — NÃO ACUSA
 *  - CANDIDATO             afirma E há débito sem estorno casado — evidência
 *                          pra um HUMANO olhar; ainda assim é SUSPEITA
 */
function avaliarCarta({ temAfirmacao, alunoIdentificado, txs, dataCarta, dias = 30 }) {
  if (!temAfirmacao) return { veredito: "SEM_AFIRMACAO", acusa: false, debitos: [] };
  if (!alunoIdentificado) return { veredito: "NAO_DETERMINADO", acusa: false, debitos: [] };
  const debitos = casarDebitos(txs ?? [], dataCarta, dias);
  if (!debitos.length) return { veredito: "SEM_DEBITO_NA_JANELA", acusa: false, debitos };
  if (debitos.some((d) => d.status === "sem_estorno"))
    return { veredito: "CANDIDATO", acusa: true, debitos };
  if (debitos.every((d) => d.status === "quitado"))
    return { veredito: "ESTORNO_CASADO", acusa: false, debitos };
  // sobrou mistura de quitado + indeterminado (débito sem ref_id): não dá
  // pra afirmar nem quitação nem falta — nunca chute, nunca omita.
  return { veredito: "NAO_DETERMINADO", acusa: false, debitos };
}

/**
 * Parseia a saída de `ler_caixa.cjs --enviados` (blocos separados por linha
 * de ─). Devolve { uid, dataStr, data, para, email, assunto, corpo }.
 */
function parsearEnviados(saida) {
  const blocos = String(saida ?? "").split(/^─{20,}\s*$/m).slice(1);
  const cartas = [];
  for (const b of blocos) {
    const uid = b.match(/^\s*uid (\d+)/m)?.[1];
    if (!uid) continue;
    const dataStr = b.match(/^\s*uid \d+ · (.*?) · /m)?.[1]?.trim() ?? "";
    const para = b.match(/^para:\s*(.*)$/m)?.[1]?.trim() ?? "";
    const assunto = b.match(/^assunto:\s*(.*)$/m)?.[1]?.trim() ?? "";
    const email =
      para.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0]?.toLowerCase() ?? null;
    // corpo: tudo depois da primeira linha em branco que segue os cabeçalhos
    const idxAssunto = b.search(/^assunto:/m);
    let corpo = "";
    if (idxAssunto >= 0) {
      const resto = b.slice(idxAssunto);
      const idxBranco = resto.search(/\r?\n\r?\n/);
      if (idxBranco >= 0) corpo = resto.slice(idxBranco).trim();
    }
    const data = new Date(dataStr);
    cartas.push({
      uid: Number(uid),
      dataStr,
      data: Number.isFinite(data.getTime()) ? data : null,
      para,
      email,
      assunto,
      corpo,
    });
  }
  return cartas;
}

/* ================================================================== */
/* PARTE COM MUNDO — IMAP (via ler_caixa) + banco (só SELECT)          */
/* ================================================================== */

function argvPega(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

/** Paginação com ordem estável — o PostgREST corta em 1000 em silêncio. */
async function paginado(fabricaQuery) {
  let tudo = [];
  let de = 0;
  for (;;) {
    const { data, error } = await fabricaQuery()
      .order("id", { ascending: true })
      .range(de, de + 999);
    if (error) throw new Error(JSON.stringify(error));
    tudo = tudo.concat(data ?? []);
    if (!data || data.length < 1000) break;
    de += 1000;
  }
  return tudo;
}

async function main() {
  const nCartas = Number(argvPega("--cartas", "200"));
  const dias = Number(argvPega("--dias", "30"));
  const soPara = argvPega("--para", null);

  // 1. as cartas que o aluno REALMENTE leu — via leitor de produção
  const lerCaixa = path.join(__dirname, "ler_caixa.cjs");
  const args = [lerCaixa, "--enviados", "--ultimos", String(nCartas), "--corpo", "8000"];
  if (soPara) args.push("--para", soPara);
  let saida;
  try {
    saida = execFileSync(process.execPath, args, {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      timeout: 10 * 60_000,
    });
  } catch (e) {
    console.error("ler_caixa --enviados falhou:", e.message);
    console.error(String(e.stdout ?? "").slice(-500));
    process.exit(1);
  }
  const cartas = parsearEnviados(saida);
  console.log(`cartas varridas em Enviados: ${cartas.length} (pedidas: ${nCartas}${soPara ? `, só para ${soPara}` : ""}) · janela de débito: ${dias}d antes de cada carta\n`);

  // Envios sem cópia em Enviados (#210): corpo indisponível aqui → declarado.
  const RAIZ = path.resolve(__dirname, "..", "..");
  const locais = path.join(RAIZ, "_frank", "prova", "enviados_local.jsonl");
  if (fs.existsSync(locais)) {
    const linhas = fs.readFileSync(locais, "utf8").split("\n").filter(Boolean);
    const doAlvo = soPara
      ? linhas.filter((l) => l.toLowerCase().includes(soPara.toLowerCase()))
      : linhas;
    if (doAlvo.length) {
      console.log(`⚠️  ${doAlvo.length} envio(s) SÓ no registro local (enviados_local.jsonl, #210):`);
      console.log(`   corpo indisponível → NAO DETERMINADO por construção. Confira à mão se importar.`);
    } else {
      console.log("registro local de envios (#210): nada relevante — checado.\n");
    }
  } else {
    console.log("registro local de envios (#210): arquivo não existe — checado, sem sends escondidos ali.\n");
  }

  // 2. classificar frases ANTES de tocar o banco (barato primeiro)
  const interessantes = [];
  for (const c of cartas) {
    const frases = acharFrases(`${c.assunto}\n${c.corpo}`);
    if (frases.afirmacoes.length || frases.promessas.length) interessantes.push({ ...c, frases });
  }

  const { supa } = require("./_comum.cjs"); // lazy: os testes não podem exigir .env
  const db = supa();

  const resumo = { candidatos: [], promessas: [], naoDeterminados: [], limpos: [] };

  for (const c of interessantes) {
    const temAfirmacao = c.frases.afirmacoes.length > 0;
    const rotulo = `uid ${c.uid} · ${c.data ? c.data.toISOString().slice(0, 16) : c.dataStr} · para ${c.email ?? c.para}`;

    if (!temAfirmacao) {
      // só promessa futura — lista separada, sem consulta de dívida
      resumo.promessas.push({ carta: c, motivo: c.frases.promessas });
      continue;
    }
    if (!c.email || !c.data) {
      resumo.naoDeterminados.push({ carta: c, motivo: !c.email ? "destinatário sem e-mail identificável" : "carta sem data parseável" });
      console.log(`\n❓ NAO DETERMINADO — ${rotulo}\n   afirmação: "${c.frases.afirmacoes[0]}"`);
      continue;
    }

    // perfil do aluno pelo destinatário
    const { data: profs, error: ep } = await db
      .from("profiles")
      .select("id,email")
      .ilike("email", c.email);
    if (ep) throw new Error("profiles: " + JSON.stringify(ep));
    const prof = (profs ?? [])[0] ?? null;

    let txs = [];
    if (prof) {
      txs = await paginado(() =>
        db
          .from("credit_transactions")
          .select("id,user_id,kind,amount,ref_type,ref_id,note,created_at")
          .eq("user_id", prof.id),
      );
    }

    const v = avaliarCarta({
      temAfirmacao,
      alunoIdentificado: !!prof,
      txs,
      dataCarta: c.data,
      dias,
    });

    const linhaDebito = (d) => {
      const t = d.tx;
      const casado =
        d.status === "quitado"
          ? `SIM (${d.estornos.map((e) => `+${e.amount} ${e.ref_type}`).join(", ")})`
          : d.status === "sem_estorno"
            ? "NAO"
            : "NAO DETERMINADO (débito sem ref_id)";
      return `    ${String(t.created_at).slice(0, 16)} ${t.ref_type ?? "?"} ${t.amount} ref=${t.ref_id ? String(t.ref_id).slice(0, 8) : "—"} → estorno casado: ${casado}`;
    };

    if (v.veredito === "CANDIDATO") {
      resumo.candidatos.push({ carta: c, v });
      console.log(`\n🔴 CANDIDATO (evidência pra humano olhar — NÃO é veredito de dívida) — ${rotulo}`);
      console.log(`   afirmação: "${c.frases.afirmacoes[0]}"`);
      console.log(`   débitos na janela de ${dias}d antes da carta:`);
      for (const d of v.debitos) console.log(linhaDebito(d));
    } else if (v.veredito === "NAO_DETERMINADO") {
      resumo.naoDeterminados.push({ carta: c, motivo: prof ? "só débitos sem ref_id na janela" : "destinatário sem perfil no app (comprador SGP entra por outra porta?)" });
      console.log(`\n❓ NAO DETERMINADO — ${rotulo}`);
      console.log(`   afirmação: "${c.frases.afirmacoes[0]}"`);
      console.log(`   motivo: ${prof ? "só débitos sem ref_id na janela" : "sem perfil pra este e-mail"}`);
      if (v.debitos.length) for (const d of v.debitos) console.log(linhaDebito(d));
    } else {
      resumo.limpos.push({ carta: c, v });
      const nota =
        v.veredito === "SEM_DEBITO_NA_JANELA"
          ? "afirma estorno mas não há débito na janela (ledger vazio/limpo — pode ser dinheiro Hotmart, fora do alcance daqui)"
          : "todos os débitos da janela têm estorno casado por ref_id";
      console.log(`\n· limpo (${v.veredito}) — ${rotulo}`);
      console.log(`   afirmação: "${c.frases.afirmacoes[0]}" → ${nota}`);
      if (v.debitos.length) for (const d of v.debitos) console.log(linhaDebito(d));
    }
  }

  if (resumo.promessas.length) {
    console.log(`\n── PROMESSAS FUTURAS (lista separada — promessa não é dívida cumprida) ──`);
    for (const p of resumo.promessas)
      console.log(`  uid ${p.carta.uid} · para ${p.carta.email ?? p.carta.para} · "${p.motivo[0]}"`);
  }

  console.log(
    `\n>>> RESUMO: ${cartas.length} cartas varridas | ${interessantes.length} mencionam estorno | ` +
      `${resumo.candidatos.length} CANDIDATO(S) | ${resumo.limpos.length} limpas | ` +
      `${resumo.naoDeterminados.length} não determinadas | ${resumo.promessas.length} promessas futuras`,
  );
  console.log(
    ">>> alcance: pasta Enviados + ledger de crédito. NÃO cobre WhatsApp/chat, dinheiro na Hotmart, " +
      "nem carta fora das últimas " + nCartas + ". CANDIDATO = suspeita pra humano, nunca ordem de estorno.",
  );
  process.exit(resumo.candidatos.length ? 2 : 0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error("FALHOU:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

module.exports = {
  normalizar,
  acharFrases,
  casarDebitos,
  avaliarCarta,
  parsearEnviados,
  PADROES_AFIRMACAO,
  PADROES_PROMESSA,
};
