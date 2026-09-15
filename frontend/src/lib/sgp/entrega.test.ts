/**
 * SGP — o corte GERADO × ENTREGUE (recado 6 do Johnny, 15/09).
 *
 * O QUE ESTES TESTES PROTEGEM, e cada um tem um caso real por trás:
 *  1. `status = 'pronto'` SEM registro de aviso NÃO pode dizer "nada a fazer" —
 *     foi o que deixou franklindfreis, biatupi e andreviana com o clone pronto
 *     sem saber, um deles por 8 dias, com a tela dizendo "Entregue" o tempo todo;
 *  2. com o carimbo, a linha vira ENTREGUE e o "parado há" PARA de contar;
 *  3. quem comprou e nunca abriu o portal APARECE na fila de trabalho;
 *  4. a régua dos 7 dias só corre depois da ENTREGA, e reclamação a trava;
 *  5. o carimbo nunca é herdado de outro ciclo do mesmo aluno.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/entrega.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SGP_CONCLUSAO_AUTOMATICA_DIAS,
  conclusaoAutomatica,
  lerAviso,
  montarLinha,
  ordenar,
  resumir,
  situacao,
  type AvisoEntrega,
} from "./painel.ts";
import { avisoDoPedido } from "./aviso.ts";
import {
  filaComNaoIniciados,
  montarCompradores,
  type LinhaComprador,
} from "./compradores.ts";
import type { SgpPedidoRow } from "./types.ts";

const H = 60 * 60 * 1000;
const D = 24 * H;
const AGORA = new Date("2026-09-15T12:00:00Z").getTime();

function pedido(over: Partial<SgpPedidoRow> = {}): SgpPedidoRow {
  return {
    id: "id-1",
    sessao: "sess",
    nome: "Fulano",
    email: "f@x.com",
    whatsapp: "5561999998888",
    email_verificado_at: null,
    codigo_hash: null,
    codigo_expira_em: null,
    codigo_tentativas: 0,
    conta_existente: false,
    user_id: "user-1",
    criado_em: new Date(AGORA - 20 * D).toISOString(),
    atualizado_em: new Date(AGORA - 10 * D).toISOString(),
    status: "pronto",
    ciencia_foto: null,
    ciencia_foto_at: null,
    ciencia_audio: null,
    ciencia_audio_at: null,
    aceite_lgpd_at: null,
    fotos: [],
    audios: [],
    enviado_em: new Date(AGORA - 11 * D).toISOString(),
    foto_pronta_em: null,
    voz_pronta_em: null,
    voice_id: null,
    erro: null,
    ...over,
  };
}

/** O carimbo do sistema, como `lib/sgp/aviso.ts` o monta. */
const avisoEm = (ms: number): AvisoEntrega => ({
  em: new Date(ms).toISOString(),
  canal: "e-mail",
  por: "o sistema",
});

/* ===========================================================================
 * 1) PRONTO SEM CARIMBO → "avisar o aluno", NUNCA "nada a fazer"
 * ========================================================================= */

test("pronto SEM registro de aviso manda AVISAR O ALUNO, não 'nada a fazer'", () => {
  const l = montarLinha(pedido(), AGORA, undefined, null);

  assert.equal(l.situacao, "pronto");
  assert.equal(l.situacaoRotulo, "GERADO", "a palavra PRONTO era lida como 'acabou'");
  assert.equal(l.avisado, false);
  assert.match(l.oQueFazer, /AVISAR O ALUNO/);
  // A regressão exata do recado 6: esta frase não pode voltar.
  assert.doesNotMatch(l.oQueFazer, /Nada a fazer/);
  assert.doesNotMatch(l.situacaoMotivo, /^Entregue\.$/);
});

test("a etapa de um pedido pronto não afirma entrega — ela diz só o que o banco sabe", () => {
  const l = montarLinha(pedido(), AGORA, undefined, null);
  assert.equal(l.etapa, "Clone gerado");
  assert.notEqual(l.etapa, "Entregue", "era o painel.ts:59 que o recado 6 cita");
});

test("pronto sem aviso CONTINUA pedindo ação: não pode sumir no fim da fila", () => {
  const semAviso = montarLinha(pedido({ id: "sem" }), AGORA, undefined, null);
  const comAviso = montarLinha(
    pedido({ id: "com" }),
    AGORA,
    undefined,
    avisoEm(AGORA - 9 * D),
  );
  const [primeiro] = ordenar([comAviso, semAviso]);
  assert.equal(primeiro.id, "sem", "quem não foi avisado vem antes de quem já foi");
});

/* ===========================================================================
 * 2) COM CARIMBO → ENTREGUE, e o "parado há" CONGELA
 * ========================================================================= */

test("com carimbo vira ENTREGUE e o 'parado há' PARA de contar", () => {
  const p = pedido({ atualizado_em: new Date(AGORA - 10 * D).toISOString() });
  const aviso = avisoEm(AGORA - 8 * D); // avisado 2 dias depois da última mexida

  const l = montarLinha(p, AGORA, undefined, aviso);

  assert.equal(l.situacao, "entregue");
  assert.equal(l.situacaoRotulo, "ENTREGUE");
  assert.equal(l.avisado, true);
  assert.equal(l.relogioParado, true);
  // Congelou em 2 dias (o tempo que ficou parado ATÉ o aviso), e não nos 10 que
  // teriam passado se o relógio seguisse correndo até agora.
  assert.equal(l.paradoTexto, "2 dias");
  assert.match(l.oQueFazer, /Nada a fazer/);
  assert.match(l.oQueFazer, /avisado há/);
});

test("o relógio congelado NÃO envelhece: um dia depois, o mesmo número", () => {
  const p = pedido({ atualizado_em: new Date(AGORA - 10 * D).toISOString() });
  const aviso = avisoEm(AGORA - 8 * D);

  const hoje = montarLinha(p, AGORA, undefined, aviso);
  const amanha = montarLinha(p, AGORA + 1 * D, undefined, aviso);

  assert.equal(hoje.paradoMs, amanha.paradoMs, "entregue não envelhece — requisito 3");
  // E o contraste: sem o carimbo, ele envelhece mesmo.
  const semAviso = montarLinha(p, AGORA, undefined, null);
  const semAvisoAmanha = montarLinha(p, AGORA + 1 * D, undefined, null);
  assert.ok(semAvisoAmanha.paradoMs > semAviso.paradoMs, "gerado sem aviso continua contando");
});

test("aviso ANTERIOR à última mexida do pedido não vira 'parado há' negativo", () => {
  const p = pedido({ atualizado_em: new Date(AGORA - 2 * D).toISOString() });
  const l = montarLinha(p, AGORA, undefined, avisoEm(AGORA - 5 * D));
  assert.ok(l.paradoMs >= 0);
  assert.equal(l.paradoTexto, "0min");
});

/* ===========================================================================
 * 3) O CARIMBO NÃO MENTE — as guardas de `lerAviso`
 * ========================================================================= */

test("aviso de OUTRO CICLO não conta: carimbo anterior ao envio deste material", () => {
  // O aluno refez o SGP. `onboarding_ready_email_at` é por USUÁRIO, então sem
  // esta guarda o carimbo do ciclo velho faria o novo nascer "entregue".
  const p = pedido({ enviado_em: new Date(AGORA - 2 * D).toISOString() });
  const velho = avisoEm(AGORA - 30 * D);

  assert.equal(lerAviso(p, velho, AGORA), null);
  assert.equal(situacao(p, AGORA, velho).codigo, "pronto", "volta a ser GERADO, não entregue");
});

test("data ilegível não vira entrega — dado torto nunca afirma fato sobre o aluno", () => {
  assert.equal(lerAviso(pedido(), { em: "ontem", canal: "e-mail", por: "x" }, AGORA), null);
  assert.equal(lerAviso(pedido(), null, AGORA), null);
  assert.equal(lerAviso(pedido(), undefined, AGORA), null);
});

test("sem consultar a fonte, a linha é GERADO — o estado honesto de quem não sabe", () => {
  // É o caso da rota que não conseguiu ler `profiles`: degrada, não inventa.
  const l = montarLinha(pedido(), AGORA);
  assert.equal(l.situacao, "pronto");
  assert.equal(l.avisado, false);
});

test("o carimbo de GENTE (migration 116) ganha do automático, e leva o canal junto", () => {
  const p = pedido({
    avisado_em: new Date(AGORA - 3 * D).toISOString(),
    avisado_por: "atendente@fast.com",
    avisado_canal: "WhatsApp",
  });
  const a = avisoDoPedido(p, new Date(AGORA - 9 * D).toISOString());
  assert.equal(a?.por, "atendente@fast.com");
  assert.equal(a?.canal, "WhatsApp");

  // E sem o carimbo de gente, o do sistema responde sozinho.
  const b = avisoDoPedido(pedido(), new Date(AGORA - 9 * D).toISOString());
  assert.equal(b?.canal, "e-mail");
  assert.equal(b?.por, "o sistema");
  // Sem nenhum dos dois: null, nunca um objeto vazio que pareceria aviso.
  assert.equal(avisoDoPedido(pedido(), null), null);
});

/* ===========================================================================
 * 4) COMPRADOR SEM PEDIDO → "Não iniciou" na FILA DE TRABALHO
 * ========================================================================= */

test("quem comprou e nunca abriu o portal aparece na fila como 'Não iniciou'", () => {
  const compradores = montarCompradores({
    compras: [
      {
        email: "novata@x.com",
        nome: "Maria Novata",
        telefone: "5561999997777",
        recebidoEm: new Date(AGORA - 9 * D).toISOString(),
      },
    ],
    pedidos: [],
    agora: AGORA,
  });

  const fila = filaComNaoIniciados([], compradores);
  assert.equal(fila.length, 1);

  const [l] = fila;
  assert.equal(l.naoIniciou, true);
  assert.equal(l.etapa, "Não iniciou");
  assert.equal(l.status, "nao_iniciou");
  assert.equal(l.nome, "Maria Novata");
  // O relógio conta desde a COMPRA (ela nunca mexeu em nada), e passou de 48h.
  assert.equal(l.paradoTexto, "9 dias");
  assert.equal(l.parado, true);
  assert.equal(l.precisaAcao, true);
  assert.match(l.oQueFazer, /NUNCA abriu o portal/);
  // Sem pedido não há id de pedido: o id tem que ser impossível de confundir.
  assert.ok(l.id.startsWith("sem-pedido:"), `id inesperado: ${l.id}`);
});

test("quem JÁ começou não é duplicado como 'Não iniciou'", () => {
  // A mesma pessoa tem compra E pedido: a união tem que dar UMA linha.
  const compradores = montarCompradores({
    compras: [
      {
        email: "f@x.com",
        nome: "Fulano",
        telefone: null,
        recebidoEm: new Date(AGORA - 20 * D).toISOString(),
      },
    ],
    pedidos: [pedido({ status: "foto" })],
    agora: AGORA,
  });

  const daFila = montarLinha(pedido({ status: "foto" }), AGORA);
  const fila = filaComNaoIniciados([daFila], compradores);

  assert.equal(fila.length, 1, "não pode aparecer duas vezes na mesma tela");
  assert.equal(fila[0].naoIniciou, false);
});

test("'Não iniciou' entra nos contadores do topo sem sujar os outros buckets", () => {
  const compradores = montarCompradores({
    compras: [
      { email: "a@x.com", nome: "A", telefone: null, recebidoEm: new Date(AGORA - 9 * D).toISOString() },
      { email: "b@x.com", nome: "B", telefone: null, recebidoEm: new Date(AGORA - 3 * D).toISOString() },
    ],
    pedidos: [],
    agora: AGORA,
  });

  const r = resumir(filaComNaoIniciados([montarLinha(pedido(), AGORA, undefined, null)], compradores));
  assert.equal(r.naoIniciaram, 2);
  assert.equal(r.total, 3);
  assert.equal(r.geradosSemAviso, 1, "o contador que o recado 6 veio criar");
  assert.ok(
    r.porEtapa.some((e) => e.status === "nao_iniciou" && e.n === 2),
    "a etapa nova aparece na régua de etapas",
  );
});

test("comprador sem pedido NÃO afirma entrega nem oferece botão de pedido", () => {
  const [c] = montarCompradores({
    compras: [
      { email: "z@x.com", nome: "Z", telefone: null, recebidoEm: new Date(AGORA - 9 * D).toISOString() },
    ],
    pedidos: [],
    agora: AGORA,
  }) as LinhaComprador[];

  assert.equal(c.entregue, false);
  assert.equal(c.geradoSemAviso, false);
  const [l] = filaComNaoIniciados([], [c]);
  assert.equal(l.avisado, false);
  assert.equal(l.concluido, false);
  assert.equal(l.cobradoTexto, null);
});

/* ===========================================================================
 * 5) AS DUAS ABAS NÃO PODEM DISCORDAR
 * ========================================================================= */

test("as duas abas concordam: a mesma pessoa é ENTREGUE nas duas, ou GERADO nas duas", () => {
  const p = pedido();
  const aviso = avisoEm(AGORA - 9 * D);

  const daFila = montarLinha(p, AGORA, undefined, aviso);
  const [daPlanilha] = montarCompradores({
    compras: [{ email: "f@x.com", nome: "Fulano", telefone: null, recebidoEm: new Date(AGORA - 20 * D).toISOString() }],
    pedidos: [p],
    agora: AGORA,
    avisos: new Map([[p.id, aviso]]),
  });
  assert.equal(daFila.situacao, "entregue");
  assert.equal(daPlanilha.situacao, "entregue");
  assert.equal(daPlanilha.entregue, true);

  // E sem o carimbo, as duas dizem GERADO — nunca uma cada.
  const filaSem = montarLinha(p, AGORA, undefined, null);
  const [planilhaSem] = montarCompradores({
    compras: [{ email: "f@x.com", nome: "Fulano", telefone: null, recebidoEm: new Date(AGORA - 20 * D).toISOString() }],
    pedidos: [p],
    agora: AGORA,
  });
  assert.equal(filaSem.situacao, "pronto");
  assert.equal(planilhaSem.situacao, "pronto");
  assert.equal(planilhaSem.entregue, false);
  assert.equal(planilhaSem.geradoSemAviso, true);
});

/* ===========================================================================
 * 6) OS 7 DIAS — a régua existe, testada, e NÃO está ligada em lugar nenhum
 * ========================================================================= */

test("7 dias após ENTREGUE sem reclamação: conclui", () => {
  const aviso = lerAviso(pedido(), avisoEm(AGORA - 8 * D), AGORA);
  assert.ok(aviso, "o fixture tem que produzir um aviso válido");
  const v = conclusaoAutomatica(pedido(), aviso, AGORA);
  assert.equal(v.conclui, true);
  assert.match(v.motivo, new RegExp(`${SGP_CONCLUSAO_AUTOMATICA_DIAS} dias`));
});

test("antes dos 7 dias NÃO conclui, e diz quanto falta", () => {
  const aviso = lerAviso(pedido(), avisoEm(AGORA - 3 * D), AGORA);
  const v = conclusaoAutomatica(pedido(), aviso, AGORA);
  assert.equal(v.conclui, false);
  assert.match(v.motivo, /fecha sozinho em 4 dias/);
});

test("com RECLAMAÇÃO no meio NÃO conclui, mesmo passados os 7 dias", () => {
  // 9 dias: DEPOIS do `enviado_em` do fixture (11 dias) — senão `lerAviso` o
  // descarta como aviso de outro ciclo, que é justamente a guarda que existe.
  const aviso = lerAviso(pedido(), avisoEm(AGORA - 9 * D), AGORA);
  assert.ok(aviso, "o fixture tem que produzir um aviso válido");

  // (a) o time marcou erro na mão
  const marcado = conclusaoAutomatica(
    pedido({ erro_manual_em: new Date(AGORA - 2 * D).toISOString() }),
    aviso,
    AGORA,
  );
  assert.equal(marcado.conclui, false);
  assert.match(marcado.motivo, /marcou um erro/);

  // (b) o sistema carimbou falha (inclusive parcial, com o pedido ainda pronto)
  const comErro = conclusaoAutomatica(pedido({ erro: "voz falhou" }), aviso, AGORA);
  assert.equal(comErro.conclui, false);
  assert.match(comErro.motivo, /voz falhou/);

  // (c) o pedido saiu de pronto
  const falhou = conclusaoAutomatica(pedido({ status: "falhou" }), aviso, AGORA);
  assert.equal(falhou.conclui, false);
});

test("sem aviso o prazo dos 7 dias NEM COMEÇA — nunca arquiva quem não foi avisado", () => {
  // O pedido está pronto há 20 dias. Sem o corte, "7 dias depois de pronto"
  // fecharia sozinho o caso de alguém que nunca soube que o clone existe.
  const v = conclusaoAutomatica(
    pedido({ atualizado_em: new Date(AGORA - 20 * D).toISOString() }),
    null,
    AGORA,
  );
  assert.equal(v.conclui, false);
  assert.match(v.motivo, /O prazo nem começou/);
});

test("quem já foi concluído por gente não é reconcluído pela régua automática", () => {
  // 9 dias: DEPOIS do `enviado_em` do fixture (11 dias) — senão `lerAviso` o
  // descarta como aviso de outro ciclo, que é justamente a guarda que existe.
  const aviso = lerAviso(pedido(), avisoEm(AGORA - 9 * D), AGORA);
  assert.ok(aviso, "o fixture tem que produzir um aviso válido");
  const v = conclusaoAutomatica(
    pedido({ concluido_em: new Date(AGORA - 1 * D).toISOString() }),
    aviso,
    AGORA,
  );
  assert.equal(v.conclui, false);
  assert.match(v.motivo, /já foi concluído/);
});

/* ===========================================================================
 * 7) CONCLUIR NÃO PODE VIRAR TAMPA EM CIMA DE QUEM NÃO FOI AVISADO
 * ========================================================================= */

test("atendimento concluído num pedido GERADO sem aviso ainda diz que ninguém avisou", () => {
  const l = montarLinha(
    pedido({
      concluido_em: new Date(AGORA - 1 * D).toISOString(),
      concluido_por: "atendente@fast.com",
    }),
    AGORA,
    undefined,
    null,
  );
  assert.equal(l.situacao, "concluido");
  assert.equal(l.situacaoPorBaixo, "pronto", "o estado real continua embaixo");
  assert.match(l.oQueFazer, /não há registro de que o aluno tenha/);
});

test("o contador de auditoria conta concluído-sem-entrega usando o corte novo", () => {
  const concluidoSemAviso = montarLinha(
    pedido({ id: "a", concluido_em: new Date(AGORA - 1 * D).toISOString() }),
    AGORA,
    undefined,
    null,
  );
  const concluidoEntregue = montarLinha(
    pedido({ id: "b", concluido_em: new Date(AGORA - 1 * D).toISOString() }),
    AGORA,
    undefined,
    avisoEm(AGORA - 9 * D),
  );
  const r = resumir([concluidoSemAviso, concluidoEntregue]);
  assert.equal(r.concluidos, 2);
  assert.equal(r.concluidosComPendencia, 1, "só o que não foi avisado conta como pendência");
});
