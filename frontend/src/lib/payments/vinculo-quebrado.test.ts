/**
 * Testes do detector de VÍNCULO QUEBRADO. Rodar (Node ≥ 22.18, type-stripping):
 *   node --test src/lib/payments/vinculo-quebrado.test.ts
 *
 * OS CASOS SÃO REAIS, medidos no banco em 06/09/2026:
 *  - 8 pessoas com conta (criada em 04/09 por uma carga) + entitlement `active`
 *    com data futura + `user_id` NULL → plano free, 0 créditos, acesso NULL.
 *    max@md2net.com.br pagou R$1.154,88 em 13/08 e é o mais antigo.
 *  - No MESMO banco, 27 órfãos SEM conta (fluxo normal, o convite cuida) e o
 *    detector antigo gritava justamente por causa desses — duas vezes numa
 *    noite, em compras de 50 SEGUNDOS e 2 MINUTOS, ambas trial de R$0.
 *
 * Os dois lados dessa fronteira é o que estes testes cravam: BARULHO onde não
 * há problema tem que sumir, e SILÊNCIO onde há tem que virar alarme.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CARENCIA_VINCULO_MS,
  REAVISO_MS,
  aAvisar,
  classificar,
  inicioDoRelogio,
  marcarAvisados,
  separar,
  temAcessoVigente,
  textoDoAviso,
  type EstadoVinculo,
  type OrfaoAtivo,
} from "./vinculo-quebrado.ts";

const AGORA = "2026-09-06T12:00:00.000Z";

/** max@md2net.com.br: comprou 13/08, conta criada pela carga em 04/09. */
const MAX: OrfaoAtivo = {
  externalId: "LTY61KB0",
  buyerEmail: "max@md2net.com.br",
  status: "active",
  accessUntil: "2026-10-02T12:00:00.000Z",
  createdAt: "2026-08-13T23:05:38.000Z",
};

const CONTA_DA_CARGA = { criadaEm: "2026-09-04T16:47:26.000Z" };

test("o caso medido: conta existe, compra ativa, vínculo não aconteceu → BUG", () => {
  assert.equal(classificar(MAX, CONTA_DA_CARGA, AGORA), "vinculo_quebrado");
});

test("compra recente SEM conta não é bug — é o fluxo normal do convite", () => {
  // Este é o falso positivo que acordou a casa duas vezes: trial de R$0 com 50
  // segundos de vida. Sem conta, não há vínculo a cobrar de ninguém.
  const recemComprado: OrfaoAtivo = {
    ...MAX,
    externalId: "NOVA",
    createdAt: "2026-09-06T11:59:10.000Z",
  };
  assert.equal(classificar(recemComprado, null, AGORA), "sem_conta");
});

test("compra ANTIGA sem conta também não vira alarme deste detector", () => {
  // 24 dos 27 órfãos sem conta têm mais de 7 dias. Eles são do convite, não
  // daqui — misturar os dois é o que fazia o alerta virar ruído de fundo.
  assert.equal(classificar(MAX, null, AGORA), "sem_conta");
});

test("cancelado/expirado não é dinheiro preso hoje", () => {
  const expirado: OrfaoAtivo = { ...MAX, accessUntil: "2026-08-20T00:00:00.000Z" };
  assert.equal(classificar(expirado, CONTA_DA_CARGA, AGORA), "sem_acesso_vigente");
  const cancelado: OrfaoAtivo = { ...MAX, status: "canceled" };
  assert.equal(classificar(cancelado, CONTA_DA_CARGA, AGORA), "sem_acesso_vigente");
});

test("vitalício (access_until NULL) conta como acesso vigente", () => {
  assert.equal(temAcessoVigente({ ...MAX, accessUntil: null }, AGORA), true);
});

test("a carência protege o cadastro em andamento, e a fronteira é exata", () => {
  // Conta criada AGORA sobre compra velha: o claim do login ainda vai rodar.
  const emMs = (ms: number) => new Date(new Date(AGORA).getTime() + ms).toISOString();
  const conta = { criadaEm: AGORA };
  assert.equal(classificar(MAX, conta, emMs(CARENCIA_VINCULO_MS - 1)), "dentro_da_carencia");
  assert.equal(classificar(MAX, conta, emMs(CARENCIA_VINCULO_MS)), "vinculo_quebrado");
});

test("o relógio é o MAIS RECENTE do par (compra, conta), nunca o mais antigo", () => {
  // Medir pela compra faria uma conta criada agora, sobre compra de agosto,
  // disparar no ato — reintroduzindo o falso positivo por outro caminho.
  assert.equal(inicioDoRelogio(MAX, CONTA_DA_CARGA), CONTA_DA_CARGA.criadaEm);
  const compraNova: OrfaoAtivo = { ...MAX, createdAt: "2026-09-05T00:00:00.000Z" };
  assert.equal(inicioDoRelogio(compraNova, CONTA_DA_CARGA), compraNova.createdAt);
});

test("separar: conta quem tem conta, e cala sobre quem não tem", () => {
  const orfaos: OrfaoAtivo[] = [
    { ...MAX, externalId: "NOVO", buyerEmail: "atendimento@dropweb.com.br" },
    { ...MAX },
    { ...MAX, externalId: "SEMCONTA", buyerEmail: "ninguem@nada.com" },
  ];
  const contas = new Map([
    ["max@md2net.com.br", { criadaEm: "2026-08-20T00:00:00.000Z" }],
    ["atendimento@dropweb.com.br", CONTA_DA_CARGA],
    ["ninguem@nada.com", null],
  ]);
  const { quebrados, contagem } = separar(orfaos, contas, AGORA);
  assert.equal(contagem.vinculo_quebrado, 2);
  assert.equal(contagem.sem_conta, 1);
  assert.equal(quebrados.length, 2);
});

test("a fila é a do DINHEIRO parado, não a da idade do defeito", () => {
  // O caso real: a carga de 04/09 quebrou todo mundo no MESMO dia, então
  // ordenar por `diasQuebrado` empata os 8 e some com quem pagou primeiro.
  // max comprou em 13/08 e tem que vir na frente de quem comprou em 02/09,
  // mesmo os dois tendo a conta criada na mesma hora.
  const orfaos: OrfaoAtivo[] = [
    { ...MAX, externalId: "NOVA", buyerEmail: "atendimento@dropweb.com.br", createdAt: "2026-09-02T18:32:57.000Z" },
    { ...MAX },
  ];
  const contas = new Map([
    ["max@md2net.com.br", CONTA_DA_CARGA],
    ["atendimento@dropweb.com.br", CONTA_DA_CARGA],
  ]);
  const { quebrados } = separar(orfaos, contas, AGORA);
  assert.equal(quebrados[0].buyerEmail, "max@md2net.com.br");
  assert.equal(quebrados[0].diasQuebrado, quebrados[1].diasQuebrado); // empatam no defeito
  assert.ok(quebrados[0].diasPagando > quebrados[1].diasPagando); // desempatam no dinheiro
  assert.equal(quebrados[0].diasPagando, 23);
});

test("o aviso mostra o relógio do dinheiro, não só o do defeito", () => {
  const { quebrados, contagem } = separar([MAX], new Map([[MAX.buyerEmail, CONTA_DA_CARGA]]), AGORA);
  const { texto } = textoDoAviso(quebrados, [], contagem);
  // 23 dias de dinheiro parado, 1 dia de conta existindo: os dois no texto.
  assert.match(texto, /PAGOU há 23 dia\(s\)/);
  assert.match(texto, /a conta existe há 1 dia\(s\)/);
});

test("e-mail com caixa/espaço diferente ainda casa com a conta", () => {
  const sujo: OrfaoAtivo = { ...MAX, buyerEmail: "  MAX@md2net.com.BR " };
  const { contagem } = separar(
    [sujo],
    new Map([["max@md2net.com.br", CONTA_DA_CARGA]]),
    AGORA,
  );
  assert.equal(contagem.vinculo_quebrado, 1);
});

test("avisa uma vez; não repete no dia seguinte", () => {
  const { quebrados } = separar([MAX], new Map([[MAX.buyerEmail, CONTA_DA_CARGA]]), AGORA);
  const estado: EstadoVinculo = {};
  const primeiro = aAvisar(quebrados, estado, AGORA);
  assert.equal(primeiro.novos.length, 1);
  marcarAvisados(estado, primeiro.novos, AGORA);

  const amanha = "2026-09-07T12:00:00.000Z";
  const segundo = aAvisar(quebrados, estado, amanha);
  assert.equal(segundo.novos.length, 0);
  assert.equal(segundo.lembretes.length, 0);
});

test("mas se continuar quebrado, o lembrete volta — alerta único vira silêncio", () => {
  const { quebrados } = separar([MAX], new Map([[MAX.buyerEmail, CONTA_DA_CARGA]]), AGORA);
  const estado: EstadoVinculo = {};
  marcarAvisados(estado, quebrados, AGORA);
  const depois = new Date(new Date(AGORA).getTime() + REAVISO_MS).toISOString();
  const r = aAvisar(quebrados, estado, depois);
  assert.equal(r.lembretes.length, 1);
  assert.equal(r.novos.length, 0);
});

test("o texto fala com quem NÃO lê código e proíbe liberar por conta própria", () => {
  const { quebrados, contagem } = separar([MAX], new Map([[MAX.buyerEmail, CONTA_DA_CARGA]]), AGORA);
  const { assunto, texto } = textoDoAviso(quebrados, [], contagem);
  assert.match(assunto, /pagante/);
  // parte 1: ação, antes do técnico (ordem obrigatória de 01/09)
  assert.ok(texto.indexOf("O QUE FAZER") < texto.indexOf("TÉCNICO"));
  assert.match(texto, /NÃO libere nada por conta própria/);
  assert.match(texto, /max@md2net\.com\.br/);
  // não promete religar sozinho
  assert.doesNotMatch(texto, /vinculei|liberei|creditei/i);
});
