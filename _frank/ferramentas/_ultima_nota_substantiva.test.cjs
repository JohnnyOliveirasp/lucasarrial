/**
 * Testes do recuo por nota neutra, compartilhado entre percepcao_travada.cjs
 * e 2026-09-22_esperando_johnny.cjs. Sem banco, sem rede:
 *
 *   node --test "_frank/ferramentas/_ultima_nota_substantiva.test.cjs"
 *
 * ⚠️ Leia `# pass` / `# skipped`, nunca so o codigo de saida (armadilha 3 do
 * `_frank/03_ROTINA.md`): teste que nao RODOU tambem sai com exit 0.
 *
 * Extraido em 25/09 (incidente 02581255) do arquivo que ja tinha este
 * comportamento testado indiretamente via `2026-09-22_esperando_johnny.cjs`.
 * Este arquivo prova o MODULO isolado; os testes de cada consumidor (aqui:
 * `percepcao_travada.test.cjs`) provam que ELE usa o modulo direito.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { ultimaNotaSubstantiva, ehNeutra, NOTA_NEUTRA, TETO_NEUTRAS } = require("./_ultima_nota_substantiva.cjs");

const nota = (note, at = "2026-09-24T17:48:30.000Z") => ({ by: "frank", at, note });

// ---------------------------------------------------------------------------
// ehNeutra: reconhece os dois padroes conferidos a mao, mais nada.
// ---------------------------------------------------------------------------

test("ehNeutra casa o retrofit da trava do humano (#415, 24/09 17:48Z)", () => {
  assert.equal(ehNeutra("RETROFIT DA TRAVA DO HUMANO (#415) — marca posta a mao."), true);
});

test("ehNeutra casa o carimbo automatico da Fast (aluno mandou outro e-mail)", () => {
  assert.equal(ehNeutra("o aluno mandou outro e-mail e a Fast nao respondeu"), true);
  assert.equal(ehNeutra("O ALUNO MANDOU OUTRO EMAIL E A FAST NÃO RESPONDEU"), true);
});

test("ehNeutra em nota substantiva comum devolve false", () => {
  assert.equal(ehNeutra("falta um humano olhar a imagem do R2"), false);
  assert.equal(ehNeutra("9-A: devolver credito das geracoes fracas"), false);
});

test("ehNeutra em null/undefined/vazio nao explode", () => {
  assert.equal(ehNeutra(null), false);
  assert.equal(ehNeutra(undefined), false);
  assert.equal(ehNeutra(""), false);
});

// ---------------------------------------------------------------------------
// ultimaNotaSubstantiva: o recuo em si.
// ---------------------------------------------------------------------------

test("ultima nota ja substantiva: pulos=0, devolve ela mesma", () => {
  const notas = [nota("nota de tras"), nota("falta um humano olhar a imagem")];
  const { nota: n, pulos } = ultimaNotaSubstantiva(notas);
  assert.equal(pulos, 0);
  assert.equal(n.note, "falta um humano olhar a imagem");
});

test("UMA nota neutra por cima de nota substantiva: anda pra tras e acha (pulos=1)", () => {
  const notas = [
    nota("falta um humano olhar a imagem", "2026-09-20T10:00:00Z"),
    nota("RETROFIT DA TRAVA DO HUMANO (#415) — marca posta a mao.", "2026-09-24T17:48:00Z"),
  ];
  const { nota: n, pulos } = ultimaNotaSubstantiva(notas);
  assert.equal(pulos, 1);
  assert.equal(n.note, "falta um humano olhar a imagem");
});

test("nota neutra por cima de NADA (so neutra no array): nao acha nada, pulos conta mesmo assim", () => {
  const notas = [nota("RETROFIT DA TRAVA DO HUMANO (#415) — marca posta a mao.")];
  const { nota: n, pulos } = ultimaNotaSubstantiva(notas);
  assert.equal(n, null, "nao ha nota substantiva nenhuma no array — nao pode inventar uma");
  assert.equal(pulos, 1, "andou 1 passo antes de esgotar o array");
});

test("duas neutras empilhadas: anda pra tras pelas duas e acha a substantiva embaixo", () => {
  const notas = [
    nota("9-A: devolver credito das geracoes fracas", "2026-09-18T10:00:00Z"),
    nota("RETROFIT DA TRAVA DO HUMANO (#415)", "2026-09-24T17:48:00Z"),
    nota("o aluno mandou outro e-mail e a Fast nao respondeu", "2026-09-25T09:00:00Z"),
  ];
  const { nota: n, pulos } = ultimaNotaSubstantiva(notas);
  assert.equal(pulos, 2);
  assert.equal(n.note, "9-A: devolver credito das geracoes fracas");
});

test("TETO respeitado: estoura sem alcancar a substantiva enterrada embaixo (nao continua o array inteiro)", () => {
  // ⚠️ QUIRK HERDADO DA EXTRACAO, DE PROPOSITO NAO CONSERTADO AQUI: quando o
  // teto estoura EM CIMA de uma nota neutra (nao no fim do array todo), o
  // recuo para e devolve ESSA nota neutra como se fosse a substantiva, em vez
  // de null. E o mesmo comportamento do `ultimaNota()` original em
  // `2026-09-22_esperando_johnny.cjs` antes desta extracao — a prova disso e
  // o diff byte-a-byte contra producao no card deste incidente (02581255).
  // O que o teto GARANTE de verdade: nunca anda mais que TETO_NEUTRAS passos,
  // entao nunca ressuscita uma nota arbitrariamente antiga. O caso pratico
  // (nota substantiva REAL enterrada a mais de TETO_NEUTRAS de distancia) nao
  // foi medido acontecendo na base viva; se acontecer, o pior caso e devolver
  // uma nota NEUTRA (que nao casa nenhuma marca de percepcao/decisao) em vez
  // de null — o vies continua pra baixo (falso negativo), nao pra cima.
  assert.ok(TETO_NEUTRAS >= 1, "sanidade: o teto tem que ser positivo pra este teste fazer sentido");
  const pilhaNeutra = Array.from({ length: TETO_NEUTRAS + 2 }, (_, k) =>
    nota("RETROFIT DA TRAVA DO HUMANO (#415)", `2026-09-2${k}T10:00:00Z`)
  );
  const notas = [nota("falta um humano olhar a imagem", "2026-09-01T10:00:00Z"), ...pilhaNeutra];
  const { nota: n, pulos } = ultimaNotaSubstantiva(notas);
  assert.equal(pulos, TETO_NEUTRAS, "para de andar exatamente no teto, nao continua ate o fim do array");
  assert.notEqual(n && n.note, "falta um humano olhar a imagem", "nao alcancou a substantiva enterrada embaixo do teto");
  assert.ok(ehNeutra(n && n.note), "o que sobrou no ponto de parada e neutro, entao nao vai casar marca nenhuma na pratica");
});

test("exatamente no teto (nao um a mais): ainda acha a substantiva", () => {
  const pilhaNeutra = Array.from({ length: TETO_NEUTRAS }, (_, k) =>
    nota("RETROFIT DA TRAVA DO HUMANO (#415)", `2026-09-1${k}T10:00:00Z`)
  );
  const notas = [nota("falta um humano olhar a imagem", "2026-09-01T10:00:00Z"), ...pilhaNeutra];
  const { nota: n, pulos } = ultimaNotaSubstantiva(notas);
  assert.equal(n.note, "falta um humano olhar a imagem");
  assert.equal(pulos, TETO_NEUTRAS);
});

test("agent_notes null, vazio ou fora do formato de array: nao explode, devolve nota=null pulos=0", () => {
  assert.deepEqual(ultimaNotaSubstantiva(null), { nota: null, pulos: 0 });
  assert.deepEqual(ultimaNotaSubstantiva(undefined), { nota: null, pulos: 0 });
  assert.deepEqual(ultimaNotaSubstantiva([]), { nota: null, pulos: 0 });
  assert.deepEqual(ultimaNotaSubstantiva("nota velha virou string"), { nota: null, pulos: 0 });
});

test("nota sem campo 'note' (ex.: so metadado) nao e neutra e e devolvida como esta", () => {
  const notas = [{ by: "frank", at: "2026-09-19T10:00:00Z" }];
  const { nota: n, pulos } = ultimaNotaSubstantiva(notas);
  assert.equal(pulos, 0);
  assert.equal(n.note, undefined);
});

test("sanidade das constantes exportadas", () => {
  assert.ok(Array.isArray(NOTA_NEUTRA) && NOTA_NEUTRA.length === 2, "lista curta e conferida a mao de proposito");
  assert.equal(typeof TETO_NEUTRAS, "number");
  assert.ok(TETO_NEUTRAS > 0 && TETO_NEUTRAS < 20, "teto baixo de proposito — pilha grande e achado, nao filtro");
});
