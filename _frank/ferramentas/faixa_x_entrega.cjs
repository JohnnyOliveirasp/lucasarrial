#!/usr/bin/env node
/**
 * faixa_x_entrega.cjs — o teste que decide o candidato "faixa dinâmica da
 * referência" do #234, e ele existe porque TODAS as medições anteriores desse
 * candidato eram circulares.
 *
 * ── O QUE ERA CIRCULAR, EM UMA FRASE ──────────────────────────────────────
 * A nota do commit `bb8568b` (09/09 13h19Z) mediu, na REFERÊNCIA: (a) a faixa
 * dinâmica separa os polos (AUC=0,868) e (b) a taxa que o detector RELATIVO
 * marca é função da faixa (Pearson r=-0,604). Só que (b) é uma propriedade do
 * INSTRUMENTO: o detector relativo deriva `piso` e `limiarVoz` do p05/p95 do
 * mesmo arquivo, então faixa estreita ⟹ limiar quase no piso ⟹ release≈0 ⟹
 * "decepada" por construção. Medir taxa-relativa-na-referência contra
 * faixa-da-referência é medir a régua contra ela mesma. Nenhum limiar conserta
 * isso, porque o problema não é o corte: é que os dois lados saem do mesmo p05.
 *
 * ── COMO ESTE TESTE QUEBRA A CIRCULARIDADE ────────────────────────────────
 * Os dois lados passam a vir de ARQUIVOS diferentes, medidos por instrumentos
 * diferentes que não se conhecem:
 *
 *   preditor  = faixa dinâmica (p95-p05) da REFERÊNCIA — ffmpeg + envelope,
 *               SEM detecção de fronteira, sem régua, sem limiar.
 *   desfecho  = taxa de palavra decapitada na ENTREGA — detector ABSOLUTO
 *               (piso -90dB fixo), já calibrado em 4.345 entregas e commitado
 *               em `_frank/prova/cauda_decepada.jsonl`.
 *
 * O p05 da referência não entra em NENHUMA conta do desfecho. Se a correlação
 * aparecer aqui, ela não pode ser a régua se medindo.
 *
 * ── E TAMBÉM NÃO USA POLO ─────────────────────────────────────────────────
 * Polo é recorte pelas pontas (12 mais altas × as 17 em zero), o que descarta
 * 70 das 99 vozes e infla qualquer separação. Aqui entram as **99 elegíveis**
 * inteiras, com a taxa contínua. A checagem de polo vira consequência, não
 * premissa.
 *
 * ⚠️ Voz sem referência ou com download/ffmpeg quebrado é CONTADA E LISTADA,
 * nunca sumida em silêncio: a ferramenta recusa concluir se perder mais de 15%
 * da amostra. "n menor do que o anunciado" foi como este card já produziu
 * número inflado duas vezes.
 *
 * Uso:
 *   node _frank/ferramentas/faixa_x_entrega.cjs --conferir
 *       autoteste: reproduz a nota 27 pelo cauda_polos e confere que o
 *       desfecho NÃO depende do detector relativo. Rode antes de acreditar.
 *   node _frank/ferramentas/faixa_x_entrega.cjs --medir [--limite N]
 *       mede as 99 (baixa cada referência do R2) e grava o cache abaixo.
 *   node _frank/ferramentas/faixa_x_entrega.cjs --analisar
 *       só as contas, em cima do cache — de graça, sem tocar no R2.
 *
 * Cache: _frank/prova/faixa_referencia.jsonl  (rastreado; regra 25-B)
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const c = require(path.join(__dirname, "_comum.cjs"));
const polos = require(path.join(__dirname, "cauda_polos.cjs"));
const rel = require(path.join(__dirname, "cauda_piso_relativo.cjs"));

const CACHE = path.join(__dirname, "..", "prova", "faixa_referencia.jsonl");
const PERDA_MAX = 0.15;   // acima disto a amostra não representa as 99
const CORTE_FAIXA = 45;   // o mesmo corte que a nota do bb8568b usou

const tem = (n) => process.argv.includes(n);
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };

/* ── estatística, sem dependência externa ────────────────────────────────── */
const media = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function pearson(x, y) {
  const mx = media(x), my = media(y);
  let n = 0, dx = 0, dy = 0;
  for (let i = 0; i < x.length; i++) { n += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; }
  return n / Math.sqrt(dx * dy);
}
/** postos com média nos empates — empate tratado errado já virou achado falso. */
function postos(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j < idx.length && idx[j][0] === idx[i][0]) j++;
    const p = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) r[idx[k][1]] = p;
    i = j;
  }
  return r;
}
const spearman = (x, y) => pearson(postos(x), postos(y));
/** p bicaudal por permutação do rótulo — não assume normalidade nem n grande. */
function permP(x, y, obs, N = 200000) {
  let ge = 0;
  for (let i = 0; i < N; i++) {
    const c2 = [...y];
    for (let j = c2.length - 1; j > 0; j--) { const k = (Math.random() * (j + 1)) | 0; [c2[j], c2[k]] = [c2[k], c2[j]]; }
    if (Math.abs(spearman(x, c2)) >= Math.abs(obs)) ge++;
  }
  return ge / N;
}

/* ── autoteste ───────────────────────────────────────────────────────────── */
function conferir() {
  let ok = true;
  const A = polos.polos();
  const casos = [
    ["vozes elegíveis (>=30 fronteiras)", A.eleg.length, 99],
    ["fronteiras internas", A.fronteiras, 6797],
    ["taxa global %", +((100 * A.ruins) / A.fronteiras).toFixed(1), 13.1],
  ];
  for (const [n, got, esp] of casos) {
    const b = got === esp; ok = ok && b;
    console.log(`${b ? "OK   " : "FALHA"} ${n}: ${got} (nota 27: ${esp})`);
  }
  // A independência dos instrumentos é o ponto do teste — então ela é ASSERTADA.
  const fonteDesfecho = fs.readFileSync(path.join(__dirname, "cauda_polos.cjs"), "utf8");
  const limpo = !/piso_relativo|suspeitaRel|plato_rel/.test(fonteDesfecho);
  ok = ok && limpo;
  console.log(`${limpo ? "OK   " : "FALHA"} o desfecho (cauda_polos) não usa nada do detector relativo`);
  const usaAbsoluto = /cd\.suspeita\(/.test(fonteDesfecho);
  ok = ok && usaAbsoluto;
  console.log(`${usaAbsoluto ? "OK   " : "FALHA"} o desfecho usa o detector ABSOLUTO (cd.suspeita)`);
  console.log(ok ? "\nAutoteste APROVADO — o preditor e o desfecho são independentes."
    : "\nAutoteste REPROVADO — não conclua nada deste teste.");
  if (!ok) process.exitCode = 1;
  return ok;
}

/* ── medição ─────────────────────────────────────────────────────────────── */
async function medir() {
  if (!conferir()) return;
  const eleg = polos.polos().eleg;
  const lim = +arg("--limite", String(eleg.length));
  const alvo = eleg.slice(0, lim);
  const feitos = new Map();
  if (fs.existsSync(CACHE)) {
    for (const l of fs.readFileSync(CACHE, "utf8").split("\n").filter(Boolean)) {
      const r = JSON.parse(l); feitos.set(r.voice_id, r);
    }
  }
  console.log(`\n# ${alvo.length} vozes elegíveis · ${feitos.size} já no cache`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "faixaref_"));
  const saida = fs.createWriteStream(CACHE, { flags: "a" });
  let novos = 0;
  try {
    for (const v of alvo) {
      if (feitos.has(v.id)) continue;
      let reg = { voice_id: v.id, faixa: null, p05: null, p95: null, erro: null };
      try {
        const row = await rel.porPrefixo("voices", "id,reference_audio_path", v.id);
        if (!row.reference_audio_path) throw new Error("sem reference_audio_path");
        const f = await rel.baixar(c.BUCKETS.vozes(), row.reference_audio_path, dir, v.id);
        const e = rel.envelope(rel.pcm(f));
        fs.unlinkSync(f);
        reg = { voice_id: v.id, faixa: +(e.p95 - e.p05).toFixed(1), p05: +e.p05.toFixed(1), p95: +e.p95.toFixed(1), erro: null, ref: row.reference_audio_path };
      } catch (e) { reg.erro = e.message; }
      saida.write(JSON.stringify(reg) + "\n");
      novos++;
      if (novos % 10 === 0) console.log(`   ... ${novos} medidas`);
    }
  } finally { saida.end(); fs.rmSync(dir, { recursive: true, force: true }); }
  console.log(`# ${novos} novas medições gravadas em ${path.relative(c.RAIZ, CACHE)}`);
  analisar();
}

/* ── análise ─────────────────────────────────────────────────────────────── */
function analisar() {
  const eleg = polos.polos().eleg;
  const taxa = new Map(eleg.map((v) => [v.id, v]));
  if (!fs.existsSync(CACHE)) { console.log("cache ausente — rode --medir"); return; }
  const linhas = fs.readFileSync(CACHE, "utf8").split("\n").filter(Boolean).map(JSON.parse);
  const bons = linhas.filter((r) => r.erro === null && taxa.has(r.voice_id));
  const ruins = linhas.filter((r) => r.erro !== null);

  console.log(`\n=== AMOSTRA · elegíveis ${eleg.length} · medidas ${bons.length} · perdidas ${ruins.length}`);
  for (const r of ruins) console.log(`   PERDIDA ${r.voice_id.slice(0, 8)} — ${r.erro}`);
  const perda = ruins.length / eleg.length;
  if (perda > PERDA_MAX) {
    console.log(`\nRECUSO CONCLUIR: perdi ${(100 * perda).toFixed(0)}% da amostra (teto ${100 * PERDA_MAX}%).`);
    process.exitCode = 1; return;
  }

  const x = bons.map((r) => r.faixa);
  const y = bons.map((r) => taxa.get(r.voice_id).taxa);
  const rP = pearson(x, y), rS = spearman(x, y);
  console.log(`\n=== CORRELAÇÃO faixa da REFERÊNCIA × taxa de decapitação na ENTREGA (n=${bons.length})`);
  console.log(`   Pearson  r = ${rP.toFixed(3)}`);
  console.log(`   Spearman ρ = ${rS.toFixed(3)}`);
  console.log(`   p (permutação bicaudal, 200k) = ${permP(x, y, rS).toFixed(5)}`);

  const lo = bons.filter((r) => r.faixa < CORTE_FAIXA), hi = bons.filter((r) => r.faixa >= CORTE_FAIXA);
  const tx = (a) => media(a.map((r) => taxa.get(r.voice_id).taxa));
  console.log(`\n=== CORTE em ${CORTE_FAIXA}dB (o mesmo do bb8568b, para comparar lado a lado)`);
  console.log(`   faixa <  ${CORTE_FAIXA}dB: n=${lo.length}  taxa média na entrega = ${lo.length ? tx(lo).toFixed(1) : "-"}%`);
  console.log(`   faixa >= ${CORTE_FAIXA}dB: n=${hi.length}  taxa média na entrega = ${hi.length ? tx(hi).toFixed(1) : "-"}%`);
  console.log(`\n   ⚠️ Na REFERÊNCIA medida pelo detector relativo o bb8568b achou r=-0,604`);
  console.log(`      (faixa estreita ⟹ mais "decepada"). Aquilo é a régua se medindo.`);
  console.log(`      O número que vale para o card é o de cima, contra a ENTREGA.`);
}

if (require.main === module) (async () => {
  if (tem("--conferir")) return void conferir();
  if (tem("--medir")) return medir();
  if (tem("--analisar")) return void analisar();
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0]);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
