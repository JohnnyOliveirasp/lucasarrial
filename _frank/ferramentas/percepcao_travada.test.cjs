/**
 * Testes do detector de percepcao travada. Sem banco, sem rede:
 *
 *   node --test "_frank/ferramentas/percepcao_travada.test.cjs"
 *
 * ⚠️ Leia `# pass` / `# skipped`, nunca so o codigo de saida (armadilha 3 do
 * `_frank/03_ROTINA.md`): teste que nao RODOU tambem sai com exit 0.
 *
 * POR QUE ESTES CASOS. Em 21/09 duas rondas seguidas reportaram "18 cards
 * travados em percepcao" medindo com o SQL cru da ordem de 17/09, que varre a
 * pilha de agent_notes INTEIRA — e os 18 eram falso positivo (15 casavam so
 * em nota JA SUPERADA; 702cc916/#226, ab5644be/#296 e bb97e2f1/#460 entre
 * eles). O criterio certo, que este arquivo trava em teste, e: a marca conta
 * SO na ULTIMA nota. A ultima secao roda a semantica VELHA (pilha inteira)
 * contra os MESMOS casos e prova que ela erra — teste que passa nos dois
 * lados nao prova nada.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { marcaDe, travadosDe, MARCAS, BOILERPLATE } = require("./percepcao_travada.cjs");

// ---------------------------------------------------------------------------
// Casos fabricados com a MESMA forma das linhas de `incidents`.
// ---------------------------------------------------------------------------

/** CONTROLE POSITIVO fabricado: a ULTIMA nota pede percepcao. TEM que casar. */
const PENDENTE_REAL = {
  id: "aa11bb22-0000-4000-8000-000000000001", numero: 9001, status: "open",
  agent_notes: [
    { by: "frank", at: "2026-09-18T10:00:00Z", note: "medi o extrato, nada anormal" },
    { by: "frank", at: "2026-09-20T10:00:00Z", note: "falta um humano olhar a imagem do R2 e decidir se o rosto e o da aluna" },
  ],
};

/** A classe dos 18 falsos: marca em nota ANTERIOR, ultima nota ja superou. */
const SUPERADO = {
  id: "aa11bb22-0000-4000-8000-000000000002", numero: 9002, status: "open",
  agent_notes: [
    { by: "frank", at: "2026-09-10T10:00:00Z", note: "nao enxergo a imagem daqui, precisa assistir o video" },
    { by: "olho", at: "2026-09-12T10:00:00Z", note: "assisti: o video abre normal, causa achada, cartao-filho aberto" },
  ],
};

/** Boilerplate do sensor na ultima nota NAO e pedido de percepcao. */
const SO_BOILERPLATE = {
  id: "aa11bb22-0000-4000-8000-000000000003", numero: 9003, status: "investigating",
  agent_notes: [{ by: "carol", at: "2026-09-19T10:00:00Z", note: "isto precisa de olho humano, não de código" }],
};

/** Fechado nao entra, mesmo com marca viva na ultima nota. */
const FECHADO = {
  id: "aa11bb22-0000-4000-8000-000000000004", numero: 9004, status: "fixed",
  agent_notes: [{ by: "frank", at: "2026-09-15T10:00:00Z", note: "precisa ouvir o audio" }],
};

/** agent_notes degenerado: null, vazio, e fora do formato. Nao explode, nao casa. */
const NOTAS_NULL = { id: "aa11bb22-0000-4000-8000-000000000005", numero: 9005, status: "open", agent_notes: null };
const NOTAS_VAZIAS = { id: "aa11bb22-0000-4000-8000-000000000006", numero: 9006, status: "open", agent_notes: [] };
const NOTAS_STRING = { id: "aa11bb22-0000-4000-8000-000000000007", numero: 9007, status: "open", agent_notes: "nota velha virou string, e ate diz assistir" };
const ULTIMA_SEM_NOTE = { id: "aa11bb22-0000-4000-8000-000000000008", numero: 9008, status: "open", agent_notes: [{ by: "frank", at: "2026-09-19T10:00:00Z" }] };

const BANCO = () => [PENDENTE_REAL, SUPERADO, SO_BOILERPLATE, FECHADO, NOTAS_NULL, NOTAS_VAZIAS, NOTAS_STRING, ULTIMA_SEM_NOTE];

// ---------------------------------------------------------------------------
// marcaDe: a leitura de UMA nota.
// ---------------------------------------------------------------------------

test("marcaDe acha a marca mesmo com acento e caixa (não ouço -> nao ouco)", () => {
  assert.equal(marcaDe("Não OUÇO o áudio desta geração"), "nao ouco");
});

test("marcaDe desconta o boilerplate do sensor", () => {
  assert.equal(marcaDe("precisa de olho humano, não de código"), null);
});

test("marcaDe em null/undefined/vazio devolve null sem explodir", () => {
  assert.equal(marcaDe(null), null);
  assert.equal(marcaDe(undefined), null);
  assert.equal(marcaDe(""), null);
});

// ---------------------------------------------------------------------------
// travadosDe: o criterio inteiro — ULTIMA nota, cards abertos.
// ---------------------------------------------------------------------------

test("CONTROLE POSITIVO: ultima nota pedindo percepcao CASA (detector nao ficou cego)", () => {
  const t = travadosDe(BANCO());
  assert.equal(t.length, 1, "exatamente o pendente real, nada alem");
  assert.equal(t[0].i.numero, 9001);
  assert.equal(t[0].marca, "humano olhar");
  assert.equal(t[0].ultima.at, "2026-09-20T10:00:00Z", "a nota apontada e a ULTIMA");
});

test("marca em nota JA SUPERADA nao casa (a classe dos 18 falsos de 21/09)", () => {
  assert.equal(travadosDe([SUPERADO]).length, 0);
});

test("boilerplate do sensor na ultima nota nao casa", () => {
  assert.equal(travadosDe([SO_BOILERPLATE]).length, 0);
});

test("card fechado nao entra, mesmo com marca na ultima nota", () => {
  assert.equal(travadosDe([FECHADO]).length, 0);
});

test("agent_notes null / [] / string / nota sem 'note' nao explode nem casa", () => {
  assert.equal(travadosDe([NOTAS_NULL, NOTAS_VAZIAS, NOTAS_STRING, ULTIMA_SEM_NOTE]).length, 0);
});

test("ordena do mais parado pro mais recente pela data da ultima nota", () => {
  const outro = {
    ...PENDENTE_REAL, id: "aa11bb22-0000-4000-8000-000000000009", numero: 9009,
    agent_notes: [{ by: "frank", at: "2026-09-01T10:00:00Z", note: "precisa assistir o video do aluno" }],
  };
  const t = travadosDe([PENDENTE_REAL, outro]);
  assert.deepEqual(t.map((x) => x.i.numero), [9009, 9001]);
});

// ---------------------------------------------------------------------------
// A semantica VELHA (pilha inteira, como o SQL cru da ordem de 17/09) contra
// os MESMOS casos: ela marca o SUPERADO como pendencia. E por isso que ela
// devolvia 18 e este detector devolvia 2 no mesmo instante de 21/09.
// ---------------------------------------------------------------------------

test("prova de discriminacao: a pilha inteira ERRA nestes mesmos casos", () => {
  const pilhaInteira = (i) => {
    const t = JSON.stringify(i.agent_notes ?? "").toLowerCase();
    return ["humano olhar", "precisa olhar", "nao enxergo", "nao ouco", "assistir", "ouvir"].some((p) => t.includes(p));
  };
  assert.equal(pilhaInteira(SUPERADO), true, "a semantica velha marca historico como pendencia");
  assert.equal(travadosDe([SUPERADO]).length, 0, "a nova nao");
});

test("sanidade das constantes exportadas", () => {
  assert.ok(MARCAS.includes("humano olhar"));
  assert.ok(!MARCAS.includes("alguem olhar"), "saiu em 17/09 (#315): verbo sem artefato");
  assert.equal(BOILERPLATE, "precisa de olho humano, nao de codigo");
});
