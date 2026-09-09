#!/usr/bin/env node
/**
 * cauda_polos.cjs — reconstrói os DOIS POLOS de voz do #234 a partir do JSONL
 * commitado, e prova a reconstrução contra os números já publicados.
 *
 * ── POR QUE EXISTE ────────────────────────────────────────────────────────
 * A nota 27 (08/09) descobriu o fato que estreitou o card: a taxa de palavra
 * decapitada é PROPRIEDADE DA VOZ, não da geração — 17 vozes com zero decepadas
 * (a maior com dezenas de fronteiras) contra 12 vozes entre 29,9% e 54,1%. Toda
 * ronda desde então testa hipóteses comparando esses dois polos.
 *
 * Só que as notas 27, 29, 30 e 31 citam "as 12 do polo ALTO e as 17 do polo
 * ZERO" sem NUNCA gravar QUAIS são. Quem retomasse teria que redescobrir o
 * recorte de cabeça — e um recorte reconstruído errado move todos os números
 * seguintes sem avisar. É a mesma perda da regra 25-B, só que do outro lado:
 * ali evaporou a ferramenta, aqui evaporaria a AMOSTRA.
 *
 * ── A RECONSTRUÇÃO É VERIFICADA, NÃO ACREDITADA ───────────────────────────
 * `--conferir` reproduz os números que a nota 27 publicou e falha se divergir:
 * 99 vozes elegíveis, 6.797 fronteiras internas, taxa global 13,1%, polo ALTO
 * de 54,1% a 29,9% com o 13º em 29,6% (o que prova que o corte em 12 não é
 * arbitrário: existe um degrau ali), e 17 vozes em zero.
 *
 * ── UMA AMBIGUIDADE QUE MEDI E QUE NÃO IMPORTA ────────────────────────────
 * "Fronteira interna" tem duas definições em uso no card:
 *   (a) `_cauda.ehFim()` — sil_s==0 ou colada na duração (o que o
 *       cauda_alcance.cjs usa para o número-manchete);
 *   (b) "todas menos a última" — a frase literal da nota 27.
 * Elas NÃO dão o mesmo total (98 vozes/6.762 em (a), 99/6.797 em (b) — é (b)
 * que reproduz a nota 27). Mas medido em 09/09: os DOIS polos saem com
 * membership IDÊNTICA nas duas definições. O recorte é robusto à escolha, e é
 * por isso que dá pra seguir usando os polos sem reabrir essa discussão.
 * `--conferir` checa essa equivalência também — se um dia ela quebrar, o
 * recorte parou de ser robusto e a ronda precisa saber ANTES de comparar.
 *
 * ⚠️ Discrepância registrada e NÃO resolvida: a nota 27 diz que a maior voz do
 * polo ZERO tem "85 fronteiras internas". Nas duas definições dá 112 (voz
 * 7fbeb738); 85 é a segunda maior (031f2193). O JSONL não é tocado desde
 * 04/09 (`git log` do arquivo), então não é deriva de base. Não muda polo
 * nenhum nem o argumento da nota 27 (0 em 112 é ainda mais improvável que 0 em
 * 85), mas fica anotado porque número publicado que não reproduz é dívida.
 *
 * Uso:
 *   node _frank/ferramentas/cauda_polos.cjs --conferir   # prova a reconstrução
 *   node _frank/ferramentas/cauda_polos.cjs --alto       # ids do polo ALTO
 *   node _frank/ferramentas/cauda_polos.cjs --zero       # ids do polo ZERO
 *   node _frank/ferramentas/cauda_polos.cjs --tabela     # os 29, com taxa
 */
const path = require("node:path");
const cd = require(path.join(__dirname, "_cauda.cjs"));

const JSONL = path.join(__dirname, "..", "prova", "cauda_decepada.jsonl");
const MIN_FRONTEIRAS = 30;   // recorte da nota 27: voz com pouca fronteira não opina
const N_ALTO = 12;           // o degrau: 12º=29,9% e 13º=29,6%

/** (b) "todas menos a última" — a definição literal da nota 27. */
const internasNota27 = (r) => r.fronteiras.slice(0, -1);
/** (a) a de `ehFim`, usada pelo cauda_alcance.cjs. */
const internasEhFim = (r) => r.fronteiras.filter((f) => !cd.ehFim(f, r.dur));

function ranquear(regs, internasDe) {
  const m = new Map();
  for (const r of regs) {
    const I = internasDe(r);
    if (!m.has(r.voice_id)) m.set(r.voice_id, { n: 0, ruins: 0, ger: 0 });
    const v = m.get(r.voice_id);
    v.n += I.length;
    v.ruins += I.filter((f) => cd.suspeita(f)).length;
    v.ger += 1;
  }
  const eleg = [...m.entries()]
    .filter(([, v]) => v.n >= MIN_FRONTEIRAS)
    .map(([id, v]) => ({ id, ...v, taxa: (100 * v.ruins) / v.n }))
    // desempate por id para que a ordem seja determinística entre execuções
    .sort((a, b) => b.taxa - a.taxa || a.id.localeCompare(b.id));
  return {
    eleg,
    alto: eleg.slice(0, N_ALTO),
    zero: eleg.filter((v) => v.ruins === 0),
    fronteiras: eleg.reduce((a, v) => a + v.n, 0),
    ruins: eleg.reduce((a, v) => a + v.ruins, 0),
  };
}

function carregar() {
  const regs = cd.lerJsonl(JSONL);
  if (!regs) throw new Error(`JSONL ausente: ${JSONL}`);
  return regs.filter((r) => r.fronteiras);
}

function polos() {
  return ranquear(carregar(), internasNota27);
}

function conferir() {
  const regs = carregar();
  const A = ranquear(regs, internasNota27);
  const B = ranquear(regs, internasEhFim);
  const ids = (l) => l.map((v) => v.id).sort().join(",");
  const casos = [
    ["vozes elegíveis (>=30 fronteiras)", A.eleg.length, 99],
    ["fronteiras internas", A.fronteiras, 6797],
    ["taxa global %", +((100 * A.ruins) / A.fronteiras).toFixed(1), 13.1],
    ["polo ALTO — 1º %", +A.alto[0].taxa.toFixed(1), 54.1],
    ["polo ALTO — 12º %", +A.alto[11].taxa.toFixed(1), 29.9],
    ["13º (fora do polo) %", +A.eleg[12].taxa.toFixed(1), 29.6],
    ["polo ZERO — quantas vozes", A.zero.length, 17],
  ];
  let ok = true;
  for (const [nome, got, esperado] of casos) {
    const bate = got === esperado;
    ok = ok && bate;
    console.log(`${bate ? "OK   " : "FALHA"} ${nome}: ${got} (nota 27: ${esperado})`);
  }
  // robustez do recorte à definição de "fronteira interna"
  for (const [nome, x, y] of [["ALTO", A.alto, B.alto], ["ZERO", A.zero, B.zero]]) {
    const bate = ids(x) === ids(y);
    ok = ok && bate;
    console.log(`${bate ? "OK   " : "FALHA"} polo ${nome} idêntico nas 2 definições de fronteira interna`);
  }
  console.log(ok
    ? "\nReconstrução dos polos APROVADA — pode comparar em cima deles."
    : "\nReconstrução REPROVADA — NÃO compare polo nenhum até entender a divergência.");
  if (!ok) process.exitCode = 1;
}

function tabela() {
  const { alto, zero } = polos();
  console.log("polo\tvoice_id\ttaxa%\truins/fronteiras\tgerações");
  for (const v of alto) {
    console.log(`ALTO\t${v.id}\t${v.taxa.toFixed(1)}\t${v.ruins}/${v.n}\t${v.ger}`);
  }
  for (const v of zero) {
    console.log(`ZERO\t${v.id}\t0.0\t0/${v.n}\t${v.ger}`);
  }
}

const tem = (n) => process.argv.includes(n);
try {
  if (tem("--conferir")) conferir();
  else if (tem("--alto")) polos().alto.forEach((v) => console.log(v.id));
  else if (tem("--zero")) polos().zero.forEach((v) => console.log(v.id));
  else if (tem("--tabela")) tabela();
  else console.log(require("node:fs").readFileSync(__filename, "utf8").split("*/")[0]);
} catch (e) {
  console.error("ERRO:", e.message);
  process.exit(1);
}
