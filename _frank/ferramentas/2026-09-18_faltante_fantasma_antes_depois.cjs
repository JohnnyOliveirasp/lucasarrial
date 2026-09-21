#!/usr/bin/env node
/**
 * 2026-09-18_faltante_fantasma_antes_depois.cjs — mede quanto do
 * `qa->faltantes_amostra` da tabela `generations` é FANTASMA: palavra que o
 * comparador de cobertura do QA de TTS marca como perdida quando o áudio está
 * perfeito e só a GRAFIA diverge.
 *
 * O QUE ELE FAZ
 * Lê a tabela `generations` inteira (paginada), junta toda ocorrência de
 * palavra em `qa->faltantes_amostra`, e classifica cada uma contra a régua
 * NOVA — usando o `norm_words` DE VERDADE do worker (chama o Python do
 * runpod-worker), nunca uma reimplementação em JS, que poderia divergir do
 * que roda em produção e transformar a medição em ficção.
 *
 * ⚠️ O LIMITE DESTA MEDIÇÃO, e ele é grande — leia antes de citar o número.
 * A tabela guarda o TEXTO do aluno e as palavras que o comparador disse que
 * sumiram. Ela NÃO guarda a transcrição do Whisper. Sem o lado `got` não dá
 * pra RE-EXECUTAR a comparação; dá pra dizer, com precisão diferente em cada
 * caso, o que a régua nova faz com aquela palavra. Por isso a saída tem QUATRO
 * baldes, e eles NÃO valem a mesma coisa — só o [A] é prova:
 *
 *   [A] ESTRUTURAL — a canonicalização reescreve a própria palavra
 *       (`norm_words("pra") == ["para"]`). Depois disso ela deixa de existir
 *       como token do lado do TEXTO, então NÃO PODE mais aparecer em
 *       `faltantes_amostra`, aconteça o que acontecer do lado do áudio. Este
 *       balde não depende de nenhuma suposição.
 *
 *   [B] CONDICIONAL COM GATILHO CONFERIDO — a palavra continua sendo token do
 *       texto, e passa a casar SE o Whisper escreveu o símbolo correspondente
 *       ("5%" por "cinco por cento", "R$ 97" por "noventa e sete reais").
 *       O script confere que o GATILHO existe no texto daquela geração
 *       específica antes de contar. Não é prova: é "a condição necessária está
 *       presente neste job".
 *
 *   [C1] O OUTRO LADO DA FAMÍLIA (a) — a palavra é a forma PLENA de uma
 *       contração ("para", "está", "você"). Ela casa se o Whisper grafou a
 *       forma reduzida ("pra", "tá", "cê"), que é exatamente o defeito medido;
 *       mas a transcrição não está no banco e eu não vou creditar por
 *       suposição. É AQUI que cai o caso Katia (019c58d1, `["esta","esta"]`) —
 *       o único job deste conjunto cujo áudio foi de fato OUVIDO, e nele a
 *       régua nova acerta. Ou seja: o ganho real é MAIOR que [A]+[B], e eu não
 *       sei dizer quanto.
 *
 *   [C] NÃO DECIDÍVEL PELA TELEMETRIA — nome próprio e o resto. A régua nova
 *       tem uma resposta pra família de nome próprio (`divergencias_de_grafia`
 *       em metrics.py), mas decidir exige a palavra que o Whisper escreveu, e
 *       ela não está no banco. Fica contado e NÃO fica creditado.
 *
 * Só leitura. Não gasta GPU, não roda geração, não escreve nada.
 */
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { supa } = require(path.resolve(__dirname, "_comum.cjs"));

const RAIZ = path.resolve(__dirname, "..", "..");
const WORKER = path.join(RAIZ, "runpod-worker");
const PY = process.env.PY_QA || "python3";

/** Roda o `norm_words` DE PRODUÇÃO sobre uma lista de palavras. */
function normalizaNoWorker(palavras) {
  const saida = execFileSync(
    PY,
    ["-c", `
import json, sys, types
if "soundfile" not in sys.modules:
    sys.modules["soundfile"] = types.ModuleType("soundfile")
sys.modules["soundfile"].write = lambda *a, **k: None
from tts_qa import norm_words
print(json.dumps({w: norm_words(w, "pt") for w in json.load(sys.stdin)}))
`],
    { cwd: WORKER, input: JSON.stringify(palavras), encoding: "utf8" },
  );
  return JSON.parse(saida);
}

/**
 * Família (b): palavra que SÓ nasce de expansão de símbolo, e o gatilho que
 * precisa estar no texto da geração pra ela ser creditada.
 */
const GATILHO = {
  por: /%|por\s*cento|porcento/i,
  cento: /%|por\s*cento|porcento/i,
  virgula: /\d[.,]\d|v[ií]rgula/i,
  reais: /r\$|reais/i,
  real: /r\$/i,
  centavos: /r\$\s*\d+[.,]\d|centavos/i,
  centavo: /r\$\s*\d+[.,]\d|centavo/i,
  zero: /\d[.,]\d|zero/i,
};

/**
 * Forma PLENA de uma contração do mapa de canon.py. Casa quando o Whisper
 * grafou a forma reduzida — o defeito medido —, mas a transcrição não está no
 * banco, então isto NÃO é creditado: é contado à parte.
 */
const FORMA_PLENA = new Set([
  "para", "esta", "estar", "estava", "estavam", "estamos", "estou",
  "voce", "voces",
]);

const semAcento = (s) =>
  (s || "").normalize("NFD").replace(/\p{Mn}/gu, "").toLowerCase();

(async () => {
  const db = supa();

  // Consulta ao Supabase corta em 1000 linhas: pagina (armadilha de 20/08).
  const todas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("generations")
      .select("id,created_at,status,text_raw,text_normalized,qa")
      .order("created_at")
      .range(de, de + 999);
    if (error) throw new Error("generations: " + error.message);
    todas.push(...data);
    if (data.length < 1000) break;
  }

  const com = todas.filter(
    (g) => g.qa && Array.isArray(g.qa.faltantes_amostra) && g.qa.faltantes_amostra.length,
  );

  const distintas = [...new Set(com.flatMap((g) => g.qa.faltantes_amostra))];
  const canon = normalizaNoWorker(distintas);

  const balde = { A: [], B: [], C1: [], C: [] };
  const porPalavra = new Map();
  for (const g of com) {
    const texto = semAcento(`${g.text_normalized ?? ""} ${g.text_raw ?? ""}`);
    for (const w of g.qa.faltantes_amostra) {
      const novo = canon[w] ?? [w];
      let onde;
      if (novo.length !== 1 || novo[0] !== w) {
        onde = "A"; // a canonicalização reescreve o token do lado do TEXTO
      } else if (GATILHO[w] && GATILHO[w].test(texto)) {
        onde = "B"; // gatilho de expansão presente NESTE texto
      } else if (FORMA_PLENA.has(w)) {
        onde = "C1"; // o outro lado da família (a) — depende do que o whisper grafou
      } else {
        onde = "C";
      }
      balde[onde].push(w);
      const r = porPalavra.get(w) ?? { A: 0, B: 0, C1: 0, C: 0 };
      r[onde] += 1;
      porPalavra.set(w, r);
    }
  }

  const total = balde.A.length + balde.B.length + balde.C1.length + balde.C.length;
  const pct = (n) => ((100 * n) / total).toFixed(1).padStart(5);

  console.log(`generations lidas ................ ${todas.length}`);
  console.log(`com faltantes_amostra nao-vazia .. ${com.length}`);
  console.log(`ocorrencias de palavra faltante .. ${total}  (${distintas.length} distintas)\n`);

  console.log("ANTES x DEPOIS — o que a regua NOVA faz com cada faltante gravado\n");
  console.log(`  [A] some por construcao (canon reescreve o token) ... ${String(balde.A.length).padStart(4)}  ${pct(balde.A.length)}%`);
  console.log(`  [B] casa SE o whisper grafou o simbolo (gatilho ok) . ${String(balde.B.length).padStart(4)}  ${pct(balde.B.length)}%`);
  console.log(`  [C1] forma plena: casa SE o whisper grafou a reduzida  ${String(balde.C1.length).padStart(4)}  ${pct(balde.C1.length)}%`);
  console.log(`  [C] nao decidivel pela telemetria ................... ${String(balde.C.length).padStart(4)}  ${pct(balde.C.length)}%`);
  console.log(`      ${"-".repeat(52)} ${String(total).padStart(4)}  100.0%\n`);

  const linha = (w, r) =>
    `  ${w.padEnd(16)} A=${String(r.A).padStart(3)}  B=${String(r.B).padStart(3)}  C1=${String(r.C1).padStart(3)}  C=${String(r.C).padStart(3)}`;
  const ordenado = [...porPalavra.entries()].sort(
    (a, b) => (b[1].A + b[1].B + b[1].C1 + b[1].C) - (a[1].A + a[1].B + a[1].C1 + a[1].C),
  );
  console.log("TOP 20 palavras, por balde:");
  for (const [w, r] of ordenado.slice(0, 20)) console.log(linha(w, r));

  const restoC = ordenado.filter(([, r]) => r.C > 0).sort((a, b) => b[1].C - a[1].C);
  console.log("\nTOP 15 do balde [C] (o que este PR NAO resolve, ou nao sabe dizer):");
  for (const [w, r] of restoC.slice(0, 15)) console.log(`  ${w.padEnd(16)} ${r.C}`);
})();
