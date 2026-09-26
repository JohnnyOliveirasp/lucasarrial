/**
 * VARREDURA DE `payment_events.error` QUE ABRE CHAMADO SOZINHA — #582c.
 *
 * O módulo tem UM trabalho: tornar visível o que o webhook já gravava e ninguém
 * lia. Então o que estes testes protegem não é "a função roda", é cada jeito
 * concreto de ela voltar a MENTIR — e todo jeito aqui já aconteceu de verdade
 * nesta casa:
 *
 *  1. CLASSIFICAÇÃO espelhando o `.cjs` prefixo por prefixo. Se as duas
 *     divergirem, a mesma varredura passa a dizer duas coisas diferentes
 *     dependendo de quem a roda — e a manual é a que o time já conhece;
 *  2. a FRONTEIRA do `externalId não casa`: com assinatura viva é reassinatura
 *     (ruído), sem ela é cancelamento sem dono (acionável). Errar o lado
 *     transforma 79 linhas de ruído em fila de trabalho, ou esconde um caso real;
 *  3. RUÍDO nunca abre cartão. Fila que grita ruído é ignorada na segunda
 *     semana — foi assim que o campo `error` morreu da primeira vez (#324);
 *  4. IDEMPOTÊNCIA pela assinatura: a varredura relê 7 dias DE HORA EM HORA. Se
 *     a mesma pessoa virasse cartão novo a cada volta, a fila teria 168 cópias
 *     do mesmo caso por semana;
 *  5. `desconhecido` agrupado por FAMÍLIA, não por pessoa: é o balde do que ela
 *     não sabe ler, e uma redação nova tem que aparecer UMA vez, não N;
 *  6. o TETO corta o MENOS grave e DECLARA o que ficou pra trás. Teto silencioso
 *     se lê como "cobri tudo" e mente;
 *  7. consulta que falha ABORTA. Degradar pra lista vazia é literalmente o
 *     incidente 72a4c9db: a guarda viu 0 linha, concluiu "ninguém tem conta" e
 *     mandou "crie sua conta" pra 105 clientes ATIVOS;
 *  8. PAGINAÇÃO de verdade: o PostgREST corta `.select()` sem `.range()` em 1000
 *     linhas EM SILÊNCIO. O banco falso aqui HONRA o `range`, então uma
 *     regressão que pare de paginar aparece como caso perdido, não como teoria;
 *  9. o TEXTO do cartão carrega as armadilhas medidas. Sem elas o cartão FABRICA
 *     VÍTIMA — cada frase corresponde a um lote de gente tratada como lesada sem
 *     ser (os 147 falsos de 18/08, os 4 de 25/09, a classe do #333).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   cd frontend && node --test src/lib/payments/varredura-erros-webhook.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types.ts";
import type { ChamadoReportado } from "../incidents/reportar.ts";
import {
  CLASSE_RUIDO,
  JANELA_DIAS,
  TETO_CHAMADOS_POR_EXECUCAO,
  chaveDaFamilia,
  classificarErro,
  varrerErrosDoWebhook,
} from "./varredura-erros-webhook.ts";

const D = 24 * 60 * 60 * 1000;
const AGORA = new Date("2026-09-25T12:00:00Z").getTime();

/** As mensagens CRUAS, exatamente como o webhook as grava (acentos incluídos). */
const ERRO = {
  sgp_nao_saiu: "boas-vindas do SGP não saíram: SMTP recusou",
  sgp_desistiu: "boas-vindas do SGP desistiram depois de 3 tentativas",
  sgp_falhou: "boas-vindas do SGP falharam: link inválido",
  sgp_sem_conta: "conta do SGP não criada: e-mail já existe em auth",
  orfa_paga: "compra órfã paga sem aviso novo (ja_avisado) entitlement: ABC123",
  compra_orfa: "compra órfã sem canal de aviso: sem whatsapp e sem e-mail",
  revoke_sem_id: "externalId não extraído do payload de cancelamento",
  revoke_nao_casa: "externalId não casa com entitlement: XYZ789",
};

type EventoFake = {
  id: string;
  buyer_email: string | null;
  error: string | null;
  received_at: string;
};
type EntFake = {
  id: string;
  buyer_email: string;
  status: string;
  access_until: string | null;
};

let seq = 0;
/** Um `payment_events` com erro, 1 dia atrás, do `a@x.com`. */
function evento(error: string | null, over: Partial<EventoFake> = {}): EventoFake {
  seq += 1;
  return {
    // zero-padded: a ordem estável do `.order("id")` é o contrato da paginação.
    id: `pe-${String(seq).padStart(6, "0")}`,
    buyer_email: "a@x.com",
    error,
    received_at: new Date(AGORA - 1 * D).toISOString(),
    ...over,
  };
}

/** Um entitlement ATIVO e VIVO (vence em 30 dias) do e-mail dado. */
function entitlement(buyer_email: string, over: Partial<EntFake> = {}): EntFake {
  seq += 1;
  return {
    id: `en-${String(seq).padStart(6, "0")}`,
    buyer_email,
    status: "active",
    access_until: new Date(AGORA + 30 * D).toISOString(),
    ...over,
  };
}

type OpcoesBanco = {
  eventos?: EventoFake[];
  entitlements?: EntFake[];
  /** Faz a consulta daquela tabela devolver erro, pra provar que a varredura ABORTA. */
  falha?: { tabela: "payment_events" | "entitlements"; message: string };
};

/**
 * Fake do PostgREST que HONRA os filtros e o `range`.
 *
 * Honrar o `range` é o ponto: um fake que devolvesse tudo de uma vez passaria
 * igual com e sem paginação, e o teto silencioso de 1000 linhas voltaria sem
 * ninguém ver. E ele EXIGE `.order()` antes de `.range()`, que é o contrato
 * escrito em `paginate.ts` — sem ordem estável as páginas repetem ou pulam linha.
 */
function bancoFake(opcoes: OpcoesBanco = {}) {
  const dados: Record<string, Record<string, unknown>[]> = {
    payment_events: (opcoes.eventos ?? []) as unknown as Record<string, unknown>[],
    entitlements: (opcoes.entitlements ?? []) as unknown as Record<string, unknown>[],
  };
  /** Quantas requisições cada tabela levou — é como se vê a paginação acontecer. */
  const paginas: Record<string, number> = { payment_events: 0, entitlements: 0 };
  /** Os blocos de e-mail que a 2ª consulta perguntou, na ordem. */
  const blocosDeEmail: string[][] = [];

  function builder(tabela: string) {
    const filtros: Array<(r: Record<string, unknown>) => boolean> = [];
    let ordenadoPor: string | null = null;

    const b = {
      /** Só usamos `.not(col, "is", null)` = `col is not null`. */
      not(col: string, op: string, valor: unknown) {
        assert.equal(op, "is");
        assert.equal(valor, null);
        filtros.push((r) => r[col] !== null && r[col] !== undefined);
        return b;
      },
      gt(col: string, valor: unknown) {
        filtros.push((r) => String(r[col]) > String(valor));
        return b;
      },
      eq(col: string, valor: unknown) {
        filtros.push((r) => r[col] === valor);
        return b;
      },
      in(col: string, valores: readonly unknown[]) {
        if (col === "buyer_email") blocosDeEmail.push(valores as string[]);
        const conjunto = new Set(valores);
        filtros.push((r) => conjunto.has(r[col]));
        return b;
      },
      order(col: string) {
        ordenadoPor = col;
        return b;
      },
      range(from: number, to: number) {
        paginas[tabela] += 1;
        if (opcoes.falha?.tabela === tabela) {
          return Promise.resolve({ data: null, error: { message: opcoes.falha.message } });
        }
        assert.ok(
          ordenadoPor,
          `${tabela}: .range() sem .order() — página que repete ou pula linha (contrato do paginate.ts)`,
        );
        const achadas = dados[tabela]
          .filter((r) => filtros.every((f) => f(r)))
          .sort((x, y) => String(x[ordenadoPor as string]).localeCompare(String(y[ordenadoPor as string])));
        return Promise.resolve({ data: achadas.slice(from, to + 1), error: null });
      },
    };
    return b;
  }

  const admin = {
    from(tabela: string) {
      return {
        select() {
          return builder(tabela);
        },
      };
    },
  };

  return { admin: admin as unknown as SupabaseClient<Database>, paginas, blocosDeEmail };
}

/** Abridor de chamado falso: guarda o que teria sido aberto. */
function coletor() {
  const chamados: ChamadoReportado[] = [];
  return {
    chamados,
    abrirChamado: async (c: ChamadoReportado) => {
      chamados.push(c);
      return chamados.length;
    },
  };
}

/** Atalho: roda a varredura com o relógio travado e o abridor falso. */
async function varrer(opcoes: OpcoesBanco = {}) {
  const banco = bancoFake(opcoes);
  const { chamados, abrirChamado } = coletor();
  const sumario = await varrerErrosDoWebhook(banco.admin, { abrirChamado, agora: AGORA });
  return { sumario, chamados, ...banco };
}

/* ===========================================================================
 * 1) A CLASSIFICAÇÃO — espelho do `.cjs`, prefixo por prefixo
 * ========================================================================= */

test("cada família de mensagem sai na classe certa (mesmos prefixos do .cjs)", () => {
  assert.equal(classificarErro(ERRO.sgp_nao_saiu, false), "sgp_nao_recebeu");
  assert.equal(classificarErro(ERRO.sgp_desistiu, false), "sgp_nao_recebeu");
  assert.equal(classificarErro(ERRO.sgp_falhou, false), "sgp_nao_recebeu");
  assert.equal(classificarErro(ERRO.sgp_sem_conta, false), "sgp_sem_conta");
  assert.equal(classificarErro(ERRO.orfa_paga, false), "orfa_paga_calada");
  assert.equal(classificarErro(ERRO.compra_orfa, false), "compra_orfa");
  assert.equal(classificarErro(ERRO.revoke_sem_id, false), "revoke_sem_id");
  assert.equal(classificarErro("qualquer coisa nova que ninguém previu", false), "desconhecido");
});

test("a classificação NÃO depende de assinatura viva fora da fronteira do revoke", () => {
  // Só `externalId não casa` olha o entitlement. Se outra classe passasse a
  // olhar, um comprador com assinatura viva viraria ruído e desapareceria —
  // exatamente o caso do #582: pagou, tem entitlement, e não tem conta nenhuma.
  assert.equal(classificarErro(ERRO.orfa_paga, true), "orfa_paga_calada");
  assert.equal(classificarErro(ERRO.sgp_nao_saiu, true), "sgp_nao_recebeu");
  assert.equal(classificarErro(ERRO.sgp_sem_conta, true), "sgp_sem_conta");
});

/* ===========================================================================
 * 2) A FRONTEIRA — `externalId não casa` com e sem assinatura viva
 * ========================================================================= */

test("externalId não casa COM assinatura viva = ruído (reassinatura)", () => {
  assert.equal(classificarErro(ERRO.revoke_nao_casa, true), CLASSE_RUIDO);
});

test("externalId não casa SEM assinatura viva = revoke_sem_dono (acionável)", () => {
  assert.equal(classificarErro(ERRO.revoke_nao_casa, false), "revoke_sem_dono");
});

test("a fronteira do revoke lida do BANCO: o mesmo erro cai nos dois lados", async () => {
  const r = await varrer({
    eventos: [
      evento(ERRO.revoke_nao_casa, { buyer_email: "vivo@x.com" }),
      evento(ERRO.revoke_nao_casa, { buyer_email: "morto@x.com" }),
    ],
    // só o `vivo@x.com` tem assinatura ativa e viva
    entitlements: [entitlement("vivo@x.com")],
  });

  assert.equal(r.sumario.por_classe[CLASSE_RUIDO], 1);
  assert.equal(r.sumario.por_classe.revoke_sem_dono, 1);
  assert.equal(r.sumario.ruido, 1);
  // UM cartão só, e é do que não tem assinatura viva.
  assert.equal(r.chamados.length, 1);
  assert.deepEqual(r.chamados[0].affectedEmails, ["morto@x.com"]);
  assert.equal(r.chamados[0].cause, "revoke_sem_dono");
});

test("access_until NULO é vitalício, e vitalício conta como assinatura VIVA", async () => {
  const r = await varrer({
    eventos: [evento(ERRO.revoke_nao_casa, { buyer_email: "vital@x.com" })],
    entitlements: [entitlement("vital@x.com", { access_until: null })],
  });
  assert.equal(r.sumario.ruido, 1, "vitalício não pode virar cancelamento sem dono");
  assert.equal(r.chamados.length, 0);
});

test("entitlement VENCIDO não é assinatura viva: vira revoke_sem_dono", async () => {
  const r = await varrer({
    eventos: [evento(ERRO.revoke_nao_casa, { buyer_email: "venceu@x.com" })],
    entitlements: [
      entitlement("venceu@x.com", { access_until: new Date(AGORA - 1 * D).toISOString() }),
    ],
  });
  assert.equal(r.sumario.ruido, 0);
  assert.equal(r.sumario.por_classe.revoke_sem_dono, 1);
  assert.equal(r.chamados.length, 1);
});

test("entitlement que não está `active` não segura o caso como ruído", async () => {
  const r = await varrer({
    eventos: [evento(ERRO.revoke_nao_casa, { buyer_email: "cancelado@x.com" })],
    entitlements: [entitlement("cancelado@x.com", { status: "canceled" })],
  });
  assert.equal(r.sumario.ruido, 0);
  assert.equal(r.chamados.length, 1);
});

/* ===========================================================================
 * 3) O RUÍDO NUNCA ABRE CARTÃO — ele só é contado
 * ========================================================================= */

test("ruído de reassinatura é CONTADO e não abre chamado nenhum", async () => {
  const eventos = Array.from({ length: 12 }, (_, i) =>
    evento(ERRO.revoke_nao_casa, { buyer_email: `r${i}@x.com` }),
  );
  const r = await varrer({
    eventos,
    entitlements: eventos.map((e) => entitlement(e.buyer_email as string)),
  });

  assert.equal(r.sumario.total, 12);
  assert.equal(r.sumario.ruido, 12);
  assert.equal(r.sumario.grupos_elegiveis, 0);
  assert.equal(r.chamados.length, 0, "79 linhas de ruído na fila é como o campo `error` morreu");
});

/* ===========================================================================
 * 4) IDEMPOTÊNCIA — a mesma pessoa na mesma classe é UMA assinatura
 * ========================================================================= */

test("duas ocorrências do mesmo (classe, e-mail) dão UMA assinatura, não duas", async () => {
  const r = await varrer({
    eventos: [
      evento(ERRO.sgp_nao_saiu, {
        buyer_email: "dup@x.com",
        received_at: new Date(AGORA - 5 * D).toISOString(),
      }),
      evento(ERRO.sgp_falhou, {
        buyer_email: "dup@x.com",
        received_at: new Date(AGORA - 1 * D).toISOString(),
      }),
    ],
  });

  assert.equal(r.sumario.total, 2);
  assert.equal(r.sumario.grupos_elegiveis, 1);
  assert.equal(r.chamados.length, 1, "a varredura relê 7 dias de hora em hora: dobrar aqui inunda a fila");
  assert.equal(r.chamados[0].signature, "webhook-error:sgp_nao_recebeu:dup@x.com");
  // O sample acompanha a ocorrência MAIS RECENTE: é a redação de agora que diz
  // se o defeito mudou de forma.
  assert.equal(r.chamados[0].sampleError, ERRO.sgp_falhou);
});

test("o e-mail entra na assinatura em MINÚSCULO, senão a mesma pessoa vira dois cartões", async () => {
  const r = await varrer({
    eventos: [
      evento(ERRO.sgp_sem_conta, { buyer_email: "Maria@X.com" }),
      evento(ERRO.sgp_sem_conta, { buyer_email: "maria@x.com" }),
    ],
  });
  assert.equal(r.chamados.length, 1);
  assert.equal(r.chamados[0].signature, "webhook-error:sgp_sem_conta:maria@x.com");
});

test("classes DIFERENTES da mesma pessoa são cartões diferentes (problemas diferentes)", async () => {
  const r = await varrer({
    eventos: [
      evento(ERRO.sgp_sem_conta, { buyer_email: "dois@x.com" }),
      evento(ERRO.orfa_paga, { buyer_email: "dois@x.com" }),
    ],
  });
  assert.equal(r.chamados.length, 2);
  assert.deepEqual(
    r.chamados.map((c) => c.signature).sort(),
    ["webhook-error:orfa_paga_calada:dois@x.com", "webhook-error:sgp_sem_conta:dois@x.com"],
  );
});

/* ===========================================================================
 * 5) `desconhecido` — agrupado por FAMÍLIA, não por pessoa
 * ========================================================================= */

test("a chave de família normaliza caixa e DÍGITOS (id/contador não fazem família nova)", () => {
  assert.equal(
    chaveDaFamilia("Falhou ao gravar pedido 12345 na fila"),
    chaveDaFamilia("falhou ao gravar pedido 99999 na fila"),
  );
  assert.notEqual(chaveDaFamilia("erro de rede no gateway"), chaveDaFamilia("erro de disco no gateway"));
});

test("`desconhecido` de duas pessoas na MESMA família dá UM cartão com os 2 e-mails", async () => {
  const r = await varrer({
    eventos: [
      evento("timeout falando com o gateway (tentativa 3)", { buyer_email: "p1@x.com" }),
      evento("timeout falando com o gateway (tentativa 9)", { buyer_email: "p2@x.com" }),
    ],
  });

  assert.equal(r.sumario.por_classe.desconhecido, 2);
  assert.equal(r.chamados.length, 1, "uma redação nova aparece UMA vez, não uma por pessoa");
  assert.equal(r.chamados[0].cause, "desconhecido");
  assert.deepEqual(r.chamados[0].affectedEmails?.slice().sort(), ["p1@x.com", "p2@x.com"]);
  assert.ok(r.chamados[0].signature.startsWith("webhook-error:desconhecido:"));
  // O dígito virou `#` — é o que faz as duas serem a MESMA família.
  assert.ok(r.chamados[0].signature.includes("#"));
});

test("`desconhecido` de FAMÍLIAS diferentes continua dando cartões diferentes", async () => {
  const r = await varrer({
    eventos: [
      evento("timeout falando com o gateway", { buyer_email: "p1@x.com" }),
      evento("disco cheio ao gravar o recibo", { buyer_email: "p2@x.com" }),
    ],
  });
  assert.equal(r.chamados.length, 2, "duas doenças novas não podem virar um cartão só");
});

test("classe NOMEADA sem buyer_email é CONTADA, não engolida", async () => {
  // Não dá pra assinar um cartão por pessoa sem pessoa. Mas sumir em silêncio é
  // o defeito que esta varredura veio consertar, então fica no sumário.
  const r = await varrer({ eventos: [evento(ERRO.sgp_sem_conta, { buyer_email: null })] });
  assert.equal(r.sumario.sem_email_ignorados, 1);
  assert.equal(r.chamados.length, 0);
});

/* ===========================================================================
 * 6) O TETO — corta o menos grave e DECLARA o que ficou pra trás
 * ========================================================================= */

test("o teto corta, e o sumário + o log dizem QUANTOS e de QUAIS classes ficaram fora", async () => {
  const sobra = 3;
  const quantos = TETO_CHAMADOS_POR_EXECUCAO + sobra;
  // Uma órfã paga (a MAIS grave, ordem 0) + o resto em revoke_sem_dono (ordem 4).
  const eventos = [
    evento(ERRO.orfa_paga, { buyer_email: "grave@x.com" }),
    ...Array.from({ length: quantos - 1 }, (_, i) =>
      evento(ERRO.revoke_nao_casa, { buyer_email: `n${String(i).padStart(3, "0")}@x.com` }),
    ),
  ];

  const r = await varrer({ eventos }); // sem entitlements: nada é ruído

  assert.equal(r.sumario.grupos_elegiveis, quantos, "o sumário conta TODOS os grupos");
  assert.equal(r.chamados.length, TETO_CHAMADOS_POR_EXECUCAO);
  assert.equal(r.sumario.chamados_abertos, TETO_CHAMADOS_POR_EXECUCAO);
  assert.equal(r.sumario.cortados_pelo_teto, sobra, "teto silencioso se lê como `cobri tudo`");
  assert.deepEqual(r.sumario.cortados_por_classe, { revoke_sem_dono: sobra });

  // A MAIS GRAVE não pode ser a cortada: quem espera há 22 dias sem conta não
  // fica atrás de um defeito de parsing.
  assert.equal(r.chamados[0].cause, "orfa_paga_calada");
  assert.ok(
    r.chamados.some((c) => c.signature === "webhook-error:orfa_paga_calada:grave@x.com"),
    "a órfã paga tem que estar DENTRO do teto",
  );
});

test("empatada a gravidade, o teto preserva o MAIS VELHO (quem espera há mais tempo)", async () => {
  const quantos = TETO_CHAMADOS_POR_EXECUCAO + 1;
  const eventos = Array.from({ length: quantos }, (_, i) =>
    evento(ERRO.revoke_nao_casa, {
      buyer_email: `v${String(i).padStart(3, "0")}@x.com`,
      // i=0 é o mais VELHO (22 dias dentro da janela não cabe; usamos 6 dias)
      received_at: new Date(AGORA - (6 * D - i * 60_000)).toISOString(),
    }),
  );

  const r = await varrer({ eventos });

  assert.equal(r.sumario.cortados_pelo_teto, 1);
  const abertos = new Set(r.chamados.map((c) => c.affectedEmails?.[0]));
  assert.ok(abertos.has("v000@x.com"), "o mais velho tem que ser atendido");
  assert.equal(abertos.has(`v${String(quantos - 1).padStart(3, "0")}@x.com`), false);
});

test("sem estourar o teto, `cortados_por_classe` fica VAZIO (e não some do sumário)", async () => {
  const r = await varrer({ eventos: [evento(ERRO.sgp_sem_conta)] });
  assert.equal(r.sumario.cortados_pelo_teto, 0);
  assert.deepEqual(r.sumario.cortados_por_classe, {});
});

/* ===========================================================================
 * 7) CONSULTA QUE FALHA ABORTA — não degrada pra lista vazia
 * ========================================================================= */

test("erro na consulta de payment_events ABORTA a varredura", async () => {
  const banco = bancoFake({
    eventos: [evento(ERRO.orfa_paga)],
    falha: { tabela: "payment_events", message: "connection reset by peer" },
  });
  const { chamados, abrirChamado } = coletor();

  await assert.rejects(
    () => varrerErrosDoWebhook(banco.admin, { abrirChamado, agora: AGORA }),
    /connection reset by peer/,
    "degradar pra lista vazia é o incidente 72a4c9db (105 clientes ativos)",
  );
  assert.equal(chamados.length, 0);
});

test("erro na consulta de entitlements ABORTA — e não promove ruído a cartão", async () => {
  // Sem a 2ª consulta não se sabe quem tem assinatura viva. Seguir em frente
  // trataria TODO `externalId não casa` como cancelamento sem dono e abriria
  // cartão pra 79 reassinaturas legítimas. Melhor não dizer nada.
  const banco = bancoFake({
    eventos: [evento(ERRO.revoke_nao_casa, { buyer_email: "vivo@x.com" })],
    entitlements: [entitlement("vivo@x.com")],
    falha: { tabela: "entitlements", message: "statement timeout" },
  });
  const { chamados, abrirChamado } = coletor();

  await assert.rejects(
    () => varrerErrosDoWebhook(banco.admin, { abrirChamado, agora: AGORA }),
    /statement timeout/,
  );
  assert.equal(chamados.length, 0);
});

test("cartão que não grava não esconde os outros: conta em `erros` e segue", async () => {
  const banco = bancoFake({
    eventos: [
      evento(ERRO.orfa_paga, { buyer_email: "a1@x.com" }),
      evento(ERRO.orfa_paga, { buyer_email: "a2@x.com" }),
    ],
  });
  let n = 0;
  const sumario = await varrerErrosDoWebhook(banco.admin, {
    agora: AGORA,
    abrirChamado: async () => {
      n += 1;
      if (n === 1) throw new Error("índice único recusou");
      return 7;
    },
  });
  assert.equal(sumario.erros, 1);
  assert.equal(sumario.chamados_abertos, 1, "o segundo cartão tem que ter sido tentado");
});

/* ===========================================================================
 * 8) PAGINAÇÃO DE VERDADE — o corte silencioso de 1000 linhas
 * ========================================================================= */

test("passa de 1000 linhas e NÃO perde ninguém (o corte silencioso do PostgREST)", async () => {
  // 1001 pessoas distintas em `sgp_sem_conta`: sem paginar, a 1001ª desaparece
  // e a varredura conclui, confiante, que ela não existe.
  const eventos = Array.from({ length: 1001 }, (_, i) =>
    evento(ERRO.sgp_sem_conta, { buyer_email: `m${String(i).padStart(4, "0")}@x.com` }),
  );

  const r = await varrer({ eventos });

  assert.equal(r.sumario.total, 1001, "as 1001 linhas foram lidas");
  assert.equal(r.sumario.grupos_elegiveis, 1001);
  assert.ok(r.paginas.payment_events >= 2, "precisou de mais de uma página");
  // O teto continua valendo: ele corta, mas o sumário confessa o tamanho real.
  assert.equal(r.sumario.chamados_abertos, TETO_CHAMADOS_POR_EXECUCAO);
  assert.equal(r.sumario.cortados_pelo_teto, 1001 - TETO_CHAMADOS_POR_EXECUCAO);
});

test("a 2ª consulta pergunta só pelos e-mails DISTINTOS da janela", async () => {
  const r = await varrer({
    eventos: [
      evento(ERRO.revoke_nao_casa, { buyer_email: "x@x.com" }),
      evento(ERRO.revoke_nao_casa, { buyer_email: "x@x.com" }),
      evento(ERRO.revoke_nao_casa, { buyer_email: "y@x.com" }),
      evento(ERRO.sgp_sem_conta, { buyer_email: null }),
    ],
  });
  assert.equal(r.blocosDeEmail.length, 1);
  assert.deepEqual(r.blocosDeEmail[0].slice().sort(), ["x@x.com", "y@x.com"]);
});

test("a janela é de 7 dias e o que é mais velho que ela não entra", async () => {
  assert.equal(JANELA_DIAS, 7);
  const r = await varrer({
    eventos: [
      evento(ERRO.orfa_paga, {
        buyer_email: "dentro@x.com",
        received_at: new Date(AGORA - 6 * D).toISOString(),
      }),
      evento(ERRO.orfa_paga, {
        buyer_email: "fora@x.com",
        received_at: new Date(AGORA - 8 * D).toISOString(),
      }),
    ],
  });
  assert.equal(r.sumario.total, 1);
  assert.deepEqual(r.chamados[0].affectedEmails, ["dentro@x.com"]);
});

/* ===========================================================================
 * 9) O TEXTO DO CARTÃO — sem as armadilhas ele FABRICA VÍTIMA
 * ========================================================================= */

test("todo cartão carrega as TRÊS armadilhas medidas", async () => {
  const r = await varrer({ eventos: [evento(ERRO.sgp_nao_saiu, { buyer_email: "arm@x.com" })] });
  const d = r.chamados[0].description;

  assert.match(d, /pagou_de_verdade\.cjs/, "R$0 é TRIAL e não conta como compra paga (#333)");
  assert.match(d, /R\$0/);
  assert.match(d, /access_until vivo NÃO prova que a pessoa entrou/, "os 147 falsos de 18/08");
  assert.match(d, /last_sign_in_at NÃO serve pra comprador de SGP/, "4 falsos medidos em 25/09");
});

test("a órfã paga calada ganha a armadilha do relógio (caso #207) e diz que é PRODUÇÃO", async () => {
  const r = await varrer({ eventos: [evento(ERRO.orfa_paga, { buyer_email: "orfa@x.com" })] });
  const d = r.chamados[0].description;
  assert.match(d, /#207/);
  assert.match(d, /vence com a pessoa/);
  assert.match(d, /leve ao Johnny|leve pro Johnho|leve pro Johnny/i);
});

test("as outras classes NÃO recebem a armadilha do #207 (ela é da órfã paga)", async () => {
  const r = await varrer({ eventos: [evento(ERRO.revoke_sem_id, { buyer_email: "tec@x.com" })] });
  assert.equal(/#207/.test(r.chamados[0].description), false);
});

test("os campos do chamado são os que a fila espera (fonte, categoria, kind, cause)", async () => {
  const r = await varrer({ eventos: [evento(ERRO.compra_orfa, { buyer_email: "campo@x.com" })] });
  const c = r.chamados[0];
  assert.equal(c.reportedBy, "varredura-webhook");
  assert.equal(c.categoria, "tecnico", "em toda classe existe ação NOSSA");
  assert.equal(c.kind, "webhook_error");
  assert.equal(c.cause, "compra_orfa");
  assert.equal(c.signature, "webhook-error:compra_orfa:campo@x.com");
  assert.deepEqual(c.affectedEmails, ["campo@x.com"]);
  assert.ok(c.title.length > 0);
});

test("a mensagem CRUA vai inteira no sampleError (nada de truncar abaixo de 400)", async () => {
  // Cartão cego é cartão que não se resolve: quem atende precisa da mensagem
  // como o webhook a escreveu.
  const longo = `${ERRO.sgp_nao_saiu} :: ${"detalhe ".repeat(80)}fim`;
  assert.ok(longo.length > 400);
  const r = await varrer({ eventos: [evento(longo, { buyer_email: "cru@x.com" })] });
  assert.equal(r.chamados[0].sampleError, longo);
  assert.match(r.chamados[0].description, /fim/);
});

test("o cartão declara que a varredura SÓ LÊ — ela não concedeu nem estornou nada", async () => {
  const r = await varrer({ eventos: [evento(ERRO.orfa_paga, { buyer_email: "so@x.com" })] });
  assert.match(r.chamados[0].description, /SÓ LÊ|só lê/);
  assert.match(r.chamados[0].description, /varrer_erros_webhook\.cjs/, "aponta pra leitura à mão");
});

/* ===========================================================================
 * 10) A JANELA VAZIA — silêncio não pode parecer varredura morta
 * ========================================================================= */

test("janela sem erro nenhum devolve sumário zerado, e não explode", async () => {
  const r = await varrer({ eventos: [] });
  assert.equal(r.sumario.total, 0);
  assert.equal(r.sumario.grupos_elegiveis, 0);
  assert.equal(r.sumario.chamados_abertos, 0);
  assert.equal(r.sumario.erros, 0);
  assert.equal(r.sumario.janela_dias, JANELA_DIAS);
  assert.equal(r.chamados.length, 0);
  // Não perguntou entitlement de ninguém: não havia e-mail pra perguntar.
  assert.equal(r.blocosDeEmail.length, 0);
});
