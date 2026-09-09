/**
 * _cauda.cjs — A RÉGUA da palavra decapitada (#234) num lugar só, e o desarme
 * da mina do `release_ms` NULL.
 *
 * ── POR QUE EXISTE ────────────────────────────────────────────────────────
 * A régua vivia como literal duplicado em `cauda_decepada.cjs` e
 * `cauda_alcance.cjs` (5 sítios de comparação em 2 arquivos). Em 09/09 uma
 * TERCEIRA cópia — "cópia literal", palavras da nota 30 do #234 — foi feita
 * para medir o áudio de REFERÊNCIA, onde a régua é estruturalmente
 * inaplicável (a referência é gravação humana, tem piso de ruído a -65,9dB, e
 * o detector exige silêncio digital a -90dB: ele devolveu n=0 fronteiras em 28
 * das 29 vozes e o "0 decepadas" foi lido como refutação quando era cegueira).
 * Regra que se copia é regra que diverge. Aqui ela é uma só.
 *
 * ── A MINA QUE ISTO DESARMA ───────────────────────────────────────────────
 * No JSONL, `release_ms: null` significa "a voz NÃO passou de -40dB em nenhuma
 * janela dos 400ms anteriores ao corte" — ou seja, decaimento LONGO: o
 * OPOSTO de decapitada. Só que em JavaScript
 *
 *     null <= 35   →   true        (null vira 0 na comparação relacional)
 *
 * então qualquer comparação que esqueça o `!== null` conta essas fronteiras
 * como o corte MAIS ABRUPTO POSSÍVEL. São 834 de 15.285 fronteiras (5,5%) na
 * base de 09/09. A nota 29 do #234 registrou a mina em 08/09 ("as 335
 * fronteiras com release_ms NULL são mina") e o conserto ficou por fazer.
 *
 * POR QUE NINGUÉM VIU O ESTRAGO: com o `--plato -40` de fábrica a mina é
 * INERTE, e não por sorte — é impossível por construção. Se o platô medido a
 * 60ms passasse de -40dB, a varredura regressiva teria achado `release <= 60`
 * e o null não existiria. Logo `null` ⟹ `plato <= -40`, e o segundo termo da
 * régua barra sozinho o que o primeiro deixaria passar. Medido: das 834
 * fronteiras null, ZERO têm plato > -40.
 *
 * O guarda só vira load-bearing quando alguém afrouxa o `--plato` — que é
 * exatamente a alavanca que a tabela de sensibilidade NÃO varre (ela varre só
 * o `--rel`). Medido em 09/09 na base inteira, gerações/alunos internos:
 *
 *     --plato    com guarda     sem guarda     fronteiras null que entram
 *      -40      633 / 250      633 / 250                 0
 *      -45      668 / 260      688 / 270                29
 *      -50      682 / 265      753 / 285               142
 *      -90      691 / 270      854 / 310               485
 *
 * Um `--plato -50` numa varredura de sensibilidade publicaria +71 gerações e
 * +20 alunos que NÃO EXISTEM — e publicaria com cara de medição.
 *
 * ── POR QUE O CONSERTO NÃO É "LEMBRAR DO GUARDA" ──────────────────────────
 * Porque lembrar não escala: já são 5 sítios, e a 3ª cópia do arquivo perdido
 * mostrou que o próximo esquecimento é questão de tempo. O conserto é
 * NORMALIZAR NA LEITURA: `null` vira `Infinity`, e aí a comparação errada
 * deixa de ser possível — `Infinity <= 35` é false em QUALQUER limiar,
 * inclusive num `--rel 9999`.
 *
 * `Infinity` é a codificação honesta de um desconhecido com piso: sabemos que
 * o release passa de 400ms, não sabemos quanto. Gravar 405 mentiria em
 * `--rel 500`; gravar Infinity nunca marca, que é o comportamento conservador
 * correto para "não medido dentro da janela".
 *
 * ⚠️ O FORMATO EM DISCO NÃO MUDA. A normalização é só na LEITURA — o JSONL
 * continua gravando `null`, a prova commitada (`_frank/prova/cauda_decepada.jsonl`,
 * 4.345 entregas / 20min de varredura / 2GB de R2) segue válida, e ferramenta
 * velha e nova continuam lendo o mesmo arquivo. Nada precisa ser remedido.
 *
 * Autoteste:  node _frank/ferramentas/_cauda.cjs --autoteste
 */

/** Janela em que `medir()` procura a última janela acima de PLATO_DB. */
const RELEASE_JANELA_MS = 400;
/** Sentinela de "passou da janela" — nunca é <= limiar nenhum. */
const RELEASE_FORA_DA_JANELA = Infinity;

const REL_MAX_MS = 35;   // release <= isto = suspeito  (quebrado 10, limpo >=55)
const PLATO_DB = -40;    // e ainda estava falando 60ms antes

/**
 * `null`/`undefined` → Infinity. É AQUI que a mina morre: depois disto,
 * nenhuma comparação relacional pode ler "não medido" como "cortou seco".
 */
function normalizarRelease(v) {
  return v === null || v === undefined ? RELEASE_FORA_DA_JANELA : v;
}

/** Fronteira com o `release_ms` já seguro para comparar e ordenar. */
function normalizarFronteira(f) {
  return { ...f, release_ms: normalizarRelease(f.release_ms) };
}

/** Registro do JSONL com todas as fronteiras normalizadas. */
function normalizarRegistro(r) {
  return r && r.fronteiras
    ? { ...r, fronteiras: r.fronteiras.map(normalizarFronteira) }
    : r;
}

/**
 * Lê o JSONL da varredura JÁ NORMALIZADO. Toda leitura da prova passa por
 * aqui — é o único ponto onde o `null` do disco entra no processo.
 */
function lerJsonl(caminho) {
  const fs = require("node:fs");
  if (!fs.existsSync(caminho)) return null;
  return fs.readFileSync(caminho, "utf8").split("\n").filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean).map(normalizarRegistro);
}

/** ">400" em vez de "null"/"Infinity" na tela — o humano lê a grandeza certa. */
function mostrarRelease(v) {
  return Number.isFinite(normalizarRelease(v)) ? String(v) : `>${RELEASE_JANELA_MS}`;
}

/**
 * A régua. As duas condições juntas porque cada uma sozinha é fina: o nível
 * onde o decaimento para não separa (limpo a -51,6dB contra quebrado a
 * -46,4dB), quem separa é a FORMA do decaimento.
 * Âncora humana: 81d4f3f4 em t=34,494 (release 10ms, plato -27,9dB).
 */
function suspeita(f, rel = REL_MAX_MS, plato = PLATO_DB) {
  return normalizarRelease(f.release_ms) <= rel && f.plato_db > plato;
}

/** fim do arquivo = fronteira sem silêncio depois, ou colada na duração. */
function ehFim(f, dur) {
  return f.sil_s === 0 || (dur && Math.abs(f.t - dur) < 0.6);
}

// ── Autoteste ──────────────────────────────────────────────────────────────
// Sem framework de propósito: a ferramenta roda em qualquer worktree, e
// worktree sem `npm ci` foi o que já fez uma ronda concluir "não dá pra
// verificar" (armadilha do NODE_ENV=production, ronda de 08/09).
if (require.main === module && process.argv.includes("--autoteste")) {
  const casos = [
    // [descrição, fronteira, esperado com a régua de fábrica]
    ["null NÃO é corte seco (a mina)", { release_ms: null, plato_db: -60, sil_s: 1 }, false],
    ["null continua falso com plato afrouxado", { release_ms: null, plato_db: -60, sil_s: 1 }, false],
    ["âncora humana 81d4f3f4 @34,494", { release_ms: 10, plato_db: -27.9, sil_s: 0.3 }, true],
    ["release 0 com voz alta = decapitada", { release_ms: 0, plato_db: -30, sil_s: 0.3 }, true],
    ["release longo = limpa", { release_ms: 305, plato_db: -50, sil_s: 0.3 }, false],
    ["release curto mas voz já baixa = limpa", { release_ms: 10, plato_db: -55, sil_s: 0.3 }, false],
  ];
  let ok = true;
  for (const [nome, f, esperado] of casos) {
    const got = suspeita(f);
    const bate = got === esperado;
    ok = ok && bate;
    console.log(`${bate ? "OK   " : "FALHA"} ${nome} → ${got} (esperado ${esperado})`);
  }
  // o teste que importa: a mina não pode voltar em NENHUM limiar
  for (const plato of [-40, -45, -50, -60, -90]) {
    for (const rel of [15, 35, 55, 400, 9999]) {
      const got = suspeita({ release_ms: null, plato_db: -50, sil_s: 1 }, rel, plato);
      if (got) { ok = false; console.log(`FALHA null marcado com --rel ${rel} --plato ${plato}`); }
    }
  }
  console.log(`\nsanidade da linguagem: null <= 35 é ${null <= 35}; ` +
    `Infinity <= 9999 é ${Infinity <= 9999} — é essa diferença que a normalização compra.`);
  console.log(ok ? "\nRégua aprovada." : "\nRÉGUA REPROVADA.");
  if (!ok) process.exitCode = 1;
}

module.exports = {
  RELEASE_JANELA_MS, RELEASE_FORA_DA_JANELA, REL_MAX_MS, PLATO_DB,
  normalizarRelease, normalizarFronteira, normalizarRegistro,
  lerJsonl, mostrarRelease, suspeita, ehFim,
};
