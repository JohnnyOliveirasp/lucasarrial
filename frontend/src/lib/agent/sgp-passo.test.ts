/**
 * O que este teste protege, em uma frase: a Fast NUNCA manda o aluno procurar
 * no app um material que nunca chegou, nem manda entrar numa conta em que ele
 * nunca conseguiu entrar. Incidente #315.
 *
 * O texto É o produto: ele vai cru pro system prompt e foi um texto — não um
 * cálculo — que produziu o incidente. Por isso os controles negativos abaixo
 * medem a AUSÊNCIA das frases erradas, e não só a presença das certas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PORTAL_SGP,
  blocoSgpParaAgente,
  linhaDoLogin,
  pedidoQueDecide,
  type PedidoNoContexto,
} from "./sgp-passo.ts";
import { SGP_STATUS, type SgpStatus } from "../sgp/types.ts";

const ONTEM = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const AMANHA = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const ped = (status: SgpStatus, extra: Partial<PedidoNoContexto> = {}): PedidoNoContexto => ({
  status,
  criado_em: "2026-09-09T13:10:01.725Z",
  atualizado_em: "2026-09-09T13:36:41.448Z",
  ...extra,
});

// ── LOGIN ───────────────────────────────────────────────────────────────────

test("nunca entrou: avisa, e proíbe o “clique em Entrar” que gerou o #315", () => {
  const l = linhaDoLogin({ ultimoLogin: null });
  assert.match(l, /NUNCA ENTROU/);
  assert.match(l, /nunca definiu senha/);
  // A orientação impossível de cumprir tem que sair explicitamente barrada.
  assert.match(l, /NÃO diga/);
});

test("já entrou: diz a data, sem alarme", () => {
  const l = linhaDoLogin({ ultimoLogin: "2026-09-09T17:29:12.754Z" });
  assert.match(l, /último acesso em 09\/09\/2026/);
  assert.doesNotMatch(l, /NUNCA ENTROU/);
});

test("leitura do Auth falhou: CALA, não afirma nada (princípio do #282)", () => {
  const l = linhaDoLogin({ desconhecido: true });
  assert.match(l, /NÃO consegui conferir/);
  // O pior desfecho aqui seria virar "nunca entrou" e a Fast afirmar isso a um pagante.
  assert.doesNotMatch(l, /NUNCA ENTROU/);
});

test("data de login ilegível não vira “entrou em Invalid Date”", () => {
  const l = linhaDoLogin({ ultimoLogin: "não é data" });
  assert.doesNotMatch(l, /Invalid/);
  assert.match(l, /NUNCA ENTROU/); // degrada pro lado que não afirma acesso
});

// ── SEM PEDIDO: o caso que abriu o incidente ────────────────────────────────

test("sem pedido: manda pro portal PÚBLICO e diz que não exige login", () => {
  const b = blocoSgpParaAgente({ pedidos: [], ultimoLogin: null });
  assert.match(b, /NENHUM consta/);
  assert.ok(b.includes(PORTAL_SGP), "tem que citar o portal de envio");
  assert.match(b, /NÃO exige login/);
  assert.match(b, /NADA CHEGOU/);
});

test("CONTROLE NEGATIVO: sem pedido, nunca manda procurar em menu do app", () => {
  const b = blocoSgpParaAgente({ pedidos: [], ultimoLogin: null });
  // A resposta real do #315 apontou os menus Vídeos/Vozes pra quem não tinha nada.
  assert.doesNotMatch(b, /menu \*{0,2}(Vídeos|Vozes)/i);
  assert.match(b, /NÃO afirme que o material está em algum menu/);
});

// ── COM PEDIDO: cada estado diz a verdade sobre o próximo passo ─────────────

test("revisao: é “falta um clique”, e NÃO pede material novo", () => {
  const b = blocoSgpParaAgente({ pedidos: [ped("revisao")], ultimoLogin: ONTEM });
  assert.match(b, /Confirmar e Enviar/);
  assert.match(b, /não peça material novo/);
  assert.match(b, /ainda NÃO chegou/);
});

test("enviado e processando: proíbem pedir material de novo", () => {
  for (const s of ["enviado", "processando"] as SgpStatus[]) {
    const b = blocoSgpParaAgente({ pedidos: [ped(s)], ultimoLogin: ONTEM });
    assert.match(b, /NÃO peça material de novo/, `${s} tem que barrar o pedido repetido`);
    assert.match(b, /não precisa fazer nada/, `${s} não exige ação do aluno`);
  }
});

test("falhou: não devolve a culpa ao aluno e manda escalar", () => {
  const b = blocoSgpParaAgente({ pedidos: [ped("falhou", { erro: "CUDA out of memory" })] });
  assert.match(b, /NOSSO lado/);
  assert.match(b, /NÃO precisa refazer nada/);
  assert.match(b, /escale/);
  assert.match(b, /CUDA out of memory/);
});

test("não-enviados apontam o portal; enviados/entregues NÃO", () => {
  for (const s of ["dados", "foto", "audio", "revisao"] as SgpStatus[]) {
    const b = blocoSgpParaAgente({ pedidos: [ped(s)] });
    assert.ok(b.includes(PORTAL_SGP), `${s} precisa do portal`);
    assert.match(b, /NÃO exige login/, `${s} precisa dizer que não exige login`);
  }
  for (const s of ["enviado", "processando", "pronto"] as SgpStatus[]) {
    const b = blocoSgpParaAgente({ pedidos: [ped(s)] });
    // Mandar quem já enviou para o portal de envio é pedir trabalho refeito.
    assert.ok(!b.includes(PORTAL_SGP), `${s} NÃO pode apontar o portal de envio`);
  }
});

test("pedido vazio conta as fotos/áudios que REALMENTE constam", () => {
  const b = blocoSgpParaAgente({ pedidos: [ped("foto", { fotos: 0, audios: 0 })] });
  // O aluno do #315 afirmava ter mandado tudo; o número é o que desmente sem acusar.
  assert.match(b, /0 foto\(s\) e 0 áudio\(s\)/);
});

// ── VÁRIOS PEDIDOS: a armadilha do ranking de AVANÇO ────────────────────────

test("revisao vivo GANHA de pronto antigo (caso do perfil b1bb9057)", () => {
  // Pelo ranking de AVANÇO do painel, `pronto` venceria e esconderia o pedido
  // que está a um clique de ser enviado. Aqui tem que vencer o que precisa de ação.
  const pedidos = [
    ped("pronto", { enviado_em: "2026-09-10T10:00:00.000Z" }),
    ped("revisao", { atualizado_em: "2026-09-12T10:00:00.000Z" }),
  ];
  assert.equal(pedidoQueDecide(pedidos)?.status, "revisao");
  const b = blocoSgpParaAgente({ pedidos });
  assert.match(b, /Confirmar e Enviar/);
  // ...e a entrega existente NÃO pode desaparecer do contexto.
  assert.match(b, /2 pedidos no SGP/);
  assert.match(b, /pronto/);
});

test("falhou é o mais urgente de todos", () => {
  for (const s of SGP_STATUS.filter((x) => x !== "falhou")) {
    assert.equal(
      pedidoQueDecide([ped(s), ped("falhou")])?.status,
      "falhou",
      `falhou tem que ganhar de ${s}`,
    );
  }
});

test("empate de urgência desempata pelo mais recente", () => {
  const velho = ped("foto", { atualizado_em: "2026-09-01T10:00:00.000Z" });
  const novo = ped("foto", { atualizado_em: "2026-09-15T10:00:00.000Z" });
  assert.equal(pedidoQueDecide([velho, novo]), novo);
  assert.equal(pedidoQueDecide([novo, velho]), novo);
});

test("um pedido só não gera a linha de “vários pedidos”", () => {
  const b = blocoSgpParaAgente({ pedidos: [ped("foto")] });
  assert.doesNotMatch(b, /pedidos no SGP\./);
});

test("pedidoQueDecide não muta o array recebido", () => {
  const pedidos = [ped("pronto"), ped("revisao")];
  const antes = pedidos.map((p) => p.status);
  pedidoQueDecide(pedidos);
  assert.deepEqual(
    pedidos.map((p) => p.status),
    antes,
  );
});

// ── O PORTÃO DO CÓDIGO DE VERIFICAÇÃO ──────────────────────────────────────

test("código vencido e e-mail não verificado: avisa e proíbe o código antigo", () => {
  const b = blocoSgpParaAgente({
    pedidos: [ped("foto", { email_verificado_at: null, codigo_expira_em: ONTEM })],
  });
  assert.match(b, /VENCEU/);
  assert.match(b, /código NOVO/);
  assert.match(b, /NÃO mande usar o código antigo/);
});

test("código ainda válido, ou e-mail já verificado: sem alarme falso", () => {
  const valido = blocoSgpParaAgente({
    pedidos: [ped("foto", { email_verificado_at: null, codigo_expira_em: AMANHA })],
  });
  assert.doesNotMatch(valido, /VENCEU/);

  const verificado = blocoSgpParaAgente({
    pedidos: [ped("foto", { email_verificado_at: ONTEM, codigo_expira_em: ONTEM })],
  });
  assert.doesNotMatch(verificado, /VENCEU/);
});

test("código vencido num pedido JÁ ENVIADO não vira alarme (portão já passou)", () => {
  const b = blocoSgpParaAgente({
    pedidos: [ped("pronto", { email_verificado_at: null, codigo_expira_em: ONTEM })],
  });
  assert.doesNotMatch(b, /VENCEU/);
});

// ── LEITURA FALHOU ─────────────────────────────────────────────────────────

test("leitura de sgp_pedidos falhou: NÃO afirma “não tem pedido”", () => {
  const b = blocoSgpParaAgente({ pedidos: [], pedidosDesconhecidos: true, ultimoLogin: ONTEM });
  assert.match(b, /NÃO consegui ler/);
  assert.doesNotMatch(b, /NENHUM consta/);
  assert.match(b, /escale/);
  // Não pode mandar procurar material em menu nenhum sem saber o estado.
  assert.match(b, /não mande procurar material em menu nenhum/);
});

// ── COBERTURA E INVARIANTES ────────────────────────────────────────────────

test("todo status de SGP_STATUS produz bloco, e nenhum vaza “Invalid Date”", () => {
  for (const s of SGP_STATUS) {
    const b = blocoSgpParaAgente({ pedidos: [ped(s)], ultimoLogin: ONTEM });
    assert.ok(b.length > 0, `${s} tem que gerar texto`);
    assert.match(b, /^SGP \/ PRIMEIRO ACESSO/, `${s} tem que trazer o cabeçalho`);
    assert.doesNotMatch(b, /Invalid Date/, `${s} vazou Invalid Date`);
    assert.doesNotMatch(b, /undefined|null/, `${s} vazou undefined/null`);
  }
});

test("pedido casado por e-mail é declarado como tal", () => {
  const b = blocoSgpParaAgente({ pedidos: [ped("foto", { porEmail: true })] });
  assert.match(b, /casou pelo E-MAIL/);
  assert.doesNotMatch(
    blocoSgpParaAgente({ pedidos: [ped("foto")] }),
    /casou pelo E-MAIL/,
  );
});
