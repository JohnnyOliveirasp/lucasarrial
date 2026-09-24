/**
 * Rede de segurança do `2026-09-24_conserto_pronto_e_parado.cjs` — a SEGUNDA PASSADA.
 *
 * ── POR QUE ESTE TESTE EXISTE, e não um "rodei e funcionou" ──────────────
 *
 * Em 24/09 17hZ consertei o script pra reconsultar os PRs que voltam
 * `UNKNOWN`. Rodei, funcionou, e quase escrevi isso como prova. Aí rodei o
 * MUTANTE (`ESPERAS = []`, ou seja o script SEM o conserto) e ele **passou
 * também**.
 *
 * O motivo: o `pr view` ENCOMENDA o merge de teste ao GitHub; a execução que
 * falhou minutos antes já tinha encomendado os 59, e quando rodei de novo a
 * resposta veio do cache quente. **A execução ao vivo não distingue o script
 * consertado do script quebrado** — ela mede o estado do cache do GitHub, não
 * o meu código. Chamar aquilo de prova seria o "done falso" da ordem de 19/08.
 *
 * Por isso aqui o `gh` é FALSO e o comportamento é forçado: o 1º `pr view` de
 * cada PR devolve `UNKNOWN` (é o que o GitHub faz de verdade sob rajada) e do
 * 2º em diante devolve o valor real. Não depende de rede, de cache nem da hora
 * do dia.
 *
 * Controle de mutação embutido (caso 2): o MESMO `gh` falso, com o script sem
 * a reconsulta, tem que MORRER. Teste que passa nos dois é teste que não mede.
 */
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ALVO = path.join(__dirname, "2026-09-24_conserto_pronto_e_parado.cjs");

// PRs de mentira: 2 que mergeiam, 1 conflitado. Datas fixas (nada de "hoje").
const FALSOS = [
  { number: 101, title: "conserto pronto A", createdAt: "2026-09-01T00:00:00Z", mergeable: "MERGEABLE", mergeStateStatus: "CLEAN" },
  { number: 102, title: "conserto pronto B", createdAt: "2026-09-20T00:00:00Z", mergeable: "MERGEABLE", mergeStateStatus: "CLEAN" },
  { number: 103, title: "conserto apodrecido C", createdAt: "2026-08-10T00:00:00Z", mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" },
];

/** Cria um `gh` falso que devolve UNKNOWN na 1ª consulta de cada PR. */
function forjarGh(dir) {
  const bin = path.join(dir, "gh");
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const fs = require("fs"), path = require("path");
const FALSOS = ${JSON.stringify(FALSOS)};
const contador = path.join(__dirname, "vistos.json");
const a = process.argv.slice(2);
if (a[0] === "pr" && a[1] === "list") {
  process.stdout.write(JSON.stringify(FALSOS.map((p) => ({ number: p.number }))));
  process.exit(0);
}
if (a[0] === "pr" && a[1] === "view") {
  const n = Number(a[2]);
  const vistos = fs.existsSync(contador) ? JSON.parse(fs.readFileSync(contador, "utf8")) : {};
  vistos[n] = (vistos[n] || 0) + 1;
  fs.writeFileSync(contador, JSON.stringify(vistos));
  const pr = FALSOS.find((p) => p.number === n);
  // 1a consulta: o GitHub ainda esta calculando -> UNKNOWN (o defeito real)
  const saida = vistos[n] === 1
    ? { ...pr, mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" }
    : pr;
  process.stdout.write(JSON.stringify({ ...saida, isDraft: false, headRefName: "b" + n }));
  process.exit(0);
}
process.exit(1);
`,
    { mode: 0o755 },
  );
  return bin;
}

function rodar(script, dirGh) {
  try {
    const saida = execFileSync("node", [script], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${dirGh}:${process.env.PATH}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { morreu: false, saida };
  } catch (e) {
    return { morreu: true, saida: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

test("com a reconsulta: UNKNOWN na 1a passada NAO derruba, e o numero sai medido", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-falso-"));
  forjarGh(dir);
  const r = rodar(ALVO, dir);

  assert.equal(r.morreu, false, `o script morreu, e nao devia:\n${r.saida}`);
  assert.match(r.saida, /mergeabilidade não veio na 1ª passada/, "nao registrou que precisou reconsultar");
  assert.match(r.saida, /CONSERTOS ABERTOS \(PRs\): 3/);
  assert.match(r.saida, /MERGEABLE\+CLEAN \(entram hoje\) : 2/);
  assert.match(r.saida, /CONFLITADOS \(apodreceram\)     : 1/);
  // e nao pode ter sobrado cego
  assert.doesNotMatch(r.saida, /seguiram UNKNOWN/);
});

test("MUTANTE sem a reconsulta: o MESMO gh falso tem que MATAR o script", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-falso-mut-"));
  forjarGh(dir);
  const mutante = path.join(__dirname, "_mutante_sem_reconsulta.tmp.cjs");
  fs.writeFileSync(
    mutante,
    fs.readFileSync(ALVO, "utf8").replace(/^const ESPERAS = \[2, 4, 8, 16\];$/m, "const ESPERAS = [];"),
  );
  try {
    const r = rodar(mutante, dir);
    assert.equal(r.morreu, true, "o mutante passou — entao o teste nao mede o conserto");
    assert.match(r.saida, /seguiram UNKNOWN/, "morreu, mas por outro motivo");
  } finally {
    fs.unlinkSync(mutante);
  }
});

test("trava do zero cego continua viva: UNKNOWN eterno mata mesmo com reconsulta", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-cego-"));
  const bin = path.join(dir, "gh");
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const a = process.argv.slice(2);
if (a[0] === "pr" && a[1] === "list") { process.stdout.write(JSON.stringify([{number:101}])); process.exit(0); }
if (a[0] === "pr" && a[1] === "view") {
  process.stdout.write(JSON.stringify({ number: 101, title: "t", createdAt: "2026-09-01T00:00:00Z",
    mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN", isDraft: false, headRefName: "b" }));
  process.exit(0);
}
process.exit(1);
`,
    { mode: 0o755 },
  );
  const r = rodar(ALVO, dir);
  assert.equal(r.morreu, true, "UNKNOWN permanente TEM que matar — zero de instrumento cego nao e zero medido");
  assert.match(r.saida, /seguiram UNKNOWN após 4 reconsulta/);
});
