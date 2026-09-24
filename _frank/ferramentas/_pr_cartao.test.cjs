/**
 * Testes do vinculo PR mergeado -> cartao e do passo pos-merge (0398d161).
 * Sem banco, sem rede, sem gh:
 *
 *   node --test _frank/ferramentas/_pr_cartao.test.cjs
 *
 * ⚠️ Leia `# pass` / `# skipped`, nunca so o codigo de saida (armadilha 3 do
 * `_frank/03_ROTINA.md`): teste que nao RODOU tambem sai com exit 0.
 *
 * Os DOIS testes que o pedido exige com estas palavras estao aqui e nomeados
 * assim: IDEMPOTENCIA (rodar 2x = 1 nota) e FALSO POSITIVO (PR sem numero de
 * cartao no titulo = nao posta nada). O resto cerca as beiradas da heuristica
 * (auto-referencia, "PR #N", fragmento so-digitos, cartao fechado) e amarra o
 * marcador da nota ao NOTA_NEUTRA do esperando_johnny.cjs — sem esse amarre,
 * mudar o formato num lado cegaria a fila do Johnny no outro (o "QUEM ANOTA,
 * ESCONDE" do retrofit #415, agora automatizado).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  extrairCandidatosDoTitulo,
  casarPrsComCartoes,
  jaTemNotaDoPr,
  montarNota,
  postarNotasPosMerge,
  tagPosMerge,
} = require("./_pr_cartao.cjs");

// ids no formato real (uuid), numeros pequenos como os cartoes de verdade.
const ID_314 = "58b376ea-1111-4000-8000-000000000001";
const ID_414 = "d3d8d1b2-2222-4000-8000-000000000002";
const ID_9 = "0398d161-3333-4000-8000-000000000003";
const AGORA = "2026-09-24T23:00:00.000Z";

const CARTOES = () => [
  { id: ID_314, numero: 314, status: "open", title: "titularidade", agent_notes: [{ note: "a" }] },
  { id: ID_414, numero: 414, status: "aguardando_aluno", title: "premissa morta", agent_notes: null },
  { id: ID_9, numero: 9, status: "investigating", title: "merge mudo", agent_notes: [] },
  { id: "ffffffff-0000-4000-8000-00000000000f", numero: 355, status: "fixed", title: "FECHADO", agent_notes: [] },
];

const PR = (n, title, extra = {}) => ({
  number: n,
  title,
  mergedAt: "2026-09-24T19:24:00Z",
  body: "",
  url: `https://github.com/x/y/pull/${n}`,
  ...extra,
});

/** Banco de mentira com a superficie que `anexarNota` usa (copia, nao ref). */
function bancoFake(linhas) {
  const dados = linhas.map((l) => ({ ...l, agent_notes: structuredClone(l.agent_notes) }));
  return {
    dados,
    from(tabela) {
      assert.equal(tabela, "incidents");
      return {
        select() {
          return {
            eq: (campo, valor) => ({
              maybeSingle: async () => {
                const row = dados.find((d) => d[campo] === valor);
                return { data: row ? structuredClone(row) : null, error: null };
              },
            }),
            in: async () => ({ data: structuredClone(dados), error: null }),
          };
        },
        update(patch) {
          return {
            eq: (campo, valor) => ({
              select: async () => {
                const row = dados.find((d) => d[campo] === valor);
                if (!row) return { data: [], error: null };
                Object.assign(row, structuredClone(patch));
                return { data: [structuredClone(row)], error: null };
              },
            }),
          };
        },
      };
    },
  };
}

// ---------------------------------------------------------------- extracao
test("extrai numero de cartao no estilo da casa: fix(#414): ...", () => {
  const { numeros } = extrairCandidatosDoTitulo("fix(#414): premissa morta no cartao", 292);
  assert.deepEqual(numeros, [414]);
});

test("FALSO POSITIVO do pedido: PR sem numero de cartao no titulo = nenhum candidato", () => {
  const r = extrairCandidatosDoTitulo("enviar_email: guarda de bounce ANTES do envio", 369);
  assert.deepEqual(r, { numeros: [], fragmentos: [] });
});

test("auto-referencia: PR citando o proprio numero nao vira candidato", () => {
  const { numeros } = extrairCandidatosDoTitulo("revert do #400 por flake", 400);
  assert.deepEqual(numeros, []);
});

test("'PR #N' e referencia a PR, nao a cartao — filtrado (com e sem pontuacao)", () => {
  assert.deepEqual(extrairCandidatosDoTitulo("reabre o trabalho do PR #355", 500).numeros, []);
  assert.deepEqual(extrairCandidatosDoTitulo("stack sobre os PRs #355 e #404", 500).numeros, [404]);
  // ⚠️ residual honesto e documentado: numa lista "PRs #A e #B", so o PRIMEIRO
  // numero esta colado em "PRs" — o segundo passa. Por isso a ultima linha de
  // defesa e exigir cartao VIVO com aquele numero (teste de casamento abaixo).
});

test("fragmento hex sem letra (data 20260924) nao e candidato; com letra e", () => {
  const r = extrairCandidatosDoTitulo("ronda 20260924: conserta 0398d161 e d3d8d1b2", 501);
  assert.deepEqual(r.fragmentos.sort(), ["0398d161", "d3d8d1b2"]);
});

// --------------------------------------------------------------- casamento
test("numero sem cartao VIVO correspondente nao casa (ultima linha de defesa)", () => {
  const pares = casarPrsComCartoes([PR(500, "fix(#9999): nada")], CARTOES());
  assert.equal(pares.size, 0);
});

test("cartao FECHADO nao recebe vinculo mesmo nomeado no titulo", () => {
  const pares = casarPrsComCartoes([PR(500, "fix(#355): ja fechado")], CARTOES());
  assert.equal(pares.size, 0);
});

test("PR sem mergedAt (aberto) nao casa nada", () => {
  const pares = casarPrsComCartoes([PR(500, "fix(#314): em voo", { mergedAt: null })], CARTOES());
  assert.equal(pares.size, 0);
});

test("numero E fragmento do MESMO cartao no titulo viram UM vinculo, nao dois", () => {
  const pares = casarPrsComCartoes([PR(500, "fix(#314): caso 58b376ea")], CARTOES());
  assert.equal(pares.size, 1);
  assert.equal(pares.get(ID_314).length, 1);
});

// ------------------------------------------------------------------- nota
test("a nota diz O QUE o PR fez (titulo+corpo), que merge nao e cura, e carrega o marcador", () => {
  const nota = montarNota(PR(355, "fix(#314): titularidade nao vaza", { body: "Trava a troca sem prova.  \n Testes: 7/7." }));
  assert.ok(nota.startsWith(tagPosMerge(355)), "marcador de idempotencia no comeco");
  assert.match(nota, /MERGEOU em 2026-09-24T19:24:00Z/);
  assert.match(nota, /titularidade nao vaza/, "titulo do PR presente");
  assert.match(nota, /Trava a troca sem prova\. Testes: 7\/7\./, "corpo presente e sem quebras");
  assert.match(nota, /MERGE NAO E CURA/);
  assert.match(nota, /NAO fechar automaticamente/);
});

test("corpo enorme e truncado com reticencias (nota nao vira parede)", () => {
  const nota = montarNota(PR(355, "fix(#314): x", { body: "z".repeat(1000) }));
  assert.ok(nota.includes("z".repeat(400) + " (...)"));
  assert.ok(!nota.includes("z".repeat(401)));
});

// ------------------------------------------------------------ idempotencia
test("jaTemNotaDoPr acha o marcador mesmo em agent_notes corrompido (string)", () => {
  assert.equal(jaTemNotaDoPr([{ note: `${tagPosMerge(355)} ...` }], 355), true);
  assert.equal(jaTemNotaDoPr([{ note: `${tagPosMerge(355)} ...` }], 404), false);
  assert.equal(jaTemNotaDoPr(null, 355), false);
  // o normalizarNotas embrulha string corrompida em nota legada — o marcador
  // dentro dela ainda conta, senao a 2a rodada postaria em dobro.
  assert.equal(jaTemNotaDoPr(`historico corrompido ${tagPosMerge(355)}`, 355), true);
});

test("IDEMPOTENCIA do pedido: rodar 2x com --confirmar = 1 nota, e a 2a rodada declara o pulo", async () => {
  const db = bancoFake(CARTOES());
  const prs = [PR(355, "fix(#314): titularidade nao vaza", { body: "Trava a troca." })];

  const r1 = await postarNotasPosMerge(db, prs, db.dados, { confirmar: true, agora: AGORA });
  assert.equal(r1.postadas.length, 1);
  assert.equal(r1.puladas.length, 0);
  const cartao = db.dados.find((d) => d.id === ID_314);
  assert.equal(cartao.agent_notes.length, 2, "1 nota velha + 1 do pos-merge");
  assert.equal(cartao.agent_notes[1].by, "pos-merge");

  // segunda rodada le o estado JA GRAVADO (como na vida real: outro processo)
  const r2 = await postarNotasPosMerge(db, prs, db.dados, { confirmar: true, agora: AGORA });
  assert.equal(r2.postadas.length, 0, "nada novo na 2a rodada");
  assert.deepEqual(
    r2.puladas.map((p) => ({ pr: p.pr, numero: p.numero })),
    [{ pr: 355, numero: 314 }],
    "o pulo e declarado, nao silencioso",
  );
  assert.equal(cartao.agent_notes.length, 2, "segue com UMA nota do pos-merge");
});

test("ENSAIO (sem confirmar) nao grava nada e avisa que e ensaio", async () => {
  const db = bancoFake(CARTOES());
  const prs = [PR(355, "fix(#314): x")];
  const r = await postarNotasPosMerge(db, prs, db.dados, { confirmar: false });
  assert.equal(r.ensaio, true);
  assert.equal(r.postadas.length, 1, "mostra o que postaria");
  assert.equal(db.dados.find((d) => d.id === ID_314).agent_notes.length, 1, "banco intocado");
});

test("o passo NUNCA muda status: nenhum update carrega a chave status", async () => {
  const db = bancoFake(CARTOES());
  const original = db.from.bind(db);
  db.from = (t) => {
    const h = original(t);
    const upd = h.update.bind(h);
    h.update = (patch) => {
      assert.ok(!("status" in patch), "o pos-merge tentou mexer em status — PROIBIDO");
      assert.deepEqual(Object.keys(patch), ["agent_notes"], "so agent_notes pode ser tocado");
      return upd(patch);
    };
    return h;
  };
  await postarNotasPosMerge(db, [PR(355, "fix(#314): x")], db.dados, { confirmar: true, agora: AGORA });
});

// ------------------------------------------- amarre com a fila do Johnny
test("NOTA_NEUTRA do esperando_johnny reconhece a nota pos-merge (sem isso, QUEM ANOTA ESCONDE)", () => {
  const fonte = fs.readFileSync(path.join(__dirname, "2026-09-22_esperando_johnny.cjs"), "utf8");
  assert.ok(
    fonte.includes("pos-merge PR #"),
    "o esperando_johnny.cjs nao conhece o marcador [pos-merge PR #N] — a nota automatica esconderia da fila do Johnny exatamente o cartao que pede visita (retrofit #415, de novo)",
  );
  // e o marcador REAL que este modulo gera casa com o padrao de la:
  const m = fonte.match(/^\s*(\/\^\\\[pos-merge PR #\\d\+\\\][^\n]*\/i),/m);
  assert.ok(m, "padrao regex do pos-merge nao encontrado na lista NOTA_NEUTRA");
  const re = eval(m[1]); // o literal exato do arquivo
  assert.match(montarNota(PR(355, "fix(#314): x")), re, "a nota gerada tem que casar o padrao de la");
});
