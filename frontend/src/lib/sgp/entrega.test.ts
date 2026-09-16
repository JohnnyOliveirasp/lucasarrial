/**
 * SGP — o corte GERADO × ENTREGUE (recado 6 do Johnny, 15/09).
 *
 * O QUE ESTES TESTES PROTEGEM, e cada um tem um caso real por trás:
 *  1. `status = 'pronto'` SEM registro de aviso NÃO pode dizer "nada a fazer" —
 *     foi o que deixou franklindfreis, biatupi e andreviana com o clone pronto
 *     sem saber, um deles por 8 dias, com a tela dizendo "Entregue" o tempo todo;
 *  2. com o carimbo DE GENTE, a linha vira ENTREGUE e o "parado há" PARA de contar;
 *  3. quem comprou e nunca abriu o portal APARECE na fila de trabalho;
 *  4. o carimbo do SISTEMA sozinho NUNCA vira ENTREGUE — é AVISO NÃO CONFIRMADO,
 *     que é o "pronto, aviso não confirmado" que o recado 6 pediu para os 84
 *     (correção do gerente, 16/09);
 *  5. o carimbo nunca é herdado de outro ciclo do mesmo aluno.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/entrega.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SGP_CANAIS_AVISO,
  SGP_CONCLUSAO_AUTOMATICA_DIAS,
  canalValido,
  conclusaoAutomatica,
  lerAviso,
  montarLinha,
  ordenar,
  resumir,
  situacao,
  type AvisoEntrega,
} from "./painel.ts";
import { avisoDoPedido } from "./aviso.ts";
import { COLUNAS_AVISO, colunaAvisoAusente, criarFilaComFallback } from "./cobranca.ts";
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

/**
 * O carimbo do SISTEMA (`profiles.onboarding_ready_email_at`), como
 * `lib/sgp/aviso.ts` o monta. Prova que um e-mail SAIU — não prova entrega.
 */
const avisoEm = (ms: number): AvisoEntrega => ({
  em: new Date(ms).toISOString(),
  canal: "e-mail",
  por: "o sistema",
});

/**
 * O carimbo de GENTE (migration 116): alguém do time clicou "Avisei o aluno".
 * É o ÚNICO que promove a linha a ENTREGUE — ver "O SEXTO RÓTULO" em painel.ts.
 */
const avisoDoTime = (ms: number): AvisoEntrega => ({
  em: new Date(ms).toISOString(),
  canal: "WhatsApp",
  por: "atendente@fast.com",
  fonte: "time",
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
    avisoDoTime(AGORA - 9 * D),
  );
  const [primeiro] = ordenar([comAviso, semAviso]);
  assert.equal(primeiro.id, "sem", "quem não foi avisado vem antes de quem já foi");
});

/* ===========================================================================
 * 2) COM CARIMBO → ENTREGUE, e o "parado há" CONGELA
 * ========================================================================= */

test("com carimbo vira ENTREGUE e o 'parado há' PARA de contar", () => {
  const p = pedido({ atualizado_em: new Date(AGORA - 10 * D).toISOString() });
  const aviso = avisoDoTime(AGORA - 8 * D); // avisado 2 dias depois da última mexida

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
  const aviso = avisoDoTime(AGORA - 8 * D);

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
  const l = montarLinha(p, AGORA, undefined, avisoDoTime(AGORA - 5 * D));
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
  const aviso = avisoDoTime(AGORA - 9 * D);

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
    avisoDoTime(AGORA - 9 * D),
  );
  const r = resumir([concluidoSemAviso, concluidoEntregue]);
  assert.equal(r.concluidos, 2);
  assert.equal(r.concluidosComPendencia, 1, "só o que não foi avisado conta como pendência");
});

/* ===========================================================================
 * 6) O CARIMBO DO TIME — o caminho de ESCRITA (rota [id]/aviso)
 *
 * Sem estes, a 116 cria três colunas que ninguém consegue escrever e a frase
 * "registre aqui que avisou" manda o atendente fazer algo que a tela não
 * oferece. É o mesmo defeito do "Nada a fazer. Já foi entregue", uma casa
 * adiante: prometer na tela uma coisa que o sistema não faz.
 * ========================================================================= */

test("o carimbo do TIME ganha do automático e diz por qual canal foi", () => {
  const p = pedido({
    avisado_em: new Date(AGORA - 2 * D).toISOString(),
    avisado_por: "suporte@x.com",
    avisado_canal: "WhatsApp",
  });
  // Mesmo com o e-mail automático tendo saído, quem manda é o clique de gente:
  // ele é sobre ESTE pedido e sabe o canal real.
  const a = avisoDoPedido(p, new Date(AGORA - 9 * D).toISOString());
  assert.equal(a?.canal, "WhatsApp");
  assert.equal(a?.por, "suporte@x.com");
  assert.equal(a?.fonte, "time");

  const l = montarLinha(p, AGORA, undefined, a);
  assert.equal(l.situacao, "entregue");
  assert.equal(l.avisadoPeloTime, true, "é o que libera o 'desfazer' na tela");
  assert.match(l.avisadoTexto ?? "", /WhatsApp/);
  assert.match(l.oQueFazer, /Nada a fazer/);
});

test("o carimbo do SISTEMA não se oferece pra ser desfeito", () => {
  // Desfazer aqui limparia `avisado_*`, que está vazio: a linha continuaria
  // ENTREGUE e o atendente concluiria que a tela está quebrada.
  const a = avisoDoPedido(pedido(), new Date(AGORA - 3 * D).toISOString());
  assert.equal(a?.fonte, "sistema");
  assert.equal(a?.por, "o sistema");
  const l = montarLinha(pedido(), AGORA, undefined, a);
  assert.equal(l.avisado, true);
  assert.equal(l.avisadoPeloTime, false);
});

test("fonte ausente é tratada como SISTEMA — na dúvida, não oferece desfazer", () => {
  const cru = { em: new Date(AGORA - 1 * D).toISOString(), canal: "e-mail", por: "x" };
  assert.equal(lerAviso(pedido(), cru, AGORA)?.fonte, "sistema");
  assert.equal(montarLinha(pedido(), AGORA, undefined, cru).avisadoPeloTime, false);
});

test("o canal é uma lista fechada: a rota recusa qualquer outra coisa", () => {
  for (const bom of SGP_CANAIS_AVISO) assert.equal(canalValido(bom), bom);
  assert.equal(canalValido("  WhatsApp  "), "WhatsApp", "espaço sobrando não recusa o atendente");
  // O que a lista existe pra barrar: três nomes pro mesmo canal, e lixo.
  assert.equal(canalValido("zap"), null);
  assert.equal(canalValido("whatsapp"), null, "a lista é o que a tela oferece, não variação livre");
  assert.equal(canalValido(""), null);
  assert.equal(canalValido(null), null);
  assert.equal(canalValido(42), null);
  assert.equal(canalValido({ canal: "WhatsApp" }), null);
});

test("coluna de aviso ausente é reconhecida, e erro de verdade não é engolido", () => {
  // A forma do erro do PostgREST quando a 116 não foi aplicada.
  const real = { code: "42703", message: "column sgp_pedidos.avisado_em does not exist" };
  assert.equal(colunaAvisoAusente(real), true);
  // Rede de segurança por MENSAGEM, pro caso do PostgREST engolir o código
  // (acontece em erro de schema cache), ancorada no nosso nome de coluna.
  assert.equal(
    colunaAvisoAusente({ message: "column sgp_pedidos.avisado_em does not exist" }),
    true,
  );
  assert.equal(colunaAvisoAusente({ message: 'relation "outra" does not exist' }), false);
  assert.equal(colunaAvisoAusente({ code: "23505", message: "duplicate key" }), false);
  // E a separação por NOME (a que o fallback de leitura usa) não confunde grupos.
  assert.equal(colunaAvisoAusente({ message: "column concluido_em does not exist" }), false);
});

test("sem a migration 116 a fila continua de pé e os outros grupos sobrevivem", async () => {
  const buscar = criarFilaComFallback<{ id: string }>(
    async (colunas) => {
      if (colunas.includes("avisado_em")) {
        // ⚠️ ERRO SEM `code`, DE PROPÓSITO: com o 42703 o `colunaAusente`
        // curto-circuita e este teste passaria mesmo com a regra quebrada. Sem
        // o código, quem decide é o casamento por NOME contra `COLUNAS_OPCIONAIS`
        // — e é exatamente ele que exige `COLUNAS_AVISO` dentro daquela lista em
        // cobranca.ts. Fora de lá, o fallback não derruba o grupo e a tela
        // inteira do time de suporte cai por causa de uma coluna acessória.
        return {
          data: null,
          error: { message: "column sgp_pedidos.avisado_em does not exist" },
        };
      }
      return { data: [{ id: "1" }], error: null };
    },
    ["id"],
    [
      { nome: "cobranca", colunas: ["cobrado_em"] },
      { nome: "aviso", colunas: [...COLUNAS_AVISO] },
    ],
  );
  const r = await buscar();
  assert.equal(r.error, null, "a tela do time não cai");
  assert.equal(r.disponivel.aviso, false, "só o registro de aviso fica indisponível");
  assert.equal(r.disponivel.cobranca, true);
});

/* ===========================================================================
 * 8) OS 84 ANTIGOS — carimbo do SISTEMA nunca é, sozinho, ENTREGUE
 *
 * O recado 6 foi taxativo: "NAO carimbe retroativo nos 84 (...) Eles ficam num
 * estado explicito tipo 'pronto, aviso nao confirmado'". A primeira versão desta
 * mudança lia `profiles.onboarding_ready_email_at` e promovia 81 dos 82 direto a
 * ENTREGUE. Estes testes são a trava pra isso não voltar.
 * ========================================================================= */

test("carimbo SÓ do sistema não é ENTREGUE: vira AVISO NÃO CONFIRMADO", () => {
  const l = montarLinha(pedido(), AGORA, undefined, avisoEm(AGORA - 9 * D));

  assert.equal(l.situacao, "aviso_nao_confirmado");
  assert.equal(l.situacaoRotulo, "AVISO NÃO CONFIRMADO");
  assert.notEqual(l.situacao, "entregue", "o e-mail automático não afirma entrega");
});

test("o estado dos 84 NUNCA diz 'nada a fazer' — ele manda CONFIRMAR", () => {
  const l = montarLinha(pedido(), AGORA, undefined, avisoEm(AGORA - 9 * D));

  // A regressão exata do recado 6, agora pelo outro caminho.
  assert.doesNotMatch(l.oQueFazer, /Nada a fazer/);
  assert.match(l.oQueFazer, /CONFIRMAR COM O ALUNO/);
  // E a tela diz POR QUE não basta: envio não é leitura.
  assert.match(l.situacaoMotivo, /NINGUÉM confirmou/);
});

test("franklindfreis: TEM o carimbo automático e mesmo assim não conta como entregue", () => {
  // O caso real que o recado 6 cita como "teve o clone pronto e NÃO SOUBE".
  // Carimbo de 13/09 01:43, seis minutos depois do envio do pedido — e ele
  // continuou sem saber, porque não tinha acesso vivo. Se esta linha voltar a
  // ser ENTREGUE, a tela voltou a mentir exatamente sobre quem originou o recado.
  const p = pedido({
    id: "franklindfreis",
    enviado_em: new Date("2026-09-13T01:37:00Z").toISOString(),
  });
  const carimbo = avisoEm(new Date("2026-09-13T01:43:00Z").getTime());

  const l = montarLinha(p, AGORA, undefined, carimbo);
  assert.notEqual(l.situacao, "entregue");
  assert.equal(l.situacao, "aviso_nao_confirmado");
});

test("o relógio NÃO congela com carimbo só do sistema — o caso segue envelhecendo", () => {
  // Congelar tiraria o caso do topo da fila usando como prova justamente o
  // carimbo que não prova nada. Quem não foi confirmado está esperando agora.
  const p = pedido({ atualizado_em: new Date(AGORA - 10 * D).toISOString() });
  const aviso = avisoEm(AGORA - 8 * D);

  const hoje = montarLinha(p, AGORA, undefined, aviso);
  const amanha = montarLinha(p, AGORA + 1 * D, undefined, aviso);

  assert.equal(hoje.relogioParado, false);
  assert.ok(amanha.paradoMs > hoje.paradoMs, "não confirmado tem que continuar contando");
});

test("o clique do time PROMOVE a linha: mesmo pedido, de não-confirmado a ENTREGUE", () => {
  const p = pedido();

  const antes = montarLinha(p, AGORA, undefined, avisoEm(AGORA - 9 * D));
  const depois = montarLinha(p, AGORA, undefined, avisoDoTime(AGORA - 1 * D));

  assert.equal(antes.situacao, "aviso_nao_confirmado");
  assert.equal(depois.situacao, "entregue");
  assert.equal(depois.avisadoPeloTime, true);
  assert.equal(antes.avisadoPeloTime, false);
});

test("os 84 aparecem num contador PRÓPRIO, sem sujar entregue nem gerado", () => {
  const linhas = [
    // 2 com carimbo só do sistema (o retrato dos 84)
    montarLinha(pedido({ id: "a" }), AGORA, undefined, avisoEm(AGORA - 9 * D)),
    montarLinha(pedido({ id: "b" }), AGORA, undefined, avisoEm(AGORA - 9 * D)),
    // 1 sem carimbo nenhum
    montarLinha(pedido({ id: "c" }), AGORA, undefined, null),
    // 1 confirmado por gente
    montarLinha(pedido({ id: "d" }), AGORA, undefined, avisoDoTime(AGORA - 9 * D)),
  ];
  const r = resumir(linhas);

  assert.equal(r.situacoes.aviso_nao_confirmado, 2);
  assert.equal(r.situacoes.entregue, 1, "só o carimbo de gente conta como entregue");
  assert.equal(r.situacoes.pronto, 1);
});

test("concluir um caso NÃO CONFIRMADO ainda conta como pendência na auditoria", () => {
  // `situacaoPorBaixo !== "entregue"`: encerrar o atendimento de quem só tem o
  // e-mail automático não pode limpar o número que existe pra flagrar isso.
  const l = montarLinha(
    pedido({ concluido_em: new Date(AGORA - 1 * H).toISOString() }),
    AGORA,
    undefined,
    avisoEm(AGORA - 9 * D),
  );
  assert.equal(l.concluido, true);
  assert.equal(l.situacaoPorBaixo, "aviso_nao_confirmado");
  assert.equal(resumir([l]).concluidosComPendencia, 1);
});

/* ===========================================================================
 * 9) A REGUA DOS 7 DIAS — restaurada (é do reenvio 2/2, PR #307) e APERTADA
 *
 * `conclusaoAutomatica` NÃO é código morto: o PR #307 (`conclusao-sweep.ts`) a
 * importa e é ele quem a liga, com flag desligada por padrão. Removê-la daqui
 * quebraria um PR aberto e MERGEABLE — então ela fica, e ganha a guarda que o
 * corte do sexto rótulo exige.
 * ========================================================================= */

test("7 dias após ENTREGA CONFIRMADA e sem reclamação: conclui", () => {
  const v = conclusaoAutomatica(pedido(), lerAviso(pedido(), avisoDoTime(AGORA - 8 * D), AGORA), AGORA);
  assert.equal(v.conclui, true);
  assert.match(v.motivo, new RegExp(`${SGP_CONCLUSAO_AUTOMATICA_DIAS} dias`));
});

test("antes dos 7 dias NÃO conclui, e diz quanto falta", () => {
  const v = conclusaoAutomatica(pedido(), lerAviso(pedido(), avisoDoTime(AGORA - 2 * D), AGORA), AGORA);
  assert.equal(v.conclui, false);
  assert.match(v.motivo, /fecha sozinho em/);
});

test("sem aviso nenhum o prazo NEM COMEÇA — nunca arquiva quem não foi avisado", () => {
  const v = conclusaoAutomatica(pedido(), null, AGORA);
  assert.equal(v.conclui, false);
  assert.match(v.motivo, /nem começou/);
});

test("REGRESSÃO: carimbo só do sistema NÃO faz o prazo dos 7 dias correr", () => {
  // Sem esta guarda o fechamento automático do #307 arquivaria sozinho, em 7
  // dias e em silêncio, justamente a classe do franklindfreis — que TEM o
  // carimbo automático e mesmo assim não soube do clone.
  // 9 dias: passou dos 7, e é DEPOIS de `enviado_em` (AGORA-11d) pra não cair
  // na guarda de "aviso de outro ciclo" — o que testaria outra coisa.
  const antigo = avisoEm(AGORA - 9 * D);
  const v = conclusaoAutomatica(pedido(), lerAviso(pedido(), antigo, AGORA), AGORA);

  assert.equal(v.conclui, false, "e-mail automático não pode fechar caso sozinho");
  assert.match(v.motivo, /ninguém confirmou/);
});

test("com RECLAMAÇÃO no meio NÃO conclui, mesmo passados os 7 dias", () => {
  const aviso = lerAviso(pedido(), avisoDoTime(AGORA - 8 * D), AGORA);
  assert.equal(conclusaoAutomatica(pedido({ erro: "voz falhou" }), aviso, AGORA).conclui, false);
  assert.equal(
    conclusaoAutomatica(pedido({ erro_manual_em: new Date(AGORA - 1 * H).toISOString() }), aviso, AGORA)
      .conclui,
    false,
  );
});

test("quem já foi concluído por gente não é reconcluído pela régua automática", () => {
  const v = conclusaoAutomatica(
    pedido({ concluido_em: new Date(AGORA - 1 * D).toISOString() }),
    lerAviso(pedido(), avisoDoTime(AGORA - 8 * D), AGORA),
    AGORA,
  );
  assert.equal(v.conclui, false);
  assert.match(v.motivo, /já foi concluído/);
});
