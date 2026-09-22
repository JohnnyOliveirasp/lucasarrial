/**
 * SGP retomada pelo e-mail verificado — o que estes testes protegem:
 *
 *  1. e-mail verificado COM pedido em andamento → a retomada é oferecida e
 *     devolve o id daquela linha;
 *  2. e-mail SEM pedido em aberto → nada é oferecido (comportamento de hoje:
 *     nasce linha nova), sem regressão;
 *  3. DUAS linhas em andamento (caso real jcesaram@gmail.com) → ganha a de
 *     MAIS FOTOS APROVADAS, e a preterida continua existindo intacta;
 *  4. linha 'pronto' (e enviado/processando/falhou) NUNCA é oferecida;
 *  5. o aluno PODE RECUSAR: recusou → fica na sessão nova e a linha antiga
 *     segue intacta;
 *  6. MUTAÇÃO: sem o critério de progresso (ordenar só por "mais recente",
 *     que era o desenho da branch wip de 12/09), o código pega a linha ERRADA
 *     — a vazia de 11/09 — no caso do jcesaram. O teste prova que a suíte
 *     mata esse mutante.
 *
 * Rodar (Node >= 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/retomada-pure.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  destinoDaRetomada,
  emAndamento,
  escolherRetomada,
  resolverRetomada,
  type CandidatoRetomada,
} from "./retomada-pure.ts";
import type { SgpStatus } from "./types.ts";

const SESSAO_NOVA = "aaaaaaaa-0000-0000-0000-000000000001";

function linha(over: Partial<CandidatoRetomada>): CandidatoRetomada {
  return {
    id: "id-x",
    sessao: "bbbbbbbb-0000-0000-0000-000000000002",
    status: "foto",
    fotosAprovadas: 0,
    atualizadoEm: "2026-09-10T12:00:00.000Z",
    emailVerificadoAt: "2026-09-10T11:00:00.000Z",
    userId: null,
    ...over,
  };
}

/** O caso REAL do jcesaram@gmail.com (medido em 22/09): linha de 10/09 com
 *  4 fotos e linha de 11/09 com 0 — a segunda nasceu do cookie perdido. */
function cenarioJcesaram(): CandidatoRetomada[] {
  return [
    linha({
      id: "jcesaram-10-09",
      sessao: "cccccccc-0000-0000-0000-000000000003",
      fotosAprovadas: 4,
      atualizadoEm: "2026-09-10T15:00:00.000Z",
    }),
    linha({
      id: "jcesaram-11-09",
      sessao: "dddddddd-0000-0000-0000-000000000004",
      fotosAprovadas: 0,
      atualizadoEm: "2026-09-11T09:00:00.000Z",
    }),
  ];
}

test("1. e-mail verificado com pedido em andamento → oferece retomar aquela linha", () => {
  const aberta = linha({ id: "linha-aberta", fotosAprovadas: 6 });
  const alvo = escolherRetomada([aberta], SESSAO_NOVA);
  assert.ok(alvo, "a retomada tem que ser oferecida");
  assert.equal(alvo.id, "linha-aberta");
  assert.equal(alvo.sessao, aberta.sessao);
});

test("2. e-mail sem pedido em aberto → nada a oferecer (hoje: nasce linha nova)", () => {
  // Nenhuma linha no banco pra esse e-mail.
  assert.equal(escolherRetomada([], SESSAO_NOVA), null);
  // Só existe a linha da PRÓPRIA sessão atual: também não há o que retomar.
  const propria = linha({ id: "propria", sessao: SESSAO_NOVA, fotosAprovadas: 2 });
  assert.equal(escolherRetomada([propria], SESSAO_NOVA), null);
  // E linha sem e-mail verificado não entra: verificar É a barra de posse.
  const semProva = linha({ id: "sem-prova", emailVerificadoAt: null });
  assert.equal(escolherRetomada([semProva], SESSAO_NOVA), null);
  // Pedido que uma conta já assumiu se retoma com LOGIN, não pela tela pública.
  const deConta = linha({ id: "de-conta", userId: "user-1" });
  assert.equal(escolherRetomada([deConta], SESSAO_NOVA), null);
});

test("3. duas linhas em andamento → ganha a de mais fotos, e a outra continua existindo", () => {
  const candidatos = cenarioJcesaram();
  const antes = structuredClone(candidatos);

  const alvo = escolherRetomada(candidatos, SESSAO_NOVA);
  assert.ok(alvo);
  assert.equal(alvo.id, "jcesaram-10-09", "a linha com 4 fotos ganha da vazia");

  // A escolha não apaga nem sobrescreve nada: as DUAS linhas seguem lá.
  assert.deepEqual(candidatos, antes, "escolher não pode mutar as linhas");
  assert.equal(candidatos.length, 2);

  // Empate de fotos → desempata a mais recente (aí sim a data decide).
  const empate = [
    linha({ id: "velha", sessao: "eeeeeeee-0000-0000-0000-000000000005", fotosAprovadas: 3, atualizadoEm: "2026-09-01T00:00:00.000Z" }),
    linha({ id: "nova", sessao: "ffffffff-0000-0000-0000-000000000006", fotosAprovadas: 3, atualizadoEm: "2026-09-15T00:00:00.000Z" }),
  ];
  assert.equal(escolherRetomada(empate, SESSAO_NOVA)?.id, "nova");
});

test("4. linha 'pronto' (e demais fora do wizard) NUNCA é oferecida", () => {
  const pronta = linha({ id: "pronta", status: "pronto", fotosAprovadas: 6 });
  assert.equal(escolherRetomada([pronta], SESSAO_NOVA), null);

  for (const status of ["enviado", "processando", "falhou"] as SgpStatus[]) {
    assert.equal(
      escolherRetomada([linha({ id: `l-${status}`, status, fotosAprovadas: 6 })], SESSAO_NOVA),
      null,
      `linha '${status}' não pode ser retomável`,
    );
    assert.equal(emAndamento(status), false);
  }
  // E mesmo COMPETINDO com uma linha aberta, a pronta não rouba a vaga.
  const aberta = linha({ id: "aberta", sessao: "99999999-0000-0000-0000-000000000009", fotosAprovadas: 1 });
  assert.equal(escolherRetomada([pronta, aberta], SESSAO_NOVA)?.id, "aberta");
});

test("5. aluno recusa → fica na sessão nova e o pedido antigo segue intacto", () => {
  const candidatos = cenarioJcesaram();
  const antes = structuredClone(candidatos);

  const decisao = resolverRetomada(candidatos, SESSAO_NOVA, "recusar");
  assert.equal(decisao.sessao, SESSAO_NOVA, "recusou → o cookie fica na linha nova");
  assert.equal(decisao.retomada, null);
  assert.deepEqual(candidatos, antes, "recusar não pode tocar nas linhas antigas");

  // E aceitar reaponta pra canônica — sem apagar nada.
  const aceite = resolverRetomada(candidatos, SESSAO_NOVA, "retomar");
  assert.equal(aceite.retomada?.id, "jcesaram-10-09");
  assert.deepEqual(candidatos, antes);
});

test("6. MUTAÇÃO: ordenar só por 'mais recente' pega a linha ERRADA do jcesaram", () => {
  const candidatos = cenarioJcesaram();

  // O mutante: a seleção da branch wip de 12/09 (order by atualizado_em desc,
  // limit 1) — sem o critério de fotos aprovadas do item 3.
  function escolherMutante(cs: readonly CandidatoRetomada[], sessaoAtual: string) {
    const elegiveis = cs.filter(
      (c) => c.sessao !== sessaoAtual && emAndamento(c.status) && c.emailVerificadoAt !== null && c.userId === null,
    );
    if (elegiveis.length === 0) return null;
    return [...elegiveis].sort((a, b) => Date.parse(b.atualizadoEm) - Date.parse(a.atualizadoEm))[0];
  }

  const doMutante = escolherMutante(candidatos, SESSAO_NOVA);
  const correto = escolherRetomada(candidatos, SESSAO_NOVA);

  // O mutante escolhe a linha VAZIA de 11/09 — exatamente o defeito que
  // recriaria o encalhe: o aluno "retoma" pra um pedido sem nada dentro.
  assert.equal(doMutante?.id, "jcesaram-11-09");
  assert.equal(doMutante?.fotosAprovadas, 0);
  // E a implementação real diverge dele: pega a linha com as 4 fotos.
  assert.equal(correto?.id, "jcesaram-10-09");
  assert.notEqual(correto?.id, doMutante?.id, "o teste 3 mata este mutante");
});

test("destino da retomada sai do status — e 'dados' cai em foto (e-mail já provado)", () => {
  assert.equal(destinoDaRetomada("dados"), "/sgp/foto");
  assert.equal(destinoDaRetomada("foto"), "/sgp/foto");
  assert.equal(destinoDaRetomada("audio"), "/sgp/audio");
  assert.equal(destinoDaRetomada("revisao"), "/sgp/revisao");
});
