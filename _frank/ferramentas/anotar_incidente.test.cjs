/**
 * Testes do resolvedor de alvo do `anotar_incidente.cjs`. Sem banco, sem rede:
 *
 *   node --test _frank/ferramentas/anotar_incidente.test.cjs
 *
 * ⚠️ Leia `# pass` / `# fail`, nunca so o codigo de saida (armadilha 3 do
 * `_frank/03_ROTINA.md`): teste que nao RODOU tambem sai com exit 0.
 *
 * POR QUE ESTE ARQUIVO EXISTE (chamado #496, medido 20/09). A versao antiga do
 * `anotar_incidente.cjs` resolvia o alvo SO por prefixo de uuid. Quem passava o
 * numero visivel do chamado caia numa armadilha CALADA: "427" e prefixo de
 * exatamente UM uuid (42741499-…, que e o chamado #138), entao a checagem de
 * ambiguidade nao disparava, a nota ia pro cartao errado e o script imprimia
 * "✅ GRAVADO". Medido na base inteira (482 numeros): 65 numeros caem em cartao
 * de estranho em silencio. O conserto (commit 931f472b) delegou ao resolvedor
 * do `_incidente_nota.cjs` (numero PRIMEIRO, prefixo depois). Este teste e a
 * rede de seguranca pra proxima refatoracao nao reintroduzir a armadilha — que
 * e silenciosa por construcao: grava no cartao errado e imprime sucesso.
 *
 * Os dados dos casos NAO sao inventados — vieram do banco de producao em
 * 20/09, medidos com `select id, numero from incidents` (486 cartoes):
 *
 *   168e8269-6293-488f-b259-f354af0197cf  ->  #427  (o cartao que o Vigia queria)
 *   42741499-b8ee-47b6-80d0-fe51598bbeaa  ->  #138  (o cartao que o codigo velho acertou)
 *   23f8123d-bdf4-434c-a77e-bcc69bdc2cdf  ->  #371  (prefixo legitimo, tem que continuar valendo)
 *   f574d04f-ec5f-4c90-8ab9-cb6fd6aa9236  ->  #87   ┐ compartilham o prefixo "f5":
 *   f5af8300-8d55-4102-9191-ace7ae3f5ac8  ->  #388  ┘ ambiguidade real da base
 *
 * PROVA DE QUE O TESTE MORDE: rodado contra o resolvedor VELHO (worktree em
 * 931f472b^, com o mesmo ajuste mecanico de exportacao e ZERO mudanca na
 * logica), os testes marcados [PEGA O VELHO] falham; na main, passam. Teste
 * que passa nos dois lados nao prova nada.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

// Importa o resolvedor DO PROPRIO script, nao uma copia: testar uma copia foi
// exatamente o buraco do #496 (o conserto existia ao lado, testado, e a
// ferramenta em producao nao o usava).
const { resolverId } = require("./anotar_incidente.cjs");

const ID_427 = "168e8269-6293-488f-b259-f354af0197cf"; // #427
const ID_138 = "42741499-b8ee-47b6-80d0-fe51598bbeaa"; // #138 — "427" e prefixo dele
const ID_371 = "23f8123d-bdf4-434c-a77e-bcc69bdc2cdf"; // #371
const ID_87 = "f574d04f-ec5f-4c90-8ab9-cb6fd6aa9236"; // #87  ┐ prefixo "f5"
const ID_388 = "f5af8300-8d55-4102-9191-ace7ae3f5ac8"; // #388 ┘ ambiguo

const BANCO = () => [
  { id: ID_427, numero: 427, status: "ignored", title: "E-mail nao chegou no aluno (inexistente)" },
  { id: ID_138, numero: 138, status: "fixed", title: "A varredura rotula trial R$0 como pagante" },
  { id: ID_371, numero: 371, status: "investigating", title: "Aluno nao consegue (gate de rosto)" },
  { id: ID_87, numero: 87, status: "fixed", title: "outro cartao" },
  { id: ID_388, numero: 388, status: "fixed", title: "outro cartao ainda" },
];

/**
 * Banco de mentira com a MESMA superficie do supabase-js que o resolvedor usa
 * (`from("incidents").select(...).limit(n)` awaitavel). O `.limit()` devolve o
 * proprio query e o objeto e thenable, entao serve tanto pro resolvedor novo
 * (que chama `.limit`) quanto pro velho (que awaita o `.select()` direto) —
 * e por isso que o MESMO arquivo roda contra os dois lados na prova.
 */
function fakeDb(linhas) {
  return {
    from(tabela) {
      assert.equal(tabela, "incidents");
      return {
        select() {
          const q = {
            limit() {
              return q;
            },
            then(res, rej) {
              return Promise.resolve({
                data: linhas.map((l) => ({ ...l })),
                error: null,
              }).then(res, rej);
            },
          };
          return q;
        },
      };
    },
  };
}

/** O resolvedor fala pelo console.log (avisos de colisao); aqui a gente escuta. */
async function comLogCapturado(fn) {
  const original = console.log;
  const logs = [];
  console.log = (...a) => logs.push(a.join(" "));
  try {
    const resultado = await fn();
    return { resultado, logs };
  } finally {
    console.log = original;
  }
}

/* ══════════ 1. O CASO DO #496: NUMERO GANHA DE PREFIXO ══════════ */

test("[PEGA O VELHO] '427' e o NUMERO do chamado #427, nao prefixo do uuid do #138", async () => {
  // O codigo velho devolvia o #138 (42741499-…) aqui, com ar de acerto, e a
  // nota do Vigia foi parar no cartao de outra pessoa. Chamado #496.
  const { resultado } = await comLogCapturado(() => resolverId(fakeDb(BANCO()), "427"));
  assert.equal(resultado.id, ID_427, "resolveu pro cartao errado — a armadilha do #496 voltou");
  assert.equal(resultado.numero, 427);
  assert.notEqual(resultado.id, ID_138);
});

test("[PEGA O VELHO] a colisao numero-vs-prefixo sai GRITADA no log, nao escondida", async () => {
  // Nao basta acertar o alvo: quem roda tem que VER que "427" tambem casaria
  // com o 42741499 (#138), senao a proxima pessoa redescobre a armadilha.
  const { logs } = await comLogCapturado(() => resolverId(fakeDb(BANCO()), "427"));
  const tudo = logs.join("\n");
  assert.match(tudo, /42741499/, "o aviso tem que apontar o uuid da colisao");
  assert.match(tudo, /#138/, "o aviso tem que apontar o numero do cartao colidido");
  assert.match(tudo, /NUMERO/, "e dizer que tratou o alvo como NUMERO");
});

test("[PEGA O VELHO] numero que nao e prefixo de nada RESOLVE (o velho recusava alto)", async () => {
  // 353 dos 482 numeros nao sao prefixo de uuid nenhum. No codigo velho isso
  // recusava com "nenhum incidente comeca com" — ruidoso, mas errado do mesmo
  // jeito: obrigava a ronda a caçar uuid na mao pra anotar por numero.
  const { resultado } = await comLogCapturado(() => resolverId(fakeDb(BANCO()), "138"));
  assert.equal(resultado.id, ID_138);
  assert.equal(resultado.numero, 138);
});

/* ══════════ 2. O QUE JA FUNCIONAVA TEM QUE CONTINUAR ══════════ */

test("prefixo de uuid unico continua resolvendo por PREFIXO", async () => {
  const { resultado } = await comLogCapturado(() => resolverId(fakeDb(BANCO()), "23f8123d"));
  assert.equal(resultado.id, ID_371);
  assert.equal(resultado.numero, 371);
});

test("uuid inteiro continua resolvendo nele mesmo", async () => {
  const { resultado } = await comLogCapturado(() => resolverId(fakeDb(BANCO()), ID_427));
  assert.equal(resultado.id, ID_427);
});

test("prefixo AMBIGUO recusa em vez de escolher em silencio", async () => {
  // "f5" casa #87 e #388 e nao e numero de cartao nenhum: unica resposta
  // decente e recusar apontando os dois. Escolher "o mais provavel" aqui e
  // como a nota nasceu no cartao de estranho.
  await assert.rejects(
    () => comLogCapturado(() => resolverId(fakeDb(BANCO()), "f5")),
    /ambiguo \(2\)/,
  );
});

test("alvo que nao existe (nem numero, nem prefixo) recusa", async () => {
  await assert.rejects(
    () => comLogCapturado(() => resolverId(fakeDb(BANCO()), "999")),
    /nenhum incidente/,
  );
});

/* ══════════ 3. GUARDA DE FONTE: O RESOLVEDOR E O COMPARTILHADO ══════════ */

test("[PEGA O VELHO] anotar_incidente.cjs DELEGA ao resolvedor testado, nao reimplementa", () => {
  // A licao do #496 nao foi "o resolvedor local tinha um bug"; foi "existia um
  // resolvedor certo e testado ao lado e a ferramenta usava um proprio". Esta
  // guarda barra a proxima refatoracao que reintroduzir um resolvedor local.
  const fs = require("node:fs");
  const path = require("node:path");
  const fonte = fs.readFileSync(path.join(__dirname, "anotar_incidente.cjs"), "utf8");

  assert.match(
    fonte,
    /require\("\.\/_incidente_nota\.cjs"\)/,
    "o resolvedor compartilhado (_incidente_nota.cjs) tem que ser importado",
  );

  const corpo = fonte.match(/async function resolverId[\s\S]*?\n}/);
  assert.ok(corpo, "resolverId sumiu do arquivo — se renomeou, atualize esta guarda");
  assert.match(
    corpo[0],
    /resolverIncidente\(/,
    "resolverId tem que delegar ao resolverIncidente compartilhado",
  );
  assert.ok(
    !corpo[0].includes("startsWith"),
    "resolverId voltou a casar prefixo por conta propria — a armadilha do #496",
  );
});
