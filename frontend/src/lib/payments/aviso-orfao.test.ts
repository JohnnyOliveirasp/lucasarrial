/**
 * Testes do aviso de COMPRA ÓRFÃ — incidente #239 (Tiago, 02/09/2026). Rodar
 * (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/aviso-orfao.test.ts
 *
 * O CASO É REAL, medido no banco em 03/09/2026:
 *   - assinatura `PMB7RT7F`, comprada em 02/09 22:37 com `cachico3@hotmail.com`;
 *   - a conta do Tiago no app é `cachico1988123@gmail.com` (perfil de 30/08);
 *   - `entitlements.user_id` nasceu NULL, `payment_events` gravou
 *     PURCHASE_APPROVED com `processed_at` preenchido e `error` NULL;
 *   - resultado: 1h45 pagando e travado, e NINGUÉM foi avisado — quem viu foi
 *     a Carol no WhatsApp, por acaso.
 *
 * O aviso já existia (`alertOrphanPurchase`) e nunca produziu um e-mail: 665
 * mensagens varridas na conta do Resend (05/08 → 02/09) contra ~46 aprovações
 * órfãs no mesmo período = ZERO avisos. Ele falhava calado porque o retorno do
 * `sendEmail` era descartado dentro de um `catch {}` vazio.
 *
 * Por isso os dois testes que o card exige — aviso dispara, e o SEGUNDO evento
 * do mesmo entitlement não avisa de novo — rodam contra o fluxo inteiro com
 * canais falsos, e não contra pedaços soltos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avisarCompraOrfa,
  avisarLoteCompraOrfa,
  CARENCIA_ORFAO_MS,
  chaveDoAviso,
  deveAvisar,
  fraseDaFila,
  montarAviso,
  montarObservacao,
  observarCompraOrfa,
  podeNotificarOrfao,
  selecionarParaAvisar,
  TETO_AVISOS_POR_VARREDURA,
  type CandidatoAviso,
  type CanaisAviso,
  type CompraOrfa,
  type EstadoAvisos,
  type EstadoAvisosIO,
  type EstadoEntitlement,
  type EstadoObservacoes,
  type ObservacoesIO,
} from "./aviso-orfao.ts";
import {
  decidirAcaoConvite,
  registroDoConvite,
  type RegistroConvite,
} from "./orphan-ciclo.ts";
import {
  extractBuyerName,
  extractProductName,
  extractTransactionId,
} from "./hotmart-payload.ts";

const NOSSO_PRODUTO = "7851642";
const AGORA = "2026-09-02T22:37:30.000Z";

/** Payload real do evento do Tiago (campos que o aviso usa). */
const PAYLOAD_TIAGO = {
  product: { id: 7851642, name: "FastCloner" },
  buyer: { email: "cachico3@hotmail.com", name: "Tiago Chico" },
  purchase: { transaction: "HP2742616487", status: "APPROVED" },
  subscription: { subscriber: { code: "PMB7RT7F" } },
} as Record<string, unknown>;

const TIAGO: CompraOrfa = {
  eventType: "PURCHASE_APPROVED",
  buyerEmail: "cachico3@hotmail.com",
  buyerName: "Tiago Chico",
  productCode: "7851642",
  productName: "FastCloner",
  transaction: "HP2742616487",
  externalId: "PMB7RT7F",
};

/** Canais falsos: guardam o que receberam e dizem se aceitaram. */
function canaisFalsos(aceita: { telegram: boolean; email: boolean }) {
  const visto = {
    duraveis: [] as Array<{ chave: string; texto: string }>,
    telegram: [] as string[],
    email: [] as Array<{ assunto: string; html: string }>,
  };
  const canais: CanaisAviso = {
    registrar: async (chave, aviso) => {
      visto.duraveis.push({ chave, texto: aviso.texto });
    },
    telegram: async (texto) => {
      visto.telegram.push(texto);
      return aceita.telegram;
    },
    email: async (assunto, html) => {
      visto.email.push({ assunto, html });
      return aceita.email;
    },
  };
  return { canais, visto };
}

function estadoNaMemoria(inicial: EstadoAvisos = {}) {
  let atual: EstadoAvisos = { ...inicial };
  const io: EstadoAvisosIO = {
    ler: async () => ({ ...atual }),
    gravar: async (e) => {
      atual = { ...e };
    },
  };
  return { io, ver: () => atual };
}

// ── 1. o aviso dispara na aprovação sem conta ───────────────────────────────

test("aprovação sem conta: avisa, e o aviso vai por TODOS os canais", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io, ver } = estadoNaMemoria();

  const r = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);

  assert.equal(r.avisou, true);
  assert.equal(r.motivo, "enviado");
  assert.deepEqual(r.canais, ["telegram", "email"]);
  assert.equal(visto.telegram.length, 1);
  assert.equal(visto.email.length, 1);
  // durável ANTES dos canais voláteis: é a garantia que faltou no #239
  assert.equal(visto.duraveis.length, 1);
  assert.equal(visto.duraveis[0].chave, "PMB7RT7F");
  assert.deepEqual(ver()["PMB7RT7F"], {
    at: AGORA,
    buyerEmail: "cachico3@hotmail.com",
    canais: ["telegram", "email"],
  });
});

test("o aviso entrega os 5 dados que a ação exige (nada de 'compra órfã' e nada mais)", () => {
  const { assunto, texto } = montarAviso(TIAGO);
  assert.match(assunto, /cachico3@hotmail\.com/);
  for (const dado of ["cachico3@hotmail.com", "Tiago Chico", "FastCloner", "HP2742616487", "PMB7RT7F"]) {
    assert.ok(texto.includes(dado), `faltou "${dado}" no texto do aviso`);
  }
  // regra de 01/09: "O QUE FAZER" (pra quem atende) antes dos dados brutos
  assert.ok(texto.indexOf("O QUE FAZER") < texto.indexOf("DADOS"));
});

test("campo faltando no payload vira travessão, não quebra nem inventa", () => {
  const { texto } = montarAviso({ ...TIAGO, buyerName: null, transaction: null, productName: "" });
  assert.ok(texto.includes("Comprador: —"));
  assert.ok(texto.includes("Transação: —"));
});

// ── 2. o SEGUNDO evento do mesmo entitlement não avisa de novo ──────────────

test("renovação/reprocessamento do MESMO entitlement não avisa de novo", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io, ver } = estadoNaMemoria();

  const primeiro = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);
  // mesmo assinante, cobrança do mês seguinte (transação nova, external_id igual)
  const segundo = await avisarCompraOrfa(
    { ...TIAGO, transaction: "HP9999999999" },
    NOSSO_PRODUTO,
    io,
    canais,
    "2026-10-02T22:37:30.000Z",
  );
  // e o PURCHASE_COMPLETE que a Hotmart manda ~7,8 dias depois
  const terceiro = await avisarCompraOrfa(
    { ...TIAGO, eventType: "PURCHASE_COMPLETE" },
    NOSSO_PRODUTO,
    io,
    canais,
    "2026-09-10T12:00:00.000Z",
  );

  assert.equal(primeiro.avisou, true);
  assert.equal(segundo.avisou, false);
  assert.equal(segundo.motivo, "ja_avisado");
  assert.equal(terceiro.avisou, false);
  assert.equal(terceiro.motivo, "ja_avisado");
  // UM aviso em três eventos, em todos os canais
  assert.equal(visto.telegram.length, 1);
  assert.equal(visto.email.length, 1);
  assert.equal(visto.duraveis.length, 1);
  assert.equal(ver()["PMB7RT7F"].at, AGORA); // não regravou por cima
});

// ── 3. ruído: curso e evento que não libera acesso ──────────────────────────

test("compra de CURSO não avisa (FCI/SGP não dão acesso ao FastCloner)", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io } = estadoNaMemoria();
  const curso: CompraOrfa = { ...TIAGO, productCode: "1234567", productName: "Sistema de Geração Pronto" };

  const r = await avisarCompraOrfa(curso, NOSSO_PRODUTO, io, canais, AGORA);

  assert.equal(r.avisou, false);
  assert.equal(r.motivo, "produto_de_fora");
  assert.equal(visto.telegram.length, 0);
  assert.equal(visto.email.length, 0);
});

test("evento que não libera acesso não avisa", () => {
  for (const evento of ["SUBSCRIPTION_CANCELLATION", "PURCHASE_REFUNDED", "PURCHASE_BILLET_PRINTED"]) {
    const d = deveAvisar({ eventType: evento, productCode: NOSSO_PRODUTO, nossoProduto: NOSSO_PRODUTO, buyerEmail: "a@b.com" });
    assert.equal(d.ok, false, `${evento} não deveria avisar`);
  }
  assert.equal(
    deveAvisar({ eventType: "PURCHASE_COMPLETE", productCode: NOSSO_PRODUTO, nossoProduto: NOSSO_PRODUTO, buyerEmail: "a@b.com" }).ok,
    true,
  );
});

test("produto ausente no payload não avisa quando sabemos qual é o nosso", () => {
  const d = deveAvisar({ eventType: "PURCHASE_APPROVED", productCode: null, nossoProduto: NOSSO_PRODUTO, buyerEmail: "a@b.com" });
  assert.equal(d.ok, false);
});

// ── 4. o silêncio deixa de ser invisível ────────────────────────────────────

test("nenhum canal aceitou: avisou=true com canais VAZIO (é isso que o webhook registra)", async () => {
  const { canais } = canaisFalsos({ telegram: false, email: false });
  const { io, ver } = estadoNaMemoria();

  const r = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);

  assert.equal(r.avisou, true);
  assert.deepEqual(r.canais, []); // <- o #239 inteiro: agora isso é VISÍVEL
  assert.deepEqual(ver()["PMB7RT7F"].canais, []);
});

test("Telegram fora do ar: o e-mail ainda entrega e o estado diz qual canal foi", async () => {
  const { canais } = canaisFalsos({ telegram: false, email: true });
  const { io } = estadoNaMemoria();
  const r = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);
  assert.deepEqual(r.canais, ["email"]);
});

// ── 5. chave de idempotência e extratores ──────────────────────────────────

test("payload sem id nenhum cai no e-mail como chave, e não avisa em loop", async () => {
  const semId: CompraOrfa = { ...TIAGO, externalId: "PURCHASE_APPROVED:unknown" };
  assert.equal(chaveDoAviso(semId), "email:cachico3@hotmail.com");

  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io } = estadoNaMemoria();
  await avisarCompraOrfa(semId, NOSSO_PRODUTO, io, canais, AGORA);
  const de_novo = await avisarCompraOrfa(semId, NOSSO_PRODUTO, io, canais, AGORA);
  assert.equal(de_novo.motivo, "ja_avisado");
  assert.equal(visto.telegram.length, 1);
});

test("extratores leem o payload real do Tiago", () => {
  assert.equal(extractBuyerName(PAYLOAD_TIAGO), "Tiago Chico");
  assert.equal(extractProductName(PAYLOAD_TIAGO), "FastCloner");
  assert.equal(extractTransactionId(PAYLOAD_TIAGO), "HP2742616487");
  assert.equal(extractBuyerName({}), null);
  assert.equal(extractProductName({ product: { name: "   " } }), null);
});

// ════════════════════════════════════════════════════════════════════════════
// 6. O WEBHOOK PAROU DE AVISAR (09/09/2026)
//
// Sete falsos positivos em 3 dias, o último 30 segundos depois da compra, e no
// caso `mariliarossini` a aluna já tinha conta, vínculo e 100.000 créditos no
// instante em que o alerta gritou "PAGANDO E SEM ACESSO". A causa não é guarda
// faltando: no webhook a compra tem idade ZERO e a conta ainda não nasceu (no
// caminho feliz o perfil aparece ~3s depois), então nenhuma guarda de idade é
// possível ali. O webhook passa a só registrar; quem decide é o sweeper.
// ════════════════════════════════════════════════════════════════════════════

const T0 = "2026-09-08T12:00:00.000Z"; // instante da compra
const T0_MS = Date.parse(T0);
const HORA = 60 * 60 * 1000;
const TRES_DIAS = 3 * 24 * HORA;

/**
 * Entitlement que DÁ acesso: assinatura ativa com a janela paga no futuro
 * (depois de qualquer `agoraMs` usado nestes testes). É o estado do órfão de
 * verdade — o `ezwaymotors` da seção 9.
 */
const ATIVO: EstadoEntitlement = { status: "active", access_until: "2026-12-31T00:00:00.000Z" };

function observacoesNaMemoria(inicial: EstadoObservacoes = {}) {
  let atual: EstadoObservacoes = { ...inicial };
  const io: ObservacoesIO = {
    ler: async () => ({ ...atual }),
    gravar: async (e) => {
      atual = { ...e };
    },
  };
  return { io, ver: () => atual };
}

test("webhook: REGISTRA a compra órfã e NÃO toca em nenhum canal volátil", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io, ver } = observacoesNaMemoria();

  const r = await observarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais.registrar, T0);

  assert.equal(r.registrou, true);
  assert.equal(r.motivo, "registrado");
  // o durável (a prova auditável) aconteceu...
  assert.equal(visto.duraveis.length, 1);
  assert.equal(visto.duraveis[0].chave, "PMB7RT7F");
  assert.deepEqual(ver()["PMB7RT7F"], {
    at: T0,
    buyerEmail: "cachico3@hotmail.com",
    externalId: "PMB7RT7F",
  });
  // ...e ninguém foi acordado. É o conserto inteiro numa linha.
  assert.equal(visto.telegram.length, 0);
  assert.equal(visto.email.length, 0);
});

test("webhook: o MESMO entitlement não é registrado duas vezes", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io } = observacoesNaMemoria();

  await observarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais.registrar, T0);
  const segundo = await observarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais.registrar, T0);

  assert.equal(segundo.registrou, false);
  assert.equal(segundo.motivo, "ja_registrado");
  assert.equal(visto.duraveis.length, 1);
});

test("webhook: curso e evento que não libera continuam fora do registro", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io } = observacoesNaMemoria();

  const curso = await observarCompraOrfa(
    { ...TIAGO, productCode: "1234567" },
    NOSSO_PRODUTO,
    io,
    canais.registrar,
    T0,
  );
  const cancelamento = await observarCompraOrfa(
    { ...TIAGO, eventType: "SUBSCRIPTION_CANCELLATION" },
    NOSSO_PRODUTO,
    io,
    canais.registrar,
    T0,
  );

  assert.equal(curso.motivo, "produto_de_fora");
  assert.equal(cancelamento.motivo, "evento_nao_libera");
  assert.equal(visto.duraveis.length, 0);
});

test("o texto do REGISTRO não finge urgência que ainda não existe", () => {
  const { texto } = montarObservacao(TIAGO);
  assert.ok(texto.includes("ISTO NÃO É UM ALERTA"));
  assert.ok(!texto.includes("urgente"));
  assert.ok(!texto.includes("PAGANDO E SEM ACESSO"));
  // mas continua entregando os dados: registro sem dado é registro inútil
  for (const dado of ["cachico3@hotmail.com", "HP2742616487", "PMB7RT7F"]) {
    assert.ok(texto.includes(dado), `faltou "${dado}" no registro`);
  }
  // e o texto do AVISO (o do sweeper, depois da carência) segue urgente, certo
  assert.ok(montarAviso(TIAGO).texto.includes("urgente"));
});

test("A ARMADILHA: o registro do webhook NÃO cala quem notifica depois", async () => {
  // Se as duas coisas dividissem estado, o sweeper leria "já avisado" em todo
  // mundo e nunca falaria — trocaríamos ruído por silêncio total, que é pior.
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const observacoes = observacoesNaMemoria();
  const avisos = estadoNaMemoria();

  await observarCompraOrfa(TIAGO, NOSSO_PRODUTO, observacoes.io, canais.registrar, T0);
  const aviso = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, avisos.io, canais, T0);

  assert.equal(aviso.avisou, true, "o registro do webhook silenciou o aviso — é o bug que a gente evitou");
  assert.equal(aviso.motivo, "enviado");
  assert.equal(visto.telegram.length, 1);
  // e os dois estados são mesmo separados
  assert.ok(observacoes.ver()["PMB7RT7F"]);
  assert.ok(avisos.ver()["PMB7RT7F"]);
  assert.equal("canais" in observacoes.ver()["PMB7RT7F"], false);
});

// ── 7. a carência, que é onde a decisão passou a morar ──────────────────────

test("a carência é de 6 horas, em constante nomeada", () => {
  assert.equal(CARENCIA_ORFAO_MS, 6 * HORA);
});

test("(c) conta que nunca aparece: NOTIFICA depois da carência", () => {
  const d = podeNotificarOrfao({
    compradoEm: T0,
    temConta: false,
    vinculado: false,
    entitlement: ATIVO,
    agoraMs: T0_MS + 7 * HORA,
  });
  assert.equal(d.ok, true);
});

test("dentro da carência, sem conta ainda: espera, não notifica", () => {
  // o caso `mateusnodesence`: 30 segundos depois da compra
  const trintaSegundos = podeNotificarOrfao({
    compradoEm: T0,
    temConta: false,
    vinculado: false,
    entitlement: ATIVO,
    agoraMs: T0_MS + 30 * 1000,
  });
  assert.deepEqual(trintaSegundos, { ok: false, motivo: "dentro_da_carencia" });

  // e a borda: 1ms antes das 6h ainda espera; 6h cravadas já é hora de falar
  assert.equal(podeNotificarOrfao({ compradoEm: T0, temConta: false, vinculado: false, entitlement: ATIVO, agoraMs: T0_MS + CARENCIA_ORFAO_MS - 1 }).ok, false);
  assert.equal(podeNotificarOrfao({ compradoEm: T0, temConta: false, vinculado: false, entitlement: ATIVO, agoraMs: T0_MS + CARENCIA_ORFAO_MS }).ok, true);
});

test("(b) conta criada DEPOIS da compra, dentro da carência: NÃO notifica", () => {
  // é o caso `mariliarossini`: no instante do alerta antigo ela já tinha conta
  const dentro = podeNotificarOrfao({
    compradoEm: T0,
    temConta: true,
    vinculado: false,
    entitlement: ATIVO,
    agoraMs: T0_MS + 2 * HORA,
  });
  assert.deepEqual(dentro, { ok: false, motivo: "conta_criada" });
  // e continua não notificando MUITO depois: conta criada é definitivo
  assert.equal(
    podeNotificarOrfao({ compradoEm: T0, temConta: true, vinculado: false, entitlement: ATIVO, agoraMs: T0_MS + 30 * 24 * HORA }).ok,
    false,
  );
});

test("(d) vínculo (user_id) que chega atrasado: NÃO notifica", () => {
  const d = podeNotificarOrfao({
    compradoEm: T0,
    temConta: false, // comprou com um e-mail, usa a conta com outro
    vinculado: true, // mas alguém já ligou a compra à conta
    entitlement: ATIVO,
    agoraMs: T0_MS + 5 * 24 * HORA,
  });
  assert.deepEqual(d, { ok: false, motivo: "vinculo_feito" });
});

test("(a) trial de R$ 0 NÃO é silenciado: a decisão não olha valor nenhum", () => {
  // 5 dos 7 falsos positivos eram trial, e a tentação é filtrar por valor.
  // Errado: o trial vira cobrança depois, e aí seria um pagante travado
  // invisível pra sempre. O que separa os casos é TEMPO e ESTADO, não dinheiro.
  const trial = podeNotificarOrfao({
    compradoEm: T0,
    temConta: false,
    vinculado: false,
    entitlement: ATIVO,
    agoraMs: T0_MS + 7 * HORA,
  });
  assert.equal(trial.ok, true);
});

test("data de compra ilegível não notifica (falha fechada)", () => {
  for (const ruim of [null, "", "ontem de manhã"]) {
    assert.deepEqual(
      podeNotificarOrfao({ compradoEm: ruim, temConta: false, vinculado: false, entitlement: ATIVO, agoraMs: T0_MS + 99 * HORA }),
      { ok: false, motivo: "sem_data_de_compra" },
    );
  }
});

// ── 8. o sweeper inteiro: carência + releitura + dedupe ─────────────────────

/**
 * Mini-sweeper com as MESMAS duas peças que o `orphan-outreach.ts` usa em
 * produção (`podeNotificarOrfao` e `decidirAcaoConvite`) e um banco falso que
 * pode mudar de resposta entre as rodadas — que é exatamente o que a
 * re-verificação existe pra pegar.
 */
function sweeperFalso(banco: {
  compradoEm: string;
  temConta: boolean;
  vinculado: boolean;
  entitlement?: EstadoEntitlement | null;
}) {
  const EMAIL = "cachico3@hotmail.com";
  const estado: Record<string, RegistroConvite> = {};
  const enviados: string[] = [];
  if (banco.entitlement === undefined) banco.entitlement = ATIVO;
  return {
    banco,
    enviados,
    rodar(agoraMs: number) {
      // releitura do banco AGORA, não da foto do começo da varredura
      if (
        !podeNotificarOrfao({
          compradoEm: banco.compradoEm,
          temConta: banco.temConta,
          vinculado: banco.vinculado,
          entitlement: banco.entitlement ?? null,
          agoraMs,
        }).ok
      ) {
        return;
      }
      const acao = decidirAcaoConvite({
        registro: estado[EMAIL],
        ultimoPagamentoIso: banco.compradoEm,
        agoraMs,
        lembreteAposMs: TRES_DIAS,
      });
      if (acao === "nada") return;
      enviados.push(acao);
      if (acao === "convite") {
        estado[EMAIL] = registroDoConvite(new Date(agoraMs).toISOString(), banco.compradoEm, estado[EMAIL]);
      } else {
        estado[EMAIL].reminder = new Date(agoraMs).toISOString();
      }
    },
  };
}

test("(e) idempotência: rodar o sweeper duas vezes não manda dois avisos", () => {
  const s = sweeperFalso({ compradoEm: T0, temConta: false, vinculado: false });
  s.rodar(T0_MS + 7 * HORA);
  s.rodar(T0_MS + 8 * HORA);
  s.rodar(T0_MS + 20 * HORA);
  assert.deepEqual(s.enviados, ["convite"]);
});

test("(f) órfão real: convite depois da carência, lembrete depois de 3 dias, e para", () => {
  const s = sweeperFalso({ compradoEm: T0, temConta: false, vinculado: false });
  s.rodar(T0_MS + 1 * HORA); // dentro da carência: cala
  assert.deepEqual(s.enviados, []);
  s.rodar(T0_MS + 7 * HORA); // convite
  s.rodar(T0_MS + 4 * 24 * HORA); // lembrete único
  s.rodar(T0_MS + 9 * 24 * HORA); // nada mais
  assert.deepEqual(s.enviados, ["convite", "lembrete"]);
});

test("(b, no sweeper) a conta nasce entre as varreduras: o convite morre na releitura", () => {
  const s = sweeperFalso({ compradoEm: T0, temConta: false, vinculado: false });
  s.rodar(T0_MS + 2 * HORA); // ainda na carência
  s.banco.temConta = true; // a pessoa se cadastrou às 3h
  s.rodar(T0_MS + 7 * HORA); // passou a carência, mas não é mais órfão
  assert.deepEqual(s.enviados, [], "escreveu pra quem já tinha entrado");
});

test("(d, no sweeper) o vínculo chega DEPOIS do convite: o lembrete não sai", () => {
  const s = sweeperFalso({ compradoEm: T0, temConta: false, vinculado: false });
  s.rodar(T0_MS + 7 * HORA);
  assert.deepEqual(s.enviados, ["convite"]);
  s.banco.vinculado = true; // um humano vinculou a compra à conta
  s.rodar(T0_MS + 4 * 24 * HORA);
  assert.deepEqual(s.enviados, ["convite"], "mandou lembrete pra quem já foi resolvido");
});

// ════════════════════════════════════════════════════════════════════════════
// 9. A GUARDA DE ESTADO — o buraco que a carência não fecha (09/09/2026)
//
// A carência de 6h resolve o alerta que dispara em SEGUNDOS. Ela é CEGA pro
// `PURCHASE_COMPLETE`, que a Hotmart manda DIAS depois da compra e passa
// folgado por qualquer carência. Dois casos reais do mesmo dia, ambos com
// COMPLETE 8 dias depois, ambos trial de R$ 0 na origem — o que os separa não
// é tempo nem dinheiro, é o ESTADO do entitlement AGORA.
// ════════════════════════════════════════════════════════════════════════════

const AGORA_09 = Date.parse("2026-09-09T15:00:00.000Z");

/** `gestao10.jessica@gmail.com` (L61J1KMG): trial 01/09, COMPLETE 09/09. */
const JESSICA = {
  compradoEm: "2026-09-01T13:00:00.000Z",
  temConta: false,
  vinculado: false,
  // status 'canceled' e a janela paga já venceu em 08/09: nunca pagou, e o
  // pouco que tinha acabou ontem
  entitlement: { status: "canceled", access_until: "2026-09-08T00:00:00.000Z" } as EstadoEntitlement,
};

/** `ezwaymotors@gmail.com` (7D9WG7J8): trial 25/08, pagou US$ 20 em 01/09. */
const EZ_MOTORS = {
  compradoEm: "2026-08-25T13:00:00.000Z",
  temConta: false,
  vinculado: false,
  entitlement: { status: "active", access_until: "2026-09-25T00:00:00.000Z" } as EstadoEntitlement,
};

test("(1) Jessica: PURCHASE_COMPLETE 8 dias depois, cancelada e com acesso vencido: NÃO notifica", () => {
  // O alerta antigo disse "ele está PAGANDO e SEM ACESSO, tratar como urgente".
  // As DUAS afirmações eram falsas: ela nunca pagou (trial de R$ 0) e o acesso
  // dela já tinha acabado. A carência de 6h não pegou isso — 8 dias passam
  // folgado por ela.
  const d = podeNotificarOrfao({ ...JESSICA, agoraMs: AGORA_09 });
  assert.deepEqual(d, { ok: false, motivo: "acesso_encerrado" });
  // e a carência de fato NÃO era quem estava segurando: já tinha passado há dias
  assert.ok(AGORA_09 - Date.parse(JESSICA.compradoEm) > CARENCIA_ORFAO_MS);
});

test("(2) EZ MOTORS: pagante, entitlement ativo com janela futura e sem vínculo: NOTIFICA", () => {
  // Esse é o órfão de verdade: 8 dias parado, dinheiro entrou, acesso vivo e
  // ninguém do outro lado. Silenciá-lo seria trocar ruído por prejuízo.
  const d = podeNotificarOrfao({ ...EZ_MOTORS, agoraMs: AGORA_09 });
  assert.equal(d.ok, true);
});

test("(3) entitlement ativo mas com access_until já vencido: NÃO notifica", () => {
  const d = podeNotificarOrfao({
    compradoEm: T0,
    temConta: false,
    vinculado: false,
    entitlement: { status: "active", access_until: "2026-09-08T00:00:00.000Z" },
    agoraMs: AGORA_09,
  });
  assert.deepEqual(d, { ok: false, motivo: "acesso_encerrado" });
});

test("(4) trial de R$ 0 que DEPOIS virou pago e segue ativo: NOTIFICA (valor não é a trava)", () => {
  // A tentação continua sendo filtrar por valor, e continua errada: a compra
  // que ancora este caso é a MESMA de R$ 0 do começo (o trial), e mesmo assim
  // ele tem que ser notificado, porque o estado de agora diz que há acesso vivo
  // e sem dono. Quem decide é o entitlement, nunca o preço.
  const d = podeNotificarOrfao({
    compradoEm: "2026-08-25T13:00:00.000Z", // o trial de R$ 0
    temConta: false,
    vinculado: false,
    entitlement: { status: "active", access_until: "2026-10-25T00:00:00.000Z" },
    agoraMs: AGORA_09,
  });
  assert.equal(d.ok, true);
});

test("(5) PURCHASE_COMPLETE 8 dias depois num entitlement válido: a carência NÃO vira cegueira", () => {
  // O medo ao endurecer a guarda é calar o evento tardio junto com o falso
  // positivo. Não cala: como a releitura roda no instante de notificar, o
  // COMPLETE de 8 dias depois é julgado pelo estado de AGORA — e aqui o estado
  // diz "pagante sem acesso", então fala.
  const oitoDias = 8 * 24 * HORA;
  const compradoEm = new Date(AGORA_09 - oitoDias).toISOString();
  const d = podeNotificarOrfao({
    compradoEm,
    temConta: false,
    vinculado: false,
    entitlement: EZ_MOTORS.entitlement,
    agoraMs: AGORA_09,
  });
  assert.equal(d.ok, true, "o evento tardio foi silenciado junto com o falso positivo");
});

test("comprador sem entitlement nenhum: NÃO notifica (falha fechada, não há o que ativar)", () => {
  assert.deepEqual(
    podeNotificarOrfao({ compradoEm: T0, temConta: false, vinculado: false, entitlement: null, agoraMs: AGORA_09 }),
    { ok: false, motivo: "sem_entitlement" },
  );
});

test("refunded/chargeback/expired nunca notificam, mesmo com data futura", () => {
  for (const status of ["refunded", "chargeback", "expired"]) {
    assert.deepEqual(
      podeNotificarOrfao({
        compradoEm: T0,
        temConta: false,
        vinculado: false,
        entitlement: { status, access_until: "2026-12-31T00:00:00.000Z" },
        agoraMs: AGORA_09,
      }),
      { ok: false, motivo: "acesso_encerrado" },
      `${status} não podia notificar`,
    );
  }
});

test("cancelado DENTRO da janela paga: NOTIFICA — a regra é a mesma que abre a porta", () => {
  // Consequência proposital de importar `entitlementValeAcesso` em vez de
  // reescrever "está ativo?" aqui: `canceled` com janela FUTURA tem acesso
  // ("quem pagou fica até o fim do período", corrigido em 20/08). Quem cancela
  // sem nunca ter conseguido entrar cancela JUSTAMENTE por não conseguir
  // entrar — foi essa pessoa que o #127 calou de mais.
  const d = podeNotificarOrfao({
    compradoEm: T0,
    temConta: false,
    vinculado: false,
    entitlement: { status: "canceled", access_until: "2026-10-25T00:00:00.000Z" },
    agoraMs: AGORA_09,
  });
  assert.equal(d.ok, true);
});

test("vitalício (access_until NULL) com status ativo: NOTIFICA", () => {
  const d = podeNotificarOrfao({
    compradoEm: T0,
    temConta: false,
    vinculado: false,
    entitlement: { status: "active", access_until: null },
    agoraMs: AGORA_09,
  });
  assert.equal(d.ok, true);
});

test("conta e vínculo continuam vindo ANTES do estado no motivo (log de quem investiga)", () => {
  const acessoMorto: EstadoEntitlement = { status: "canceled", access_until: "2026-09-08T00:00:00.000Z" };
  assert.deepEqual(
    podeNotificarOrfao({ compradoEm: T0, temConta: true, vinculado: false, entitlement: acessoMorto, agoraMs: AGORA_09 }),
    { ok: false, motivo: "conta_criada" },
  );
  assert.deepEqual(
    podeNotificarOrfao({ compradoEm: T0, temConta: false, vinculado: true, entitlement: acessoMorto, agoraMs: AGORA_09 }),
    { ok: false, motivo: "vinculo_feito" },
  );
  // e o estado vem ANTES da carência: compra de agora mesmo com acesso morto dá
  // o motivo definitivo ("acabou"), não o provisório ("espere mais um pouco")
  assert.deepEqual(
    podeNotificarOrfao({
      compradoEm: new Date(AGORA_09).toISOString(),
      temConta: false,
      vinculado: false,
      entitlement: acessoMorto,
      agoraMs: AGORA_09,
    }),
    { ok: false, motivo: "acesso_encerrado" },
  );
});

test("(no sweeper) o acesso vence entre as varreduras: o lembrete não sai", () => {
  // O convite saiu com a assinatura viva; três dias depois a janela venceu.
  // Mandar "seus créditos continuam reservados" pra quem não tem mais acesso é
  // o #127 com outra fantasia.
  const s = sweeperFalso({ compradoEm: T0, temConta: false, vinculado: false });
  s.rodar(T0_MS + 7 * HORA);
  assert.deepEqual(s.enviados, ["convite"]);
  s.banco.entitlement = { status: "canceled", access_until: "2026-09-09T00:00:00.000Z" };
  s.rodar(T0_MS + 4 * 24 * HORA); // 12/09: a janela venceu em 09/09
  assert.deepEqual(s.enviados, ["convite"], "mandou lembrete pra quem já perdeu o acesso");
});

test("(no sweeper) Jessica não recebe nem o primeiro convite", () => {
  const s = sweeperFalso(JESSICA);
  s.rodar(AGORA_09);
  s.rodar(AGORA_09 + 5 * 24 * HORA);
  assert.deepEqual(s.enviados, []);
});

test("(no sweeper) EZ MOTORS recebe convite e depois o lembrete", () => {
  const s = sweeperFalso(EZ_MOTORS);
  s.rodar(AGORA_09);
  s.rodar(AGORA_09 + 4 * 24 * HORA);
  assert.deepEqual(s.enviados, ["convite", "lembrete"]);
});

// ════════════════════════════════════════════════════════════════════════════
// 10. TRAVA DE RAJADA — o teto que autoriza religar o aviso à equipe
//
// O emissor ficou desligado por um motivo só: existe ESTOQUE. Medidos em
// 09/09/2026, 18 compradores do FastCloner pagaram e não têm conta nenhuma (8
// já com a janela de acesso vencida). Religar sem teto despejaria os 18 no
// Telegram da equipe de uma vez, e alerta às dezenas não é lido.
//
// O teto é a parte fácil. A parte que estes testes protegem é a OUTRA: o que
// não coube não pode sumir, não pode ser marcado como avisado, e tem que ser
// VISÍVEL — senão "avisei 5" vira "só existem 5 casos", que é mentira por
// omissão e pior que a rajada.
// ════════════════════════════════════════════════════════════════════════════

const T_BASE = Date.parse("2026-08-20T00:00:00.000Z");

/** N órfãos, cada um comprado um dia DEPOIS do anterior (0 = o mais antigo). */
function lote(n: number): CandidatoAviso[] {
  return Array.from({ length: n }, (_, i) => ({
    compradoEm: new Date(T_BASE + i * 24 * HORA).toISOString(),
    compra: {
      ...TIAGO,
      buyerEmail: `orfao${String(i).padStart(2, "0")}@exemplo.com`,
      externalId: `SUB${String(i).padStart(2, "0")}`,
    } as CompraOrfa,
  }));
}

const avisados = (visto: { telegram: string[] }) =>
  visto.telegram.map((t) => t.match(/orfao\d\d@exemplo\.com/)?.[0] ?? "?");

test("(a) 20 candidatos com teto 5: avisa 5 e os outros 15 continuam elegíveis na próxima", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io, ver } = estadoNaMemoria();

  const r = await avisarLoteCompraOrfa(lote(20), NOSSO_PRODUTO, io, canais, AGORA, 5, () => {});

  assert.equal(r.candidatos, 20);
  assert.equal(r.avisados, 5, "o teto não segurou a rajada");
  assert.equal(r.emFila, 15, "os 15 que sobraram têm que aparecer na fila");
  assert.equal(r.erros, 0);
  assert.equal(visto.telegram.length, 5, "saiu mais mensagem do que o teto permite");

  // e o estado só conhece os 5 avisados — os 15 estão intactos
  assert.equal(Object.keys(ver()).length, 5);

  // a próxima varredura, com os MESMOS 20 candidatos, pega os 5 seguintes
  const seg = canaisFalsos({ telegram: true, email: true });
  const r2 = await avisarLoteCompraOrfa(lote(20), NOSSO_PRODUTO, io, seg.canais, AGORA, 5, () => {});
  assert.equal(r2.avisados, 5);
  assert.equal(r2.jaAvisados, 5, "os já avisados não podem ocupar vaga do teto");
  assert.equal(r2.emFila, 10);
  assert.deepEqual(avisados(seg.visto), [
    "orfao05@exemplo.com", "orfao06@exemplo.com", "orfao07@exemplo.com",
    "orfao08@exemplo.com", "orfao09@exemplo.com",
  ]);

  // 4 varreduras drenam os 20 sem perder ninguém (é o estoque real de 18)
  for (let i = 0; i < 2; i++) {
    await avisarLoteCompraOrfa(lote(20), NOSSO_PRODUTO, io, canais, AGORA, 5, () => {});
  }
  assert.equal(Object.keys(ver()).length, 20, "alguém sumiu no caminho");
});

test("(b) quem ficou na fila NÃO é marcado como avisado", async () => {
  const { canais } = canaisFalsos({ telegram: true, email: true });
  const { io, ver } = estadoNaMemoria();

  await avisarLoteCompraOrfa(lote(20), NOSSO_PRODUTO, io, canais, AGORA, 5, () => {});

  const marcados = Object.keys(ver()).sort();
  assert.deepEqual(marcados, ["SUB00", "SUB01", "SUB02", "SUB03", "SUB04"]);
  for (let i = 5; i < 20; i++) {
    assert.equal(ver()[`SUB${String(i).padStart(2, "0")}`], undefined, `SUB${i} foi marcado sem ter sido avisado`);
  }
});

test("(b) marcado como avisado ⇔ o durável recebeu o aviso (nunca um sem o outro)", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io, ver } = estadoNaMemoria();

  await avisarLoteCompraOrfa(lote(20), NOSSO_PRODUTO, io, canais, AGORA, 5, () => {});

  assert.deepEqual(visto.duraveis.map((d) => d.chave).sort(), Object.keys(ver()).sort());
});

test("(b) canal volátil todo fora não some: marca (o durável guardou) e DENUNCIA em semCanal", async () => {
  // Telegram e e-mail fora. O aviso não se perde — `registrar` gravou — mas o
  // resumo tem que dizer que ninguém foi acordado, senão é o #239 de novo.
  const { canais, visto } = canaisFalsos({ telegram: false, email: false });
  const { io, ver } = estadoNaMemoria();

  const r = await avisarLoteCompraOrfa(lote(3), NOSSO_PRODUTO, io, canais, AGORA, 5, () => {});

  assert.equal(r.avisados, 3);
  assert.equal(r.semCanal, 3, "falha total de canal passou em branco");
  assert.equal(visto.duraveis.length, 3);
  for (const k of Object.keys(ver())) assert.deepEqual(ver()[k].canais, []);
});

test("(c) o log diz quantos eram, quantos foram e quantos ficaram na fila", async () => {
  const { canais } = canaisFalsos({ telegram: true, email: true });
  const { io } = estadoNaMemoria();
  const linhas: string[] = [];

  const r = await avisarLoteCompraOrfa(lote(18), NOSSO_PRODUTO, io, canais, AGORA, 5, (m) => linhas.push(m));

  assert.equal(linhas.length, 1);
  const log = linhas[0];
  assert.match(log, /18 órfão\(s\) confirmado\(s\)/);
  assert.match(log, /5 avisado\(s\) agora/);
  assert.match(log, /13 NA FILA/);
  // a fila tem que estar escrita como fila, não sumir num número solto
  assert.match(log, /não sumiram/);
  assert.deepEqual({ candidatos: r.candidatos, avisados: r.avisados, emFila: r.emFila }, {
    candidatos: 18, avisados: 5, emFila: 13,
  });
});

test("(c) cap silencioso é proibido: mesmo sem fila o resumo se declara", () => {
  const vazio = { candidatos: 3, jaAvisados: 0, avisados: 3, emFila: 0, semCanal: 0, recusados: 0, erros: 0 };
  assert.match(fraseDaFila(vazio, 5), /3 órfão\(s\) confirmado\(s\)/);
  assert.match(fraseDaFila(vazio, 5), /fila vazia/);
});

test("(d) a fila é do MAIS ANTIGO pro mais novo, não a ordem que chegou", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io } = estadoNaMemoria();

  // embaralhado de propósito: o mais novo primeiro
  const embaralhado = [...lote(9)].reverse();
  await avisarLoteCompraOrfa(embaralhado, NOSSO_PRODUTO, io, canais, AGORA, 4, () => {});

  assert.deepEqual(avisados(visto), [
    "orfao00@exemplo.com", "orfao01@exemplo.com", "orfao02@exemplo.com", "orfao03@exemplo.com",
  ], "quem espera há mais tempo tem que passar na frente");
});

test("(d) data ilegível não fura a fila (vai pro fim) e o desempate é determinístico", () => {
  const bons = lote(3);
  const quebrado: CandidatoAviso = {
    compradoEm: "data-que-não-existe",
    compra: { ...TIAGO, buyerEmail: "zz@exemplo.com", externalId: "SUBZZ" },
  };
  const { avisar, fila } = selecionarParaAvisar([quebrado, ...bons], {}, 3);
  assert.deepEqual(avisar.map((c) => c.compra.externalId), ["SUB00", "SUB01", "SUB02"]);
  assert.deepEqual(fila.map((c) => c.compra.externalId), ["SUBZZ"]);

  // empate de data resolve pela chave, sempre igual (fila que embaralha não drena)
  const empatados: CandidatoAviso[] = ["SUBC", "SUBA", "SUBB"].map((id) => ({
    compradoEm: new Date(T_BASE).toISOString(),
    compra: { ...TIAGO, buyerEmail: `${id}@exemplo.com`, externalId: id },
  }));
  assert.deepEqual(
    selecionarParaAvisar(empatados, {}, 2).avisar.map((c) => c.compra.externalId),
    ["SUBA", "SUBB"],
  );
});

test("(e) duas varreduras seguidas não repetem quem já foi avisado", async () => {
  const { canais } = canaisFalsos({ telegram: true, email: true });
  const { io, ver } = estadoNaMemoria();
  const candidatos = lote(3); // cabem todos no teto

  const r1 = await avisarLoteCompraOrfa(candidatos, NOSSO_PRODUTO, io, canais, AGORA, 5, () => {});
  const seg = canaisFalsos({ telegram: true, email: true });
  const r2 = await avisarLoteCompraOrfa(candidatos, NOSSO_PRODUTO, io, seg.canais, AGORA, 5, () => {});

  assert.equal(r1.avisados, 3);
  assert.equal(r2.avisados, 0, "avisou de novo quem já tinha sido avisado");
  assert.equal(r2.jaAvisados, 3);
  assert.equal(r2.emFila, 0);
  assert.equal(seg.visto.telegram.length, 0);
  assert.equal(Object.keys(ver()).length, 3);
});

test("exceção num candidato não derruba o lote nem marca ele como avisado", async () => {
  const { canais } = canaisFalsos({ telegram: true, email: true });
  const original = canais.registrar;
  canais.registrar = async (chave, aviso, dados) => {
    if (chave === "SUB01") throw new Error("agent_state fora do ar");
    return original(chave, aviso, dados);
  };
  const { io, ver } = estadoNaMemoria();
  const linhas: string[] = [];

  const r = await avisarLoteCompraOrfa(lote(4), NOSSO_PRODUTO, io, canais, AGORA, 5, (m) => linhas.push(m));

  assert.equal(r.avisados, 3);
  assert.equal(r.erros, 1);
  assert.equal(ver()["SUB01"], undefined, "marcou como avisado um caso que falhou");
  assert.ok(linhas.some((l) => l.includes("volta na próxima")), "a falha não apareceu no log");
});

test("teto 0 não avisa ninguém e não perde ninguém (a fila fica com todos)", () => {
  const { avisar, fila } = selecionarParaAvisar(lote(6), {}, 0);
  assert.equal(avisar.length, 0);
  assert.equal(fila.length, 6);
});

test("o teto padrão da casa é 5", () => {
  assert.equal(TETO_AVISOS_POR_VARREDURA, 5);
  const { avisar, fila } = selecionarParaAvisar(lote(18), {});
  assert.equal(avisar.length, 5);
  assert.equal(fila.length, 13);
});
