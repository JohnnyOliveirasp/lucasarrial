/**
 * Testes do alvo do incidente e da escrita conferida. Sem banco, sem rede:
 *
 *   node --test _frank/ferramentas/_incidente_nota.test.cjs
 *
 * ⚠️ Leia `# pass` / `# skipped`, nunca so o codigo de saida (armadilha 3 do
 * `_frank/03_ROTINA.md`): teste que nao RODOU tambem sai com exit 0.
 *
 * Os dados dos casos NAO sao inventados — vieram do banco de producao em
 * 15/09, medidos com `select id, numero from incidents`:
 *
 *   4071ee9a-8414-4ac9-b9a9-49be6a3efa5d  ->  #399
 *   d5e1acb2-3d44-467b-ad83-42b85d1db3ba  ->  #407
 *
 * E por isso que "407" e uma armadilha e nao um detalhe: lido como PREFIXO de
 * uuid ele casa com o #399, um card de outra pessoa, com ar de acerto.
 *
 * A ultima secao roda o codigo VELHO (copiado do `main`) contra os MESMOS
 * casos, e prova que ele reprova. Teste que passa nos dois lados nao prova nada.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { resolverIncidente, anexarNota, normalizarNotas, ehNumero } = require("./_incidente_nota.cjs");

const ID_399 = "4071ee9a-8414-4ac9-b9a9-49be6a3efa5d";
const ID_407 = "d5e1acb2-3d44-467b-ad83-42b85d1db3ba";
const AGORA = "2026-09-15T12:00:00.000Z";

const BANCO = () => [
  { id: ID_399, numero: 399, status: "fixed", title: "Fast (SGP): aluno quer saber se da pra criar", agent_notes: [{ note: "a" }, { note: "b" }] },
  { id: ID_407, numero: 407, status: "fixed", title: "Fast (cobranca): aluno pediu cancelamento", agent_notes: [{ note: "x" }, { note: "y" }] },
  { id: "aa11bb22-0000-4000-8000-000000000001", numero: 12, status: "open", title: "outro", agent_notes: null },
  { id: "aa11bb22-0000-4000-8000-000000000002", numero: 13, status: "open", title: "outro ainda", agent_notes: "nota velha virou string" },
];

/**
 * Banco de mentira com a MESMA superficie do supabase-js que o modulo usa.
 * Copia na leitura e na escrita de proposito: no banco de verdade existe a
 * rede no meio, e um teste que compartilha referencia esconde mutacao.
 */
function fakeDb(linhas, opts = {}) {
  const estado = { linhas: linhas.map((l) => ({ ...l })), updates: 0 };
  const copia = (o) => JSON.parse(JSON.stringify(o));

  const db = {
    from(tabela) {
      assert.equal(tabela, "incidents");
      return {
        select() {
          const q = {
            _id: null,
            limit() {
              return q;
            },
            eq(_campo, valor) {
              q._id = valor;
              return q;
            },
            maybeSingle() {
              if (opts.erroLeitura) return Promise.resolve({ data: null, error: opts.erroLeitura });
              const hit = estado.linhas.find((l) => l.id === q._id);
              return Promise.resolve({ data: hit ? copia(hit) : null, error: null });
            },
            // thenable: `await db.from(...).select(...).limit(n)`
            then(res, rej) {
              const r = opts.erroLeitura
                ? { data: null, error: opts.erroLeitura }
                : { data: estado.linhas.map(copia), error: null };
              return Promise.resolve(opts.listaCrua ? opts.listaCrua : r).then(res, rej);
            },
          };
          return q;
        },
        update(patch) {
          const u = {
            _id: null,
            eq(_campo, valor) {
              u._id = valor;
              return u;
            },
            select() {
              if (opts.erroEscrita) return Promise.resolve({ data: null, error: opts.erroEscrita });
              const i = estado.linhas.findIndex((l) => l.id === u._id);
              // O CORACAO DO BUG: id que nao existe devolve [] SEM erro.
              if (i < 0) return Promise.resolve({ data: [], error: null });
              estado.linhas[i] = { ...estado.linhas[i], ...copia(patch) };
              estado.updates += 1;
              const devolve = opts.devolveEscrita
                ? opts.devolveEscrita(estado.linhas[i])
                : { id: estado.linhas[i].id, agent_notes: copia(estado.linhas[i].agent_notes) };
              return Promise.resolve({ data: [devolve], error: null });
            },
          };
          return u;
        },
      };
    },
  };
  return { db, estado };
}

const notasDe = (estado, id) => estado.linhas.find((l) => l.id === id).agent_notes;

/* ══════════════════ 1. ACHAR O INCIDENTE CERTO ══════════════════ */

test("O BUG DE 15/09: '407' e o NUMERO do incidente, nao prefixo de uuid", async () => {
  // Lido como prefixo, "407" casa com 4071ee9a = incidente #399. Foi o que
  // aconteceu com o anotar_incidente; aqui o numero tem que ganhar.
  const { db } = fakeDb(BANCO());
  const r = await resolverIncidente(db, "407");
  assert.equal(r.incidente.id, ID_407);
  assert.equal(r.incidente.numero, 407);
  assert.equal(r.via, "numero");
  // E a colisao nao fica escondida: quem le o log ve a armadilha.
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /4071ee9a/);
  assert.match(r.avisos[0], /#399/);
});

test("uuid inteiro resolve nele mesmo", async () => {
  const { db } = fakeDb(BANCO());
  const r = await resolverIncidente(db, ID_407);
  assert.equal(r.incidente.id, ID_407);
  assert.equal(r.via, "prefixo");
  assert.deepEqual(r.avisos, []);
});

test("prefixo hex unico resolve (o caminho que o anotar_incidente ja usava)", async () => {
  const { db } = fakeDb(BANCO());
  const r = await resolverIncidente(db, "d5e1acb2");
  assert.equal(r.incidente.id, ID_407);
  assert.equal(r.via, "prefixo");
});

test("prefixo AMBIGUO recusa em vez de escolher o primeiro", async () => {
  const { db } = fakeDb(BANCO());
  await assert.rejects(() => resolverIncidente(db, "aa11bb22"), /ambiguo \(2\)/);
});

test("numero que nao existe RECUSA — nao vira UPDATE de 0 linhas", async () => {
  const { db } = fakeDb(BANCO());
  await assert.rejects(() => resolverIncidente(db, "999"), /nenhum incidente com numero ou id/);
});

test("uuid que nao existe RECUSA", async () => {
  const { db } = fakeDb(BANCO());
  await assert.rejects(
    () => resolverIncidente(db, "ffffffff-0000-4000-8000-000000000000"),
    /nao vou dar UPDATE em alvo que nao existe/,
  );
});

test("so-digitos que NAO e numero de incidente ainda tenta como prefixo, avisando", async () => {
  // "4071" nao e numero de incidente nenhum (o maior e 409), mas e prefixo de
  // um uuid so. Cair pro prefixo aqui e certo; o que nao pode e cair calado.
  const { db } = fakeDb(BANCO());
  const r = await resolverIncidente(db, "4071");
  assert.equal(r.incidente.id, ID_399);
  assert.equal(r.via, "prefixo");
  assert.match(r.avisos[0], /nenhum incidente com numero 4071/);
});

test("--incidente sem valor (comeu a flag seguinte) recusa com mensagem util", async () => {
  const { db } = fakeDb(BANCO());
  await assert.rejects(() => resolverIncidente(db, "--confirmar"), /faltou o valor/);
});

test("--incidente vazio ou ausente recusa", async () => {
  const { db } = fakeDb(BANCO());
  await assert.rejects(() => resolverIncidente(db, ""), /veio vazio/);
  await assert.rejects(() => resolverIncidente(db, undefined), /veio vazio/);
});

test("lixo no --incidente nem chega a consultar o banco", async () => {
  const { db } = fakeDb(BANCO());
  await assert.rejects(() => resolverIncidente(db, "maria@exemplo.com"), /nao e numero de incidente nem uuid/);
});

test("ARMADILHA 1: erro de leitura NAO pode virar 'nao existe'", async () => {
  const { db } = fakeDb(BANCO(), { erroLeitura: { message: "column does not exist", code: "42703" } });
  await assert.rejects(() => resolverIncidente(db, "407"), /falha lendo incidents/);
});

test("lista truncada recusa — 'prefixo unico' numa lista cortada e mentira", async () => {
  const gigante = Array.from({ length: 5000 }, (_, i) => ({
    id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, "0")}`,
    numero: i + 1,
    status: "open",
    title: "x",
  }));
  const { db } = fakeDb(gigante);
  await assert.rejects(() => resolverIncidente(db, "1"), /truncada/);
});

test("leitura que nao devolve lista recusa", async () => {
  const { db } = fakeDb(BANCO(), { listaCrua: { data: null, error: null } });
  await assert.rejects(() => resolverIncidente(db, "407"), /nao devolveu lista/);
});

/* ══════════════════ 2. ESCREVER E PROVAR QUE ESCREVEU ══════════════════ */

test("anexa a nota PRESERVANDO o historico (2 -> 3), e confere na releitura", async () => {
  const { db, estado } = fakeDb(BANCO());
  const alvo = (await resolverIncidente(db, "407")).incidente;
  const g = await anexarNota(db, alvo, "CANCELAMENTO EXECUTADO", { agora: AGORA });

  assert.equal(g.antes, 2);
  assert.equal(g.depois, 3);
  const notas = notasDe(estado, ID_407);
  assert.equal(notas.length, 3);
  assert.deepEqual(notas.slice(0, 2), [{ note: "x" }, { note: "y" }]); // historico intacto
  assert.deepEqual(notas[2], { at: AGORA, by: "frank", note: "CANCELAMENTO EXECUTADO" });
  // e o card vizinho nao foi tocado
  assert.equal(notasDe(estado, ID_399).length, 2);
});

test("O BUG DE 15/09, do outro lado: UPDATE de 0 linhas LANCA, nao imprime sucesso", async () => {
  const { db, estado } = fakeDb(BANCO());
  await assert.rejects(
    () => anexarNota(db, "d5e1acb2-3d44-467b-ad83-000000000000", "nota", { agora: AGORA }),
    /nao existe mais na hora da escrita|afetou 0 linhas/,
  );
  assert.equal(estado.updates, 0);
});

test("agent_notes null vira array com 1 nota (nao quebra, nao sobrescreve nada)", async () => {
  const { db, estado } = fakeDb(BANCO());
  const g = await anexarNota(db, "aa11bb22-0000-4000-8000-000000000001", "primeira", { agora: AGORA });
  assert.equal(g.antes, 0);
  assert.equal(g.depois, 1);
  assert.equal(g.eraLegado, false);
  assert.equal(notasDe(estado, "aa11bb22-0000-4000-8000-000000000001").length, 1);
});

test("agent_notes corrompido em STRING (acidente de 21/08) vira nota legada, texto preservado", async () => {
  const { db, estado } = fakeDb(BANCO());
  const g = await anexarNota(db, "aa11bb22-0000-4000-8000-000000000002", "nova", { agora: AGORA });
  assert.equal(g.eraLegado, true);
  const notas = notasDe(estado, "aa11bb22-0000-4000-8000-000000000002");
  assert.equal(notas.length, 2);
  assert.match(notas[0].note, /nota velha virou string/);
  assert.equal(notas[0].legado, true);
});

test("erro cru na escrita LANCA (nao vira sucesso silencioso)", async () => {
  const { db } = fakeDb(BANCO(), { erroEscrita: { message: "permission denied", code: "42501" } });
  await assert.rejects(() => anexarNota(db, ID_407, "nota", { agora: AGORA }), /falha gravando agent_notes/);
});

test("releitura com tamanho errado LANCA — 'mandei' nao e 'gravou'", async () => {
  const { db } = fakeDb(BANCO(), {
    devolveEscrita: (linha) => ({ id: linha.id, agent_notes: [{ note: "so uma" }] }),
  });
  await assert.rejects(() => anexarNota(db, ID_407, "nota", { agora: AGORA }), /esperava 3/);
});

test("releitura que nao volta array LANCA", async () => {
  const { db } = fakeDb(BANCO(), {
    devolveEscrita: (linha) => ({ id: linha.id, agent_notes: "virou string" }),
  });
  await assert.rejects(() => anexarNota(db, ID_407, "nota", { agora: AGORA }), /nao array/);
});

test("nota vazia recusa antes de encostar no banco", async () => {
  const { db, estado } = fakeDb(BANCO());
  await assert.rejects(() => anexarNota(db, ID_407, "  "), /nota vazia/);
  assert.equal(estado.updates, 0);
});

/* ══════════════════ 3. AUXILIARES ══════════════════ */

test("ehNumero separa numero de uuid", () => {
  assert.equal(ehNumero("407"), true);
  assert.equal(ehNumero(" 407 "), true);
  assert.equal(ehNumero("4071ee9a"), false);
  assert.equal(ehNumero(ID_407), false);
  assert.equal(ehNumero(""), false);
});

test("normalizarNotas nunca perde conteudo", () => {
  assert.deepEqual(normalizarNotas(null), []);
  assert.deepEqual(normalizarNotas(undefined), []);
  assert.deepEqual(normalizarNotas([{ a: 1 }]), [{ a: 1 }]);
  assert.deepEqual(normalizarNotas({ a: 1 }), [{ a: 1 }]);
  assert.match(normalizarNotas("texto solto")[0].note, /texto solto/);
});

/* ══════════════════ 4. O CODIGO VELHO REPROVA NOS MESMOS CASOS ══════════════════
 *
 * Copia fiel do que estava no `main` (cancelar_assinatura.cjs, linhas 242-259):
 * le por `.eq("id", INCIDENTE)` cru, empurra a nota, grava sem conferir, e
 * devolve a linha de sucesso INCONDICIONAL. Se estes testes passassem tambem
 * contra ele, o teste nao estaria medindo nada.
 */
async function LEGADO_registrar(db, INCIDENTE, texto) {
  const { data: row } = await db.from("incidents").select("agent_notes").eq("id", INCIDENTE).maybeSingle();
  const notes = row?.agent_notes ?? [];
  notes.push({ at: AGORA, by: "frank", note: texto });
  await db.from("incidents").update({ agent_notes: notes }).eq("id", INCIDENTE).select("id,agent_notes");
  return `   registrado no incidente ${INCIDENTE}.`; // incondicional: a mentira
}

test("VELHO: '--incidente 407' nao grava NADA e ainda assim diz que registrou", async () => {
  const { db, estado } = fakeDb(BANCO());
  const saida = await LEGADO_registrar(db, "407", "CANCELAMENTO EXECUTADO");

  assert.equal(saida, "   registrado no incidente 407."); // <- o sucesso falso
  assert.equal(estado.updates, 0, "nenhuma linha escrita");
  assert.equal(notasDe(estado, ID_407).length, 2, "o #407 continuou com 2 notas");
  assert.equal(notasDe(estado, ID_399).length, 2, "e o #399 tambem nao mudou");
});

test("VELHO: prefixo de uuid tambem nao grava, e tambem diz que registrou", async () => {
  const { db, estado } = fakeDb(BANCO());
  const saida = await LEGADO_registrar(db, "d5e1acb2", "nota");
  assert.match(saida, /registrado no incidente/);
  assert.equal(estado.updates, 0);
  assert.equal(notasDe(estado, ID_407).length, 2);
});

/* ══════════════════ 5. O BUG DE 20/09 (#496): "427" caiu no cartao do #138 ══════════════════
 *
 * Segunda mordida do MESMO defeito, agora no `anotar_incidente.cjs` (que ainda
 * nao tinha adotado este modulo). Dados medidos no banco de producao em 20/09:
 *
 *   168e8269-6293-488f-b259-f354af0197cf  ->  #427 (bounce da Luciana)
 *   42741499-b8ee-47b6-80d0-fe51598bbeaa  ->  #138 (varredura rotulava trial como pagante)
 *
 * "427" e prefixo de EXATAMENTE UM uuid (42741499-... = #138), entao a recusa
 * por ambiguidade do resolvedor velho NAO disparava: hits.length === 1, o
 * UPDATE ia pro cartao errado e o script imprimia GRAVADO. Medido na base
 * inteira em 20/09: 65 de 481 numeros tem essa mesma armadilha (prefixo de
 * exatamente 1 uuid alheio).
 */

const ID_427 = "168e8269-6293-488f-b259-f354af0197cf"; // #427, o alvo pedido
const ID_138 = "42741499-b8ee-47b6-80d0-fe51598bbeaa"; // #138, onde a nota caiu

const BANCO_496 = () => [
  { id: ID_427, numero: 427, status: "ignored", title: "E-mail nao chegou no aluno (inexistente): lucianadox1", agent_notes: [{ note: "a" }] },
  { id: ID_138, numero: 138, status: "fixed", title: "A VARREDURA ROTULA TRIAL R$0 COMO PAGANTE", agent_notes: [{ note: "b" }] },
];

test("(a) numero que existe resolve pelo NUMERO: '427' -> #427, nunca #138", async () => {
  const { db } = fakeDb(BANCO_496());
  const r = await resolverIncidente(db, "427");
  assert.equal(r.incidente.id, ID_427);
  assert.equal(r.incidente.numero, 427);
  assert.equal(r.via, "numero");
});

test("(b) numero que TAMBEM e prefixo unico de uuid de OUTRO cartao ganha pelo numero, com a colisao gritada", async () => {
  const { db } = fakeDb(BANCO_496());
  const r = await resolverIncidente(db, "427");
  // O aviso e o ponto: a armadilha aparece na tela em vez de virar nota alheia.
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /42741499/);
  assert.match(r.avisos[0], /#138/);
  assert.match(r.avisos[0], /NUMERO/);
});

test("(c) conflito REAL recusa: numero duplicado em dois cartoes nao escolhe por voce", async () => {
  // Hoje nao ha numero duplicado em producao (medido 20/09: 486 incidentes, 0
  // duplicatas) — mas se um dia houver, escolher "o primeiro" e escrever no
  // cartao de outra pessoa. Recusa ruidosa e o unico comportamento aceitavel.
  const banco = BANCO_496();
  banco.push({ id: "bb22cc33-0000-4000-8000-000000000009", numero: 427, status: "open", title: "duplicata", agent_notes: null });
  const { db } = fakeDb(banco);
  await assert.rejects(() => resolverIncidente(db, "427"), /numero 427 aparece em 2 incidentes/);
});

/**
 * Copia FIEL do resolverId que estava no `anotar_incidente.cjs` ate 20/09
 * (removido no commit 931f472b, #496): so prefixo de uuid, nada de `numero`.
 * Se este teste um dia falhar porque alguem "consertou" a copia, a copia
 * deixou de provar o que o codigo velho fazia — nao conserte, apague a secao.
 */
async function LEGADO_resolverId(db, alvo) {
  const { data, error } = await db.from("incidents").select("id,title,status");
  if (error) throw new Error(`falha lendo incidents: ${JSON.stringify(error)}`);
  const hits = data.filter((i) => String(i.id).startsWith(alvo));
  if (hits.length === 0) throw new Error(`nenhum incidente comeca com "${alvo}"`);
  if (hits.length > 1) throw new Error(`prefixo "${alvo}" e ambiguo (${hits.length})`);
  return hits[0];
}

test("VELHO: '427' passa LISO pelo resolvedor antigo e devolve o cartao ERRADO (#138)", async () => {
  // hits.length === 1, entao nenhuma recusa dispara: e o caso perigoso que
  // escrevia baixo, ao contrario dos 417 numeros que recusavam alto.
  const { db } = fakeDb(BANCO_496());
  const errado = await LEGADO_resolverId(db, "427");
  assert.equal(errado.id, ID_138, "o velho resolve '427' como prefixo de 42741499 = #138");
});

test("NOVO: adocao pelo anotar_incidente.cjs esta viva no fonte (nao regredir pra resolvedor proprio)", () => {
  // O conserto ficou pronto em 15/09 e o anotar_incidente so adotou em 20/09,
  // depois de 5 dias escrevendo no cartao errado. Este teste falha se alguem
  // reintroduzir um resolvedor local por prefixo em vez de importar daqui.
  const fs = require("node:fs");
  const path = require("node:path");
  const fonte = fs.readFileSync(path.join(__dirname, "anotar_incidente.cjs"), "utf8");
  assert.match(fonte, /require\("\.\/_incidente_nota\.cjs"\)/, "anotar_incidente.cjs deve importar o resolvedor compartilhado");
  assert.match(fonte, /resolverIncidente\(/, "anotar_incidente.cjs deve chamar resolverIncidente");
  assert.doesNotMatch(
    fonte,
    /String\(i\.id\)\.startsWith/,
    "resolvedor local por prefixo de uuid reintroduzido — e o bug do #496 de volta",
  );
});

test("NOVO: o mesmo comando morre com mensagem em vez de mentir", async () => {
  // O par do teste acima. Mesmo banco, mesmo "407": o caminho novo acerta o
  // alvo e grava de verdade; e quando nao da, LANCA.
  const { db, estado } = fakeDb(BANCO());
  const alvo = (await resolverIncidente(db, "407")).incidente;
  await anexarNota(db, alvo, "CANCELAMENTO EXECUTADO", { agora: AGORA });
  assert.equal(estado.updates, 1);
  assert.equal(notasDe(estado, ID_407).length, 3);
  assert.equal(notasDe(estado, ID_399).length, 2);
});
