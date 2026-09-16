/**
 * Régua do painel do SGP (/admin/sgp).
 *
 * O que estes testes protegem, na ordem de importância pro time de suporte:
 *  1. quem está parado há +48h aparece marcado e NO TOPO;
 *  2. a frase de "o que fazer" não vaza jargão (o time não lê código);
 *  3. quem está entregue não sobe na frente de quem precisa de ação.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/painel.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ETAPA_HUMANA,
  lerCobranca,
  lerConclusao,
  lerErroManual,
  montarLinha,
  ordenar,
  resumir,
  situacao,
  situacaoDoPedido,
  tempoHumano,
  SGP_PARADO_HORAS,
  SGP_COBRANCA_SILENCIO_HORAS,
} from "./painel.ts";
import {
  colunaCobrancaAusente,
  colunaConclusaoAusente,
  colunaErroManualAusente,
  criarFilaComFallback,
} from "./cobranca.ts";
import type { SgpPedidoRow, SgpStatus } from "./types.ts";

const H = 60 * 60 * 1000;
const AGORA = new Date("2026-09-02T12:00:00Z").getTime();

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
    user_id: null,
    criado_em: new Date(AGORA - 10 * H).toISOString(),
    atualizado_em: new Date(AGORA - 1 * H).toISOString(),
    status: "foto",
    ciencia_foto: null,
    ciencia_foto_at: null,
    ciencia_audio: null,
    ciencia_audio_at: null,
    aceite_lgpd_at: null,
    fotos: [],
    audios: [],
    enviado_em: null,
    foto_pronta_em: null,
    voz_pronta_em: null,
    voice_id: null,
    erro: null,
    ...over,
  };
}

test("tempoHumano fala como gente, não em ISO", () => {
  assert.equal(tempoHumano(40 * 60_000), "40min");
  assert.equal(tempoHumano(5 * H), "5h");
  assert.equal(tempoHumano(24 * H), "1 dia");
  assert.equal(tempoHumano(55 * H), "2 dias e 7h");
  assert.equal(tempoHumano(-5), "0min"); // relógio torto não vira número negativo na tela
});

test("parado no wizard há +48h é marcado e manda cobrar o aluno", () => {
  const l = montarLinha(
    pedido({ status: "foto", atualizado_em: new Date(AGORA - 55 * H).toISOString() }),
    AGORA,
  );
  assert.equal(l.parado, true);
  assert.equal(l.precisaAcao, true);
  assert.equal(l.etapa, "Enviando as fotos");
  assert.equal(l.paradoTexto, "2 dias e 7h");
  assert.match(l.oQueFazer, /Cobrar o aluno/);
  assert.match(l.oQueFazer, /fotos/);
});

test("dentro das 48h no wizard não vira ação — não se cobra quem acabou de entrar", () => {
  const l = montarLinha(
    pedido({ status: "audio", atualizado_em: new Date(AGORA - 3 * H).toISOString() }),
    AGORA,
  );
  assert.equal(l.parado, false);
  assert.equal(l.precisaAcao, false);
  assert.match(l.oQueFazer, /Aguardar/);
  assert.match(l.oQueFazer, new RegExp(`${SGP_PARADO_HORAS}h`));
});

test("entregue há muito tempo NÃO é 'parado' — a régua só vale pro wizard", () => {
  // ⚠️ 15/09 (recado 6): "entregue" deixou de sair de `status = 'pronto'` e passou
  // a exigir o carimbo de aviso ao aluno. Este teste ganhou o carimbo; o caso SEM
  // carimbo virou o teste logo abaixo, com o resultado oposto — que é o conserto.
  const l = montarLinha(
    pedido({
      status: "pronto",
      atualizado_em: new Date(AGORA - 30 * 24 * H).toISOString(),
      enviado_em: new Date(AGORA - 30 * 24 * H).toISOString(),
      foto_pronta_em: new Date(AGORA - 30 * 24 * H).toISOString(),
      voz_pronta_em: new Date(AGORA - 30 * 24 * H).toISOString(),
    }),
    AGORA,
    undefined,
    // `fonte: "time"` desde 16/09: só o carimbo de GENTE afirma entrega.
    {
      em: new Date(AGORA - 29 * 24 * H).toISOString(),
      canal: "WhatsApp",
      por: "atendente@fast.com",
      fonte: "time",
    },
  );
  assert.equal(l.parado, false);
  assert.equal(l.precisaAcao, false);
  assert.equal(l.situacao, "entregue");
  assert.match(l.oQueFazer, /^Nada a fazer\./);
  assert.equal(l.foto, "ok");
  assert.equal(l.voz, "ok");
});

test("pronto SEM carimbo de aviso NÃO diz 'nada a fazer' — a regressão do recado 6", () => {
  const l = montarLinha(
    pedido({
      status: "pronto",
      atualizado_em: new Date(AGORA - 30 * 24 * H).toISOString(),
      enviado_em: new Date(AGORA - 30 * 24 * H).toISOString(),
    }),
    AGORA,
  );
  assert.equal(l.situacao, "pronto");
  assert.equal(l.situacaoRotulo, "GERADO");
  assert.match(l.oQueFazer, /AVISAR O ALUNO/);
  assert.doesNotMatch(l.oQueFazer, /Nada a fazer/);
});

test("falhou vira ação sem prometer prazo (regra do Johnny/Lucas)", () => {
  const l = montarLinha(pedido({ status: "falhou", erro: "timeout no treino" }), AGORA);
  assert.equal(l.precisaAcao, true);
  assert.match(l.oQueFazer, /NÃO prometa prazo/);
  assert.equal(l.erro, "timeout no treino");
});

test("processando/enviado travado há dias deixa de ser 'nada a fazer'", () => {
  const ok = montarLinha(
    pedido({
      status: "processando",
      enviado_em: new Date(AGORA - 2 * H).toISOString(),
      atualizado_em: new Date(AGORA - 2 * H).toISOString(),
    }),
    AGORA,
  );
  assert.match(ok.oQueFazer, /Nada a fazer/);
  assert.equal(ok.foto, "gerando");

  const travado = montarLinha(
    pedido({
      status: "processando",
      enviado_em: new Date(AGORA - 60 * H).toISOString(),
      atualizado_em: new Date(AGORA - 60 * H).toISOString(),
    }),
    AGORA,
  );
  assert.match(travado.oQueFazer, /Avise o time técnico/);
});

test("antes do envio, Foto/Voz mostram o que falta, não um '-' mudo", () => {
  const l = montarLinha(
    pedido({ fotos: [{ key: "a", status: "aprovada" }], audios: [] }),
    AGORA,
  );
  assert.equal(l.foto, "1 de 4");
  assert.equal(l.voz, "nenhum");
});

test("nenhuma frase de ação vaza jargão técnico pro atendente", () => {
  const jargao = /\.tsx|\.ts\b|\.cjs|PR ?#|sgp_pedidos|status ?=|user_id|null|undefined|API|endpoint/i;
  const todos: SgpStatus[] = [
    "dados",
    "foto",
    "audio",
    "revisao",
    "enviado",
    "processando",
    "pronto",
    "falhou",
  ];
  for (const status of todos) {
    for (const idadeH of [1, 100]) {
      const l = montarLinha(
        pedido({ status, atualizado_em: new Date(AGORA - idadeH * H).toISOString() }),
        AGORA,
      );
      assert.equal(jargao.test(l.oQueFazer), false, `jargão em ${status}/${idadeH}h: ${l.oQueFazer}`);
      assert.equal(jargao.test(l.etapa), false, `jargão na etapa ${status}`);
      assert.notEqual(l.etapa, status, `etapa de ${status} não foi traduzida`);
    }
  }
});

test("todo status possível tem tradução — status novo não pode vazar cru na tela", () => {
  const todos: SgpStatus[] = [
    "dados",
    "foto",
    "audio",
    "revisao",
    "enviado",
    "processando",
    "pronto",
    "falhou",
  ];
  for (const s of todos) assert.equal(typeof ETAPA_HUMANA[s], "string");
});

test("ordem: quem precisa de ação vem antes de quem só está velho", () => {
  const entregueVelho = montarLinha(
    pedido({
      id: "entregue",
      status: "pronto",
      atualizado_em: new Date(AGORA - 30 * 24 * H).toISOString(),
    }),
    AGORA,
  );
  const paradoRecente = montarLinha(
    pedido({ id: "parado-49h", status: "foto", atualizado_em: new Date(AGORA - 49 * H).toISOString() }),
    AGORA,
  );
  const paradoAntigo = montarLinha(
    pedido({ id: "parado-5d", status: "dados", atualizado_em: new Date(AGORA - 5 * 24 * H).toISOString() }),
    AGORA,
  );
  const ordem = ordenar([entregueVelho, paradoRecente, paradoAntigo]).map((l) => l.id);
  assert.deepEqual(ordem, ["parado-5d", "parado-49h", "entregue"]);
});

test("contadores batem por etapa e contam só os parados de verdade", () => {
  const linhas = [
    montarLinha(pedido({ id: "1", status: "foto", atualizado_em: new Date(AGORA - 55 * H).toISOString() }), AGORA),
    montarLinha(pedido({ id: "2", status: "foto", atualizado_em: new Date(AGORA - 2 * H).toISOString() }), AGORA),
    montarLinha(pedido({ id: "3", status: "pronto", atualizado_em: new Date(AGORA - 99 * H).toISOString() }), AGORA),
  ];
  const r = resumir(linhas);
  assert.equal(r.total, 3);
  assert.equal(r.parados, 1); // o "pronto" velho NÃO conta
  assert.deepEqual(
    r.porEtapa.map((e) => [e.status, e.n]),
    [
      ["foto", 2],
      ["pronto", 1],
    ],
  );
});

test("linha sem nome/whatsapp não quebra a tela", () => {
  const l = montarLinha(pedido({ nome: null, email: null, whatsapp: null }), AGORA);
  assert.equal(l.nome, "(sem nome)");
  assert.equal(l.email, "—");
  assert.equal(l.whatsapp, "—");
});

// ---------------------------------------------------------------------------
// "Já cobrei" (pedido do Lucas, 04/09)
//
// A regra que estes testes existem pra proteger, e que é o ponto do pedido:
// clicar NÃO resolve o caso. Silencia o alerta por um tempo e devolve o alerta
// depois. Se algum destes testes começar a falhar afirmando que a linha sumiu,
// alguém transformou o botão num "arquivar" — que é exatamente o que o Lucas
// proibiu, porque a aluna continua parada e pagou.
// ---------------------------------------------------------------------------

const S = SGP_COBRANCA_SILENCIO_HORAS;

/** Parada há 4 dias, como a Wallana. `cobradoHaH` = horas desde o clique. */
function paradoCobrado(cobradoHaH: number | null, paradoH = 4 * 24) {
  return pedido({
    status: "foto",
    atualizado_em: new Date(AGORA - paradoH * H).toISOString(),
    cobrado_em: cobradoHaH === null ? null : new Date(AGORA - cobradoHaH * H).toISOString(),
    cobrado_por: cobradoHaH === null ? null : "suporte@time.com",
    fotos: [{ key: "a", status: "aprovada" }],
  });
}

test("cobrança recente tira o vermelho e o contador — mas a linha CONTINUA na tabela", () => {
  const l = montarLinha(paradoCobrado(3), AGORA);
  assert.equal(l.parado, false, "sai do alerta");
  assert.equal(l.precisaAcao, false, "sai da contagem/topo");
  assert.equal(l.silenciado, true);

  // O problema não sumiu junto com o alerta: o relógio real segue à vista.
  assert.equal(l.paradoTexto, "4 dias");
  assert.equal(l.foto, "1 de 4");
  assert.match(l.cobradoTexto ?? "", /cobrado há 3h por suporte@time\.com/);
  assert.match(l.voltaAAvisarTexto ?? "", /volta a avisar em 1 dia e 21h/); // 48h - 3h

  // A linha existe no resumo, contada à parte — não é "resolvido".
  const r = resumir([l]);
  assert.equal(r.total, 1);
  assert.equal(r.parados, 0);
  assert.equal(r.cobrados, 1);
});

test("passada a janela, volta a alertar sozinho — um clique não cala pra sempre", () => {
  const dentro = montarLinha(paradoCobrado(S - 1), AGORA);
  assert.equal(dentro.parado, false);

  const vencido = montarLinha(paradoCobrado(S + 1), AGORA);
  assert.equal(vencido.parado, true, "voltou ao vermelho");
  assert.equal(vencido.precisaAcao, true);
  assert.equal(vencido.silenciado, false);
  assert.equal(vencido.voltaAAvisarTexto, null);
  // E avisa que já teve uma tentativa, pra não repetir a mesma cobrança.
  assert.match(vencido.oQueFazer, /DE NOVO/);
  assert.match(vencido.oQueFazer, /suporte@time\.com/);
  assert.equal(resumir([vencido]).parados, 1);
});

test("a fronteira exata da janela ainda está silenciada (<=, não <)", () => {
  assert.equal(montarLinha(paradoCobrado(S), AGORA).parado, false);
});

test("janela configurável: 6h silencia menos que as 48h padrão", () => {
  const seisHoras = 6 * H;
  assert.equal(montarLinha(paradoCobrado(3), AGORA, seisHoras).parado, false);
  assert.equal(montarLinha(paradoCobrado(7), AGORA, seisHoras).parado, true);
  // …e com o padrão o mesmo caso de 7h continuaria calado.
  assert.equal(montarLinha(paradoCobrado(7), AGORA).parado, false);
});

test("se o ALUNO mexer, a marca vira irrelevante sozinha (requisito 4)", () => {
  // Cobrado há 10h, mas o aluno mandou foto há 2h: atualizado_em passou o
  // cobrado_em. A marca não vale mais — e nem precisaria valer, porque mexer
  // já zera o "parado há".
  const l = montarLinha(
    pedido({
      status: "foto",
      atualizado_em: new Date(AGORA - 2 * H).toISOString(),
      cobrado_em: new Date(AGORA - 10 * H).toISOString(),
      cobrado_por: "suporte@time.com",
    }),
    AGORA,
  );
  assert.equal(l.cobradoTexto, null, "marca velha não fica pendurada na tela");
  assert.equal(l.silenciado, false);
  assert.equal(l.parado, false);
  assert.equal(lerCobranca(l as never, AGORA), null);
});

test("aluno que voltou a travar DEPOIS da cobrança é cobrável de novo", () => {
  // Cobraram há 5 dias; o aluno mexeu há 3 dias e travou de novo desde então.
  const l = montarLinha(
    pedido({
      status: "audio",
      atualizado_em: new Date(AGORA - 3 * 24 * H).toISOString(),
      cobrado_em: new Date(AGORA - 5 * 24 * H).toISOString(),
      cobrado_por: "suporte@time.com",
    }),
    AGORA,
  );
  assert.equal(l.parado, true, "a cobrança velha não pode calar o travamento novo");
  assert.match(l.oQueFazer, /Cobrar o aluno:/);
  assert.doesNotMatch(l.oQueFazer, /DE NOVO/);
});

test("cobrança não interfere em quem não está parado nem em quem falhou", () => {
  const recente = montarLinha(paradoCobrado(1, 3), AGORA); // parado só 3h
  assert.equal(recente.parado, false);
  assert.equal(recente.silenciado, false, "não estava travado, não há o que silenciar");

  const falhou = montarLinha(
    pedido({ status: "falhou", erro: "x", cobrado_em: new Date(AGORA - 1 * H).toISOString() }),
    AGORA,
  );
  assert.equal(falhou.precisaAcao, true, "erro do sistema não se cala com cobrança");
});

test("dado torto de cobrança nunca cala um alerta", () => {
  for (const ruim of ["", "nao-e-data", "0000-13-45"]) {
    const l = montarLinha(paradoCobrado(null), AGORA);
    const sujo = montarLinha({ ...paradoCobrado(null), cobrado_em: ruim }, AGORA);
    assert.equal(l.parado, true);
    assert.equal(sujo.parado, true, `"${ruim}" silenciou o alerta`);
    assert.equal(sujo.cobradoTexto, null);
  }
});

test("relógio adiantado do banco não vira tempo negativo na tela", () => {
  const futuro = montarLinha(paradoCobrado(-2), AGORA); // cobrado_em 2h no futuro
  assert.equal(futuro.silenciado, true);
  assert.match(futuro.cobradoTexto ?? "", /cobrado há 0min/);
});

test("cobrado sem autor identificado não escreve 'null' na cara do atendente", () => {
  const l = montarLinha(
    { ...paradoCobrado(3), cobrado_por: null },
    AGORA,
  );
  assert.match(l.cobradoTexto ?? "", /por alguém do time/);
  assert.doesNotMatch(l.cobradoTexto ?? "", /null/);
});

test("pedido SEM as colunas da migration 106 se comporta como 'nunca cobrado'", () => {
  // É literalmente o que a rota devolve enquanto a 106 não é aplicada.
  const semColunas = { ...paradoCobrado(null) } as Partial<SgpPedidoRow>;
  delete semColunas.cobrado_em;
  delete semColunas.cobrado_por;
  const l = montarLinha(semColunas as SgpPedidoRow, AGORA);
  assert.equal(l.parado, true, "a tela tem que continuar alertando sem a migration");
  assert.equal(l.cobradoTexto, null);
  assert.equal(l.silenciado, false);
});

test("nenhuma frase de cobrança vaza jargão pro atendente", () => {
  const jargao = /\.tsx|\.ts\b|\.cjs|PR ?#|sgp_pedidos|status ?=|user_id|cobrado_em|null|undefined|migration|endpoint/i;
  for (const h of [1, S - 1, S, S + 1, 200]) {
    const l = montarLinha(paradoCobrado(h), AGORA);
    assert.equal(jargao.test(l.oQueFazer), false, `jargão com cobrança de ${h}h: ${l.oQueFazer}`);
    assert.equal(jargao.test(l.cobradoTexto ?? ""), false, `jargão no selo: ${l.cobradoTexto}`);
  }
});

test("ordem: quem já foi cobrado desce, mas fica acima de quem não precisa de nada", () => {
  const naoCobrado = montarLinha(paradoCobrado(null, 50), AGORA);
  const cobrado = montarLinha({ ...paradoCobrado(3, 5 * 24), id: "cobrado" }, AGORA);
  const entregue = montarLinha(
    pedido({ id: "entregue", status: "pronto", atualizado_em: new Date(AGORA - 30 * 24 * H).toISOString() }),
    AGORA,
  );
  const ordem = ordenar([entregue, cobrado, naoCobrado]).map((l) => l.id);
  assert.deepEqual(ordem, ["id-1", "cobrado", "entregue"]);
});

// --- SITUAÇÃO: PRONTO / AGUARDANDO / ERRO (pedido do Lucas, 10/09) -----------

test("os três rótulos saem dos campos que já existem, sem coluna nova", () => {
  // AGUARDANDO cobre o wizard inteiro E o processamento nosso: o time lê três
  // buckets, não oito etapas.
  for (const s of ["dados", "foto", "audio", "revisao", "enviado", "processando"] as SgpStatus[]) {
    assert.equal(situacao(pedido({ status: s }), AGORA).codigo, "aguardando", s);
  }
  assert.equal(situacao(pedido({ status: "pronto" }), AGORA).codigo, "pronto");
  assert.equal(situacao(pedido({ status: "falhou" }), AGORA).codigo, "erro");
});

test("o rótulo é caixa alta e o motivo explica sem jargão", () => {
  const s = situacao(pedido({ status: "foto" }), AGORA);
  assert.equal(s.rotulo, "AGUARDANDO");
  assert.equal(s.motivo, "Esperando o aluno mandar as fotos.");
  // Nada de nome de coluna nem de enum cru na cara do atendente.
  for (const proibido of ["status", "sgp_pedidos", "null", "erro_manual"]) {
    assert.ok(!s.motivo.includes(proibido), `vazou jargão: ${proibido}`);
  }
});

test("falha PARCIAL é ERRO mesmo com o status ainda andando", () => {
  // É o caso que processar.ts grava: o clone de foto morreu, a voz seguiu, e o
  // pedido continua em 'processando'. Sem esta regra ele aparece como
  // AGUARDANDO e ninguém olha.
  const s = situacao(pedido({ status: "processando", erro: "clone de foto: timeout" }), AGORA);
  assert.equal(s.codigo, "erro");
  assert.match(s.motivo, /clone de foto: timeout/);
});

test("ERRO ganha de PRONTO — é o caso 'material veio errado' do pedido", () => {
  const entregue = pedido({ status: "pronto" });
  assert.equal(situacao(entregue, AGORA).codigo, "pronto");

  const marcado = pedido({
    status: "pronto",
    erro_manual_em: new Date(AGORA - 2 * H).toISOString(),
    erro_manual_por: "suporte@x.com",
    erro_manual_motivo: "aluno disse que a voz não é dele",
  });
  const s = situacao(marcado, AGORA);
  assert.equal(s.codigo, "erro", "se PRONTO ganhasse, marcar erro aqui não mudaria nada na tela");
  assert.match(s.motivo, /aluno disse que a voz não é dele/);
  assert.match(s.motivo, /suporte@x\.com/, "quem marcou fica à vista");
});

test("marca de erro NÃO vence e NÃO se invalida quando o aluno mexe", () => {
  // Diferença deliberada pro 'já cobrei': lá o aluno mexer invalida a marca.
  const p = pedido({
    status: "foto",
    erro_manual_em: new Date(AGORA - 40 * 24 * H).toISOString(),
    erro_manual_por: "suporte@x.com",
    atualizado_em: new Date(AGORA - 1 * H).toISOString(), // mexeu DEPOIS de marcar
  });
  assert.equal(situacao(p, AGORA).codigo, "erro", "afirmação de defeito não expira sozinha");
  assert.equal(lerErroManual(p, AGORA)?.por, "suporte@x.com");
});

test("marca sem motivo escrito continua valendo, e sem 'null' na tela", () => {
  const p = pedido({
    status: "audio",
    erro_manual_em: new Date(AGORA - 3 * H).toISOString(),
    erro_manual_por: "  ",
    erro_manual_motivo: "   ",
  });
  const l = montarLinha(p, AGORA);
  assert.equal(l.situacao, "erro");
  assert.equal(l.erroManualMotivo, null);
  assert.equal(l.erroManualTexto, "marcado há 3h por alguém do time");
});

test("linha em ERRO sobe pro topo, como já subia a que falhou", () => {
  const erroMarcado = montarLinha(
    pedido({
      id: "marcado",
      status: "pronto",
      atualizado_em: new Date(AGORA - 20 * 24 * H).toISOString(),
      erro_manual_em: new Date(AGORA - 1 * H).toISOString(),
      erro_manual_por: "suporte@x.com",
    }),
    AGORA,
  );
  const tranquilo = montarLinha(
    pedido({ id: "tranquilo", status: "foto", atualizado_em: new Date(AGORA - 1 * H).toISOString() }),
    AGORA,
  );
  assert.equal(erroMarcado.precisaAcao, true);
  assert.deepEqual(ordenar([tranquilo, erroMarcado]).map((l) => l.id), ["marcado", "tranquilo"]);
});

test("sem a migration 109 a linha não vira ERRO por acidente", () => {
  // Campos ausentes (não `null`): é exatamente o que a rota devolve hoje.
  const l = montarLinha(pedido({ status: "foto" }), AGORA);
  assert.equal(l.situacao, "aguardando");
  assert.equal(l.erroManualTexto, null);
});

test("o resumo conta os três buckets e eles fecham com o total", () => {
  const linhas = [
    montarLinha(pedido({ id: "a", status: "pronto" }), AGORA),
    montarLinha(pedido({ id: "b", status: "foto" }), AGORA),
    montarLinha(pedido({ id: "c", status: "processando" }), AGORA),
    montarLinha(pedido({ id: "d", status: "falhou", erro: "x" }), AGORA),
  ];
  const r = resumir(linhas);
  // `pronto: 1` = o pedido gerado SEM carimbo de aviso (montado sem `aviso`).
  // ENTREGUE é bucket próprio desde 15/09 e aqui fica vazio de propósito.
  assert.deepEqual(r.situacoes, {
    concluido: 0,
    entregue: 0,
    aviso_nao_confirmado: 0,
    pronto: 1,
    aguardando: 2,
    erro: 1,
  });
  assert.equal(
    r.situacoes.concluido +
      r.situacoes.entregue +
      r.situacoes.pronto +
      r.situacoes.aguardando +
      r.situacoes.erro,
    r.total,
  );
  assert.equal(r.geradosSemAviso, 1);
});

// --- degradação sem a migration (lib/sgp/cobranca.ts) ------------------------

test("erro de coluna ausente é reconhecido — e erro de verdade NÃO é engolido", () => {
  assert.equal(colunaCobrancaAusente({ code: "42703", message: "whatever" }), true);
  assert.equal(
    colunaCobrancaAusente({ message: 'column sgp_pedidos.cobrado_em does not exist' }),
    true,
  );
  // Um "does not exist" de OUTRA coisa é bug e tem que estourar, não degradar.
  assert.equal(colunaCobrancaAusente({ message: 'relation "outra" does not exist' }), false);
  assert.equal(colunaCobrancaAusente({ code: "23505", message: "duplicate key" }), false);
  assert.equal(colunaCobrancaAusente(null), false);
  assert.equal(colunaCobrancaAusente("boom"), false);
});

/** O erro exato que o PostgREST devolve enquanto a migration 106 não entra. */
const SEM_COLUNA_ERR = {
  code: "42703",
  message: 'column sgp_pedidos.cobrado_em does not exist',
};

/** Os dois grupos opcionais reais: migration 106 e migration 109. */
const GRUPOS = [
  { nome: "cobranca", colunas: ["cobrado_em", "cobrado_por"] },
  { nome: "erroManual", colunas: ["erro_manual_em", "erro_manual_por"] },
] as const;

test("sem a migration 106 a fila ainda responde — a tela do time não cai", async () => {
  const pedidas: string[] = [];
  const fila = criarFilaComFallback<{ id: string }>(
    async (colunas) => {
      pedidas.push(colunas);
      return colunas.includes("cobrado_em")
        ? { data: null, error: SEM_COLUNA_ERR }
        : { data: [{ id: "x" }], error: null };
    },
    ["id"],
    [GRUPOS[0]],
  );

  const r = await fila();
  assert.equal(r.error, null);
  assert.deepEqual(r.data, [{ id: "x" }]);
  assert.equal(r.disponivel.cobranca, false, "a tela some com o botão em vez de quebrar");
  assert.deepEqual(pedidas, ["id, cobrado_em, cobrado_por", "id"], "tentou, caiu, repetiu sem");

  // Aprendeu: não bate de novo na coluna que não existe.
  await fila();
  assert.deepEqual(pedidas.slice(2), ["id"]);
});

test("com a migration aplicada, pergunta uma vez só e nunca mais testa", async () => {
  const pedidas: string[] = [];
  const fila = criarFilaComFallback<{ id: string }>(
    async (colunas) => {
      pedidas.push(colunas);
      return { data: [{ id: "x" }], error: null };
    },
    ["id"],
    [{ nome: "cobranca", colunas: ["cobrado_em"] }],
  );
  assert.equal((await fila()).disponivel.cobranca, true);
  assert.equal((await fila()).disponivel.cobranca, true);
  assert.deepEqual(pedidas, ["id, cobrado_em", "id, cobrado_em"], "sem consulta extra");
});

test("erro REAL do banco vira erro, não 'recurso desligado'", async () => {
  const boom = { code: "57014", message: "statement timeout" };
  let n = 0;
  const fila = criarFilaComFallback<{ id: string }>(
    async () => {
      n++;
      return { data: null, error: boom };
    },
    ["id"],
    [{ nome: "cobranca", colunas: ["cobrado_em"] }],
  );
  const r = await fila();
  assert.equal(r.error, boom, "o 500 tem que subir");
  assert.equal(r.disponivel.cobranca, true, "não degrada o recurso por falha alheia");
  assert.equal(n, 1, "não tenta de novo à toa");
});

/**
 * O motivo de os grupos serem independentes: são DUAS migrations e quem aplica é
 * o Johnny, uma de cada vez. Se aplicar a 109 sem a 106 derrubasse o "marcar
 * erro" junto, o recurso teria nascido morto por causa de migration alheia.
 */
test("aplicar UMA das duas migrations não desliga a outra", async () => {
  const pedidas: string[] = [];
  const fila = criarFilaComFallback<{ id: string }>(
    async (colunas) => {
      pedidas.push(colunas);
      // Mundo onde a 109 entrou e a 106 não.
      return colunas.includes("cobrado_em")
        ? { data: null, error: SEM_COLUNA_ERR }
        : { data: [{ id: "x" }], error: null };
    },
    ["id"],
    [...GRUPOS],
  );

  const r = await fila();
  assert.equal(r.error, null);
  assert.equal(r.disponivel.cobranca, false, "sem a 106, sem botão de cobrança");
  assert.equal(r.disponivel.erroManual, true, "MAS o marcar erro continua de pé");
  assert.deepEqual(pedidas[1], "id, erro_manual_em, erro_manual_por");
});

test("o inverso também: sem a 109, a cobrança sobrevive", async () => {
  const fila = criarFilaComFallback<{ id: string }>(
    async (colunas) =>
      colunas.includes("erro_manual_em")
        ? { data: null, error: { code: "42703", message: "column sgp_pedidos.erro_manual_em does not exist" } }
        : { data: [{ id: "x" }], error: null },
    ["id"],
    [...GRUPOS],
  );
  const r = await fila();
  assert.equal(r.disponivel.cobranca, true);
  assert.equal(r.disponivel.erroManual, false);
});

test("42703 sem nome de coluna na mensagem derruba um grupo por vez, não todos", async () => {
  // Acontece quando o PostgREST engole o detalhe (erro de schema cache). Aqui a
  // 106 existe e a 109 não, mas a mensagem não diz de quem é a culpa.
  const fila = criarFilaComFallback<{ id: string }>(
    async (colunas) =>
      colunas.includes("erro_manual_em")
        ? { data: null, error: { code: "42703", message: "unknown column" } }
        : { data: [{ id: "x" }], error: null },
    ["id"],
    [...GRUPOS],
  );
  const r = await fila();
  assert.equal(r.error, null, "convergiu em vez de estourar");
  assert.equal(r.disponivel.erroManual, false, "derrubou o último grupo, que era o culpado");
  assert.equal(r.disponivel.cobranca, true, "e preservou o outro");
});

/** Caso REAL medido no banco em 02/09 — a aluna do chamado #206. */
test("reproduz o caso real da Wallana (travada em 'foto' desde 31/08)", () => {
  const l = montarLinha(
    pedido({
      id: "0fd2845a-addf-450e-9ff4-340a698c62a0",
      nome: "Wallana Daphiny Pereira Rodrigues",
      email: "wallanadaphiny@icloud.com",
      whatsapp: "5561993107338",
      status: "foto",
      criado_em: "2026-08-31T14:02:39.283Z",
      atualizado_em: "2026-08-31T14:07:05.103Z",
      fotos: [{ key: "a", status: "aprovada" }],
      audios: [],
    }),
    new Date("2026-09-02T18:00:00Z").getTime(),
  );
  assert.equal(l.etapa, "Enviando as fotos");
  assert.equal(l.parado, true);
  assert.equal(l.paradoTexto, "2 dias e 3h");
  assert.equal(l.foto, "1 de 4");
  assert.match(l.oQueFazer, /Cobrar o aluno.*WhatsApp.*fotos/);
});

/* ===========================================================================
 * CONCLUIR ATENDIMENTO — o quarto estado (pedido do Lucas, 14/09)
 *
 * O que estes testes protegem, na ordem de importância:
 *  1. a PRECEDÊNCIA dos quatro estados, que é a decisão do PR;
 *  2. que concluir NÃO esconde quem pagou e não recebeu;
 *  3. que concluir não destrói o relógio do "parado há";
 *  4. que a marca não cala para sempre um caso que reabriu sozinho.
 * ========================================================================= */

/** Um pedido concluído pelo time, com o relógio parado ANTES da conclusão. */
function concluido(over: Partial<SgpPedidoRow> = {}, hConcluido = 3): SgpPedidoRow {
  return pedido({
    // Concluir não mexe em `atualizado_em` (é o gatilho da migration 110 que
    // garante isso). Aqui o pedido parou há 5 dias e foi concluído há 3h.
    atualizado_em: new Date(AGORA - 5 * 24 * H).toISOString(),
    concluido_em: new Date(AGORA - hConcluido * H).toISOString(),
    concluido_por: "suporte@x.com",
    ...over,
  });
}

// --- 1) A PRECEDÊNCIA DOS QUATRO ESTADOS ------------------------------------

test("precedência: CONCLUÍDO > ERRO > PRONTO > AGUARDANDO, caso a caso", () => {
  // ⚠️ `atualizado_em` TEM que ser anterior à marca, senão a conclusão nasce
  // SUPERADA (o pedido andou depois dela) — que é o comportamento correto e o
  // que este fixture, na primeira versão, tropeçou sozinho.
  const marca = {
    atualizado_em: new Date(AGORA - 30 * H).toISOString(),
    concluido_em: new Date(AGORA - 2 * H).toISOString(),
    concluido_por: "suporte@x.com",
  };
  const erroDoTime = {
    erro_manual_em: new Date(AGORA - 9 * H).toISOString(),
    erro_manual_por: "suporte@x.com",
  };

  // Cada par é [pedido, situação esperada]. A tabela inteira num lugar só.
  const casos: Array<[SgpPedidoRow, string, string]> = [
    // ERRO ganha de PRONTO e de AGUARDANDO (régua da 109, não regride).
    [pedido({ status: "pronto", ...erroDoTime }), "erro", "erro do time vence entregue"],
    [pedido({ status: "foto", ...erroDoTime }), "erro", "erro do time vence esperando"],
    [pedido({ status: "falhou" }), "erro", "falha do sistema é erro"],
    [pedido({ status: "processando", erro: "timeout" }), "erro", "falha parcial é erro"],
    [pedido({ status: "pronto" }), "pronto", "entregue"],
    [pedido({ status: "audio" }), "aguardando", "no wizard"],
    // CONCLUÍDO ganha dos TRÊS.
    [pedido({ status: "foto", ...marca }), "concluido", "vence AGUARDANDO"],
    [pedido({ status: "pronto", ...marca }), "concluido", "vence PRONTO"],
    [pedido({ status: "falhou", ...marca }), "concluido", "vence ERRO do sistema"],
    [pedido({ status: "processando", erro: "timeout", ...marca }), "concluido", "vence falha parcial"],
    [pedido({ status: "pronto", ...erroDoTime, ...marca }), "concluido", "vence ERRO do time"],
  ];

  for (const [p, esperado, porque] of casos) {
    assert.equal(situacao(p, AGORA).codigo, esperado, porque);
  }
});

test("CONCLUÍDO vence ERRO — senão o botão não funciona no caso que o pediu", () => {
  // "Deu erro, o time tratou, acabou" é o caso mais comum de conclusão. É o
  // mesmo argumento que fez ERRO ganhar de PRONTO na migration 109.
  const quebrado = pedido({
    status: "falhou",
    erro: "clone de voz: timeout",
    atualizado_em: new Date(AGORA - 30 * H).toISOString(),
  });
  assert.equal(situacao(quebrado, AGORA).codigo, "erro");

  const tratado = { ...quebrado, ...{
    concluido_em: new Date(AGORA - 1 * H).toISOString(),
    concluido_por: "suporte@x.com",
    concluido_motivo: "aluno reembolsado na Hotmart",
  } };
  const s = situacao(tratado, AGORA);
  assert.equal(s.codigo, "concluido", "se ERRO ganhasse, concluir aqui não mudaria nada na tela");
  assert.match(s.motivo, /aluno reembolsado na Hotmart/);
  assert.match(s.motivo, /suporte@x\.com/, "quem concluiu fica à vista");
});

// --- 2) CONCLUIR NÃO PODE ESCONDER QUEM PAGOU E NÃO RECEBEU -----------------

test("o motivo do CONCLUÍDO carrega o estado REAL do pedido, nunca o apaga", () => {
  const s = situacao(concluido({ status: "foto" }), AGORA);
  assert.equal(s.codigo, "concluido");
  // A etiqueta é CONCLUÍDO, mas a frase diz o que o pedido é de verdade.
  assert.match(s.motivo, /AGUARDANDO/, "o estado por baixo fica escrito");
  assert.match(s.motivo, /mandar as fotos/, "e com o motivo dele por extenso");

  const quebrado = situacao(concluido({ status: "falhou", erro: "timeout" }), AGORA);
  assert.match(quebrado.motivo, /ERRO/);
  assert.match(quebrado.motivo, /timeout/);
});

test("situacaoPorBaixo denuncia quem foi encerrado sem ter recebido o clone", () => {
  const semEntrega = montarLinha(concluido({ status: "foto" }), AGORA);
  assert.equal(semEntrega.situacao, "concluido");
  assert.equal(semEntrega.situacaoPorBaixo, "aguardando");

  // ⚠️ 15/09 (recado 6): "recebeu" passou a exigir o carimbo de aviso. Sem ele,
  // um concluído em cima de pedido `pronto` É pendência — o clone existe e o
  // aluno pode nunca ter sabido. Por isso o caso com entrega leva o carimbo.
  const comEntrega = montarLinha(concluido({ status: "pronto" }), AGORA, undefined, {
    em: new Date(AGORA - 1 * H).toISOString(),
    canal: "WhatsApp",
    por: "atendente@fast.com",
    // Desde 16/09 só o carimbo de GENTE tira o caso de pendência.
    fonte: "time",
  });
  assert.equal(comEntrega.situacao, "concluido");
  assert.equal(comEntrega.situacaoPorBaixo, "entregue");

  const geradoSemAviso = montarLinha(concluido({ status: "pronto" }), AGORA);
  assert.equal(geradoSemAviso.situacaoPorBaixo, "pronto", "gerado sem aviso NÃO é entrega");

  // E o contador que torna a decisão de precedência auditável.
  const r = resumir([semEntrega, comEntrega]);
  assert.equal(r.concluidos, 2);
  assert.equal(r.concluidosComPendencia, 1, "só o que não recebeu conta como pendência");
});

test("a linha CONTINUA na tabela e o relógio continua contando a verdade", () => {
  const l = montarLinha(concluido({ status: "foto" }), AGORA);
  // Requisito duro do pedido: concluir não pode sumir com a linha.
  assert.equal(l.id, "id-1");
  assert.equal(l.paradoTexto, "5 dias", "o 'parado há' não foi zerado");
  assert.equal(l.paradoMs > 4 * 24 * H, true);
  // O que ela perde é só o grito.
  assert.equal(l.parado, false);
  assert.equal(l.precisaAcao, false);
  assert.equal(l.silenciado, false);
});

test("concluir também cala o vermelho de quem já tinha sido cobrado", () => {
  const l = montarLinha(
    concluido({
      status: "foto",
      cobrado_em: new Date(AGORA - 200 * H).toISOString(),
      cobrado_por: "suporte@x.com",
    }),
    AGORA,
  );
  assert.equal(l.parado, false, "cobrança vencida não ressuscita o alerta de um caso encerrado");
  assert.equal(l.silenciado, false);
});

// --- 3) A MARCA NÃO VENCE POR TEMPO, MAS É SUPERADA SE O ALUNO MEXER -------

test("conclusão NÃO vence por tempo, diferente do 'já cobrei'", () => {
  const velha = montarLinha(
    concluido({ status: "foto", atualizado_em: new Date(AGORA - 400 * 24 * H).toISOString() }, 300),
    AGORA,
  );
  assert.equal(velha.situacao, "concluido", "decisão não expira no relógio");
  assert.equal(velha.parado, false);
});

test("se o ALUNO mexer depois, a conclusão vira histórico e o alerta volta", () => {
  const reaberto = pedido({
    status: "foto",
    concluido_em: new Date(AGORA - 10 * 24 * H).toISOString(),
    concluido_por: "suporte@x.com",
    concluido_motivo: "aluno desistiu",
    // Mexeu DEPOIS de concluído, e voltou a travar.
    atualizado_em: new Date(AGORA - 60 * H).toISOString(),
  });
  const l = montarLinha(reaberto, AGORA);
  assert.equal(l.conclusaoSuperada, true);
  assert.equal(l.concluido, false);
  assert.equal(l.situacao, "aguardando", "a situação volta a ser a real");
  assert.equal(l.parado, true, "o caso reabriu e volta a gritar sozinho");
  assert.equal(l.precisaAcao, true);
  // E a declaração de gente NÃO é apagada: fica como histórico.
  assert.match(l.concluidoTexto ?? "", /concluído há 10 dias por suporte@x\.com/);
  assert.match(l.concluidoTexto ?? "", /mexeu depois/);
  assert.equal(l.concluidoMotivo, "aluno desistiu");
  assert.match(l.oQueFazer, /confira se o caso reabriu/);
  assert.match(l.oQueFazer, /Cobrar o aluno/, "e a frase de ação normal continua lá");
});

test("concluir não se auto-supera: a marca vale no instante em que é criada", () => {
  // O gatilho da migration 110 preserva `atualizado_em` quando só as colunas de
  // conclusão mudam. Sem isso, `atualizado_em` viraria `now()` e ficaria à frente
  // de `concluido_em` — TODA conclusão nasceria superada.
  const agoraMesmo = pedido({
    status: "foto",
    atualizado_em: new Date(AGORA - 5 * 24 * H).toISOString(),
    concluido_em: new Date(AGORA).toISOString(),
    concluido_por: "suporte@x.com",
  });
  assert.equal(lerConclusao(agoraMesmo, AGORA)?.superada, false);
  assert.equal(montarLinha(agoraMesmo, AGORA).concluido, true);
});

test("data de conclusão ilegível não cala alerta nenhum", () => {
  const torto = pedido({
    status: "foto",
    atualizado_em: new Date(AGORA - 60 * H).toISOString(),
    concluido_em: "não é data",
    concluido_por: "suporte@x.com",
  });
  const l = montarLinha(torto, AGORA);
  assert.equal(l.concluido, false, "dado torto nunca pode encerrar um caso sozinho");
  assert.equal(l.parado, true);
  assert.equal(l.situacao, "aguardando");
});

// --- 4) BORDAS: AUTORIA, MOTIVO, MIGRATION AUSENTE, JARGÃO -----------------

test("concluído sem autor identificado não escreve 'null' na cara do atendente", () => {
  const l = montarLinha(concluido({ concluido_por: "   ", concluido_motivo: "  " }), AGORA);
  assert.equal(l.concluidoTexto, "concluído há 3h por alguém do time");
  assert.equal(l.concluidoMotivo, null);
});

test("pedido SEM as colunas da migration 110 se comporta como 'nunca concluído'", () => {
  // Campos AUSENTES (não `null`): é exatamente o que a rota devolve hoje.
  const l = montarLinha(pedido({ status: "foto" }), AGORA);
  assert.equal(l.concluido, false);
  assert.equal(l.concluidoTexto, null);
  assert.equal(l.conclusaoSuperada, false);
  assert.equal(l.situacao, "aguardando");
  assert.equal(l.situacaoPorBaixo, "aguardando");
});

test("nenhuma frase de conclusão vaza jargão pro atendente", () => {
  const jargao =
    /\.tsx|\.ts\b|\.cjs|PR ?#|sgp_pedidos|status ?=|user_id|concluido_em|null|undefined|migration|endpoint/i;
  const variantes: SgpPedidoRow[] = [
    concluido({ status: "foto" }),
    concluido({ status: "pronto", concluido_motivo: "resolvido no WhatsApp" }),
    concluido({ status: "falhou", erro: "timeout" }),
    // superada
    pedido({
      status: "audio",
      concluido_em: new Date(AGORA - 50 * H).toISOString(),
      concluido_por: "suporte@x.com",
      atualizado_em: new Date(AGORA - 60 * H + 1).toISOString(),
    }),
  ];
  for (const p of variantes) {
    const l = montarLinha(p, AGORA);
    assert.equal(jargao.test(l.oQueFazer), false, `jargão: ${l.oQueFazer}`);
    assert.equal(jargao.test(l.concluidoTexto ?? ""), false, `jargão no selo: ${l.concluidoTexto}`);
    assert.equal(jargao.test(l.situacaoMotivo), false, `jargão no motivo: ${l.situacaoMotivo}`);
  }
});

test("a frase de ação avisa quando o encerrado NÃO recebeu o clone", () => {
  const semEntrega = montarLinha(concluido({ status: "foto" }), AGORA);
  assert.match(semEntrega.oQueFazer, /Nada a fazer/);
  assert.match(semEntrega.oQueFazer, /NÃO chegou a ser entregue/);
  assert.match(semEntrega.oQueFazer, /Enviando as fotos/, "diz em que passo o aluno parou");

  const entregue = montarLinha(concluido({ status: "pronto" }), AGORA);
  assert.match(entregue.oQueFazer, /Nada a fazer/);
  assert.equal(/NÃO chegou a ser entregue/.test(entregue.oQueFazer), false);
});

// --- 5) ORDEM E CONTADORES -------------------------------------------------

test("ordem: concluído vai pro FIM, mas continua na tabela", () => {
  // O encerrado está parado há MUITO mais tempo que os outros: sem o degrau
  // novo, o desempate por "mais tempo parado" o colocaria na frente.
  const encerrado = montarLinha({ ...concluido({ status: "foto" }), id: "encerrado" }, AGORA);
  const gritando = montarLinha(
    pedido({ id: "gritando", status: "foto", atualizado_em: new Date(AGORA - 60 * H).toISOString() }),
    AGORA,
  );
  const novo = montarLinha(
    pedido({ id: "novo", status: "dados", atualizado_em: new Date(AGORA - 1 * H).toISOString() }),
    AGORA,
  );
  const ordem = ordenar([encerrado, novo, gritando]).map((l) => l.id);
  assert.deepEqual(ordem, ["gritando", "novo", "encerrado"]);
  assert.equal(ordem.length, 3, "nada sumiu da tabela");
});

test("o resumo conta os QUATRO buckets e eles fecham com o total", () => {
  const linhas = [
    montarLinha(pedido({ id: "a", status: "pronto" }), AGORA),
    montarLinha(pedido({ id: "b", status: "foto" }), AGORA),
    montarLinha(pedido({ id: "c", status: "falhou", erro: "x" }), AGORA),
    montarLinha({ ...concluido({ status: "foto" }), id: "d" }, AGORA),
    // "e" leva o carimbo de aviso: desde 15/09 é ele, e não `status = 'pronto'`,
    // que faz um concluído NÃO contar como pendência. Sem o carimbo este caso
    // viraria o segundo `concluidosComPendencia` — e corretamente, porque o
    // aluno poderia nunca ter sabido que o clone dele existe.
    montarLinha({ ...concluido({ status: "pronto" }), id: "e" }, AGORA, undefined, {
      em: new Date(AGORA - 1 * H).toISOString(),
      canal: "WhatsApp",
      por: "atendente@fast.com",
      fonte: "time",
    }),
  ];
  const r = resumir(linhas);
  assert.deepEqual(r.situacoes, {
    concluido: 2,
    entregue: 0,
    aviso_nao_confirmado: 0,
    pronto: 1,
    aguardando: 1,
    erro: 1,
  });
  assert.equal(
    r.situacoes.concluido +
      r.situacoes.entregue +
      r.situacoes.pronto +
      r.situacoes.aguardando +
      r.situacoes.erro,
    r.total,
  );
  assert.equal(r.concluidos, 2);
  assert.equal(r.concluidosComPendencia, 1);
  assert.equal(r.parados, 0, "encerrado não conta como parado");
});

test("situacaoDoPedido ignora a conclusão — é a régua dos três de sempre", () => {
  const p = concluido({ status: "falhou", erro: "timeout" });
  assert.equal(situacao(p, AGORA).codigo, "concluido");
  assert.equal(situacaoDoPedido(p, AGORA).codigo, "erro");
});

// --- 6) DEGRADAÇÃO SEM A MIGRATION 110 -------------------------------------

test("coluna de conclusão ausente é reconhecida, e erro de verdade não é engolido", () => {
  // ⚠️ ESTE É O ERRO REAL, copiado do PostgREST de produção em 14/09 pedindo as
  // colunas da 110 (que não estão aplicadas):
  //   code: "42703"  message: "column sgp_pedidos.concluido_em does not exist"
  const real = { code: "42703", message: "column sgp_pedidos.concluido_em does not exist" };
  assert.equal(colunaConclusaoAusente(real), true);

  // E a rede de segurança por MENSAGEM (pro caso do PostgREST engolir o código,
  // que acontece em erro de schema cache) também pega, ancorada no nome nosso.
  assert.equal(
    colunaConclusaoAusente({ message: "column sgp_pedidos.concluido_em does not exist" }),
    true,
  );
  // Um "does not exist" de OUTRA coisa é bug e tem que estourar, não degradar.
  assert.equal(colunaConclusaoAusente({ message: 'relation "outra" does not exist' }), false);
  assert.equal(colunaConclusaoAusente({ code: "23505", message: "duplicate key" }), false);

  // ⚠️ LIMITE MEDIDO, e está aqui escrito pra ninguém supor isolamento que não
  // existe: com o erro REAL, os três atalhos de grupo dizem "true", porque o
  // SQLSTATE 42703 curto-circuita ANTES da checagem por nome de coluna. Isso é
  // inofensivo nas rotas de ESCRITA (cada uma só toca as suas três colunas, então
  // um 42703 ali só pode ser sobre elas), e é irrelevante pro fallback da LEITURA,
  // que separa os grupos pelo nome na mensagem — é o teste seguinte que prova isso.
  assert.equal(colunaCobrancaAusente(real), true, "comportamento medido, não aspiracional");
  assert.equal(colunaErroManualAusente(real), true, "idem");
  // A separação por NOME, que é a que o fallback de leitura usa, essa vale:
  assert.equal(colunaCobrancaAusente({ message: "column concluido_em does not exist" }), false);
  assert.equal(colunaErroManualAusente({ message: "column concluido_em does not exist" }), false);
});

test("sem a migration 110 os outros dois botões continuam de pé", async () => {
  const vistas: string[] = [];
  const buscar = criarFilaComFallback<{ id: string }>(
    async (colunas) => {
      vistas.push(colunas);
      if (colunas.includes("concluido_em")) {
        // A forma EXATA do erro de produção (medida em 14/09).
        return {
          data: null,
          error: { code: "42703", message: "column sgp_pedidos.concluido_em does not exist" },
        };
      }
      return { data: [{ id: "1" }], error: null };
    },
    ["id"],
    [
      { nome: "cobranca", colunas: ["cobrado_em", "cobrado_por"] },
      { nome: "erroManual", colunas: ["erro_manual_em"] },
      { nome: "conclusao", colunas: ["concluido_em", "concluido_por"] },
    ],
  );
  const r = await buscar();
  assert.equal(r.error, null, "a tela do time não cai");
  assert.deepEqual(r.data, [{ id: "1" }]);
  assert.equal(r.disponivel.conclusao, false, "só o botão de concluir some");
  assert.equal(r.disponivel.cobranca, true);
  assert.equal(r.disponivel.erroManual, true);
  assert.equal(vistas.length, 2, "derrubou só o grupo acusado, numa tentativa");
});
