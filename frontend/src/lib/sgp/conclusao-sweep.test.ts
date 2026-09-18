/**
 * SGP — o FECHAMENTO AUTOMÁTICO do atendimento (recado 6, requisito 5).
 *
 * A régua dos 7 dias já é testada em `entrega.test.ts`. Aqui é o BRAÇO: o que
 * a varredura lê, o que ela escreve, e — sobretudo — o que ela se recusa a
 * escrever. Cada teste tem um jeito concreto de isto dar errado por trás:
 *
 *  1. ENSAIO é o padrão. Sem `SGP_CONCLUSAO_AUTOMATICA=1` ela CONTA e não grava
 *     — porque ligar fechamento em massa sem ninguém ter visto o número é
 *     exatamente o tipo de ação que esta casa não faz;
 *  2. ligada, ela grava com AUTOR PRÓPRIO, pra tela nunca dizer que uma pessoa
 *     olhou um caso que só venceu no relógio;
 *  3. sem a migration 110 ela fica INERTE e diz por quê (não há onde gravar, e
 *     sem `concluido_em` nem dá pra saber quem o time já concluiu);
 *  4. o TETO por rodada existe e o que ficou pra trás SAI NO RELATÓRIO —
 *     truncar em silêncio faria "3 fechados" parecer "só havia 3";
 *  5. na CORRIDA com um atendente, quem chegou primeiro fica: a declaração de
 *     gente não é sobrescrita pela do relógio, e isso não conta como erro;
 *  6. sem carimbo de aviso ela NUNCA fecha — arquivar quem não foi avisado é o
 *     defeito que o recado 6 veio consertar, não um que ele pode criar;
 *  7. a coluna da 118 pode não existir: a escrita cai pra sem-ela e a TELA
 *     continua sabendo que foi automático, pelo sentinela.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   cd frontend && node --test src/lib/sgp/conclusao-sweep.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONCLUSAO_AUTOMATICA_TETO_POR_VARREDURA,
  varrerConclusaoAutomatica,
} from "./conclusao-sweep.ts";
import {
  SGP_CONCLUSAO_AUTOMATICA_AUTOR,
  lerConclusao,
  montarLinha,
  resumir,
} from "./painel.ts";
import type { SgpPedidoRow } from "./types.ts";

const H = 60 * 60 * 1000;
const D = 24 * H;
const AGORA = new Date("2026-09-16T12:00:00Z").getTime();

/** Um pedido ENTREGUE há 10 dias: pronto, avisado, sem erro, sem conclusão. */
function pedido(over: Partial<SgpPedidoRow> = {}): SgpPedidoRow {
  return {
    id: "p-1",
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
    criado_em: new Date(AGORA - 30 * D).toISOString(),
    atualizado_em: new Date(AGORA - 11 * D).toISOString(),
    status: "pronto",
    ciencia_foto: null,
    ciencia_foto_at: null,
    ciencia_audio: null,
    ciencia_audio_at: null,
    aceite_lgpd_at: null,
    fotos: [],
    audios: [],
    enviado_em: new Date(AGORA - 12 * D).toISOString(),
    foto_pronta_em: null,
    voz_pronta_em: null,
    voice_id: null,
    erro: null,
    concluido_em: null,
    concluido_por: null,
    concluido_motivo: null,
    concluido_automatico: false,
    ...over,
  };
}

/** O carimbo de aviso do SISTEMA, que é o que `buscarAvisos` lê em `profiles`. */
const AVISO_PADRAO = new Date(AGORA - 10 * D).toISOString();

type Opcoes = {
  /** Colunas que NÃO existem no banco (simula migration não aplicada). */
  ausentes?: readonly string[];
  /** `profiles.onboarding_ready_email_at` por user_id. */
  avisos?: Record<string, string | null>;
  /** Rodar antes de cada UPDATE — pra simular a corrida com um atendente. */
  antesDeGravar?: (linhas: SgpPedidoRow[]) => void;
};

/**
 * Fake do PostgREST que simula um `UPDATE ... WHERE` de verdade: aplica o patch
 * só nas linhas que casam com TODOS os filtros (inclusive o `.is`) e devolve as
 * afetadas — que é exatamente o sinal em que a guarda de corrida se apoia.
 */
function bancoFake(linhas: SgpPedidoRow[], opcoes: Opcoes = {}) {
  const ausentes = new Set(opcoes.ausentes ?? []);
  const updates: Array<Record<string, unknown>> = [];
  const selects: string[] = [];
  const valorDe = (l: SgpPedidoRow, c: string) => (l as unknown as Record<string, unknown>)[c];

  const erroColuna = (coluna: string) => ({
    data: null,
    error: { code: "42703", message: `column sgp_pedidos.${coluna} does not exist` },
  });

  const admin = {
    from(tabela: string) {
      return {
        select(colunas: string) {
          if (tabela === "profiles") {
            return {
              in(_coluna: string, ids: readonly string[]) {
                const mapa = opcoes.avisos ?? {};
                return Promise.resolve({
                  data: ids.map((id) => ({
                    id,
                    onboarding_ready_email_at: mapa[id] ?? null,
                  })),
                  error: null,
                });
              },
            };
          }
          selects.push(colunas);
          const pedidas = colunas.split(",").map((c) => c.trim());
          const faltando = pedidas.find((c) => ausentes.has(c));
          const eqs: Array<[string, unknown]> = [];
          const builder = {
            eq(coluna: string, valor: unknown) {
              eqs.push([coluna, valor]);
              return builder;
            },
            order() {
              return builder;
            },
            limit() {
              if (faltando) return Promise.resolve(erroColuna(faltando));
              const achadas = linhas
                .filter((l) => eqs.every(([c, v]) => valorDe(l, c) === v))
                // Só devolve as colunas pedidas, como o PostgREST faria.
                .map((l) => {
                  const recorte: Record<string, unknown> = {};
                  for (const c of pedidas) recorte[c] = valorDe(l, c);
                  return recorte as unknown as SgpPedidoRow;
                });
              return Promise.resolve({ data: achadas, error: null });
            },
          };
          return builder;
        },
        update(valores: Record<string, unknown>) {
          const eqs: Array<[string, unknown]> = [];
          const nulos: string[] = [];
          const builder = {
            eq(coluna: string, valor: unknown) {
              eqs.push([coluna, valor]);
              return builder;
            },
            is(coluna: string, valor: null) {
              assert.equal(valor, null, "só usamos .is(coluna, null)");
              nulos.push(coluna);
              return builder;
            },
            select() {
              const escritas = Object.keys(valores).find((c) => ausentes.has(c));
              if (escritas) return Promise.resolve(erroColuna(escritas));
              opcoes.antesDeGravar?.(linhas);
              const afetadas = linhas.filter(
                (l) =>
                  eqs.every(([c, v]) => valorDe(l, c) === v) &&
                  nulos.every((c) => valorDe(l, c) === null || valorDe(l, c) === undefined),
              );
              for (const l of afetadas) Object.assign(l, valores);
              updates.push(valores);
              return Promise.resolve({ data: afetadas.map((l) => ({ id: l.id })), error: null });
            },
          };
          return builder;
        },
      };
    },
  };

  return { admin: admin as unknown as SupabaseClient<never>, updates, selects, linhas };
}

/** Liga/desliga o interruptor só para o bloco, sem vazar pros outros testes. */
async function com<T>(valor: string | undefined, fn: () => Promise<T>): Promise<T> {
  const antes = process.env.SGP_CONCLUSAO_AUTOMATICA;
  if (valor === undefined) delete process.env.SGP_CONCLUSAO_AUTOMATICA;
  else process.env.SGP_CONCLUSAO_AUTOMATICA = valor;
  try {
    return await fn();
  } finally {
    if (antes === undefined) delete process.env.SGP_CONCLUSAO_AUTOMATICA;
    else process.env.SGP_CONCLUSAO_AUTOMATICA = antes;
  }
}

/* ===========================================================================
 * 1) O PADRÃO É ENSAIO — conta e NÃO grava
 * ========================================================================= */

test("sem o interruptor é ENSAIO: conta os elegíveis e não escreve nada", async () => {
  const linhas = [pedido()];
  const { admin, updates } = bancoFake(linhas, { avisos: { "user-1": AVISO_PADRAO } });

  const r = await com(undefined, () => varrerConclusaoAutomatica(admin, AGORA));

  assert.equal(r.ligado, false);
  assert.equal(r.disponivel, true);
  assert.equal(r.examinados, 1);
  assert.equal(r.elegiveis, 1);
  assert.equal(r.concluidos, 0, "ensaio NÃO pode gravar");
  assert.equal(updates.length, 0, "ensaio NÃO pode mandar UPDATE");
  assert.equal(linhas[0].concluido_em, null);
  assert.match(r.observacao ?? "", /ENSAIO/);
  assert.match(r.observacao ?? "", /SGP_CONCLUSAO_AUTOMATICA=1/);
  // O relatório diz QUEM fecharia, não só quantos — senão não dá pra conferir.
  assert.deepEqual(r.casos.map((c) => c.email), ["f@x.com"]);
});

test("valor torto no interruptor cai no ensaio (nunca no fechamento)", async () => {
  const linhas = [pedido()];
  const { admin, updates } = bancoFake(linhas, { avisos: { "user-1": AVISO_PADRAO } });
  const r = await com("talvez", () => varrerConclusaoAutomatica(admin, AGORA));
  assert.equal(r.ligado, false);
  assert.equal(updates.length, 0);
});

/* ===========================================================================
 * 2) LIGADA — grava, e grava com autor próprio
 * ========================================================================= */

test("ligada, fecha o caso com autor próprio e o motivo da régua", async () => {
  const linhas = [pedido()];
  const { admin, updates } = bancoFake(linhas, { avisos: { "user-1": AVISO_PADRAO } });

  const r = await com("1", () => varrerConclusaoAutomatica(admin, AGORA));

  assert.equal(r.ligado, true);
  assert.equal(r.elegiveis, 1);
  assert.equal(r.concluidos, 1);
  assert.equal(r.erros, 0);
  assert.equal(updates.length, 1);

  // O autor NUNCA pode parecer gente: é o sentinela, exato.
  assert.equal(linhas[0].concluido_por, SGP_CONCLUSAO_AUTOMATICA_AUTOR);
  assert.equal(linhas[0].concluido_automatico, true);
  assert.ok(linhas[0].concluido_em, "gravou o carimbo");
  assert.match(String(linhas[0].concluido_motivo), /ninguém registrou reclamação/);

  // ⚠️ E NÃO mexe em `status`: a máquina de estados da produção dispara e-mail
  // pro aluno nas transições dela. Anotação de suporte não pode encostar ali.
  assert.equal(linhas[0].status, "pronto");
  assert.equal(Object.keys(updates[0]).some((k) => k === "status"), false);
});

/* ===========================================================================
 * 3) SEM A 110 — inerte, e dizendo por quê
 * ========================================================================= */

test("sem a migration 110 a varredura é INERTE e explica o motivo", async () => {
  const linhas = [pedido()];
  const { admin, updates } = bancoFake(linhas, {
    ausentes: ["concluido_em", "concluido_por", "concluido_motivo"],
    avisos: { "user-1": AVISO_PADRAO },
  });

  const r = await com("1", () => varrerConclusaoAutomatica(admin, AGORA));

  assert.equal(r.disponivel, false);
  assert.equal(r.elegiveis, 0, "não roda a régua sobre dado que não dá pra estar certo");
  assert.equal(r.concluidos, 0);
  assert.equal(updates.length, 0);
  assert.match(r.observacao ?? "", /110/);
  assert.match(r.observacao ?? "", /inerte/i);
});

/* ===========================================================================
 * 4) O TETO — e o que ele deixou pra trás aparece
 * ========================================================================= */

test("o teto por rodada limita a escrita E declara quantos ficaram pra depois", async () => {
  const quantos = CONCLUSAO_AUTOMATICA_TETO_POR_VARREDURA + 7;
  const avisos: Record<string, string> = {};
  const linhas = Array.from({ length: quantos }, (_, i) => {
    avisos[`user-${i}`] = AVISO_PADRAO;
    return pedido({ id: `p-${i}`, user_id: `user-${i}`, email: `a${i}@x.com` });
  });
  const { admin, updates } = bancoFake(linhas, { avisos });

  const r = await com("1", () => varrerConclusaoAutomatica(admin, AGORA));

  assert.equal(r.elegiveis, quantos, "o relatório conta TODOS os elegíveis");
  assert.equal(r.concluidos, CONCLUSAO_AUTOMATICA_TETO_POR_VARREDURA);
  assert.equal(r.adiados, 7, "truncar em silêncio faria parecer que só havia o teto");
  assert.equal(updates.length, CONCLUSAO_AUTOMATICA_TETO_POR_VARREDURA);
  assert.equal(linhas.filter((l) => l.concluido_em).length, CONCLUSAO_AUTOMATICA_TETO_POR_VARREDURA);
});

/* ===========================================================================
 * 5) A CORRIDA — a declaração de gente não é sobrescrita
 * ========================================================================= */

test("atendente que conclui entre a leitura e a escrita GANHA, e isso não é erro", async () => {
  const linhas = [pedido()];
  const { admin } = bancoFake(linhas, {
    avisos: { "user-1": AVISO_PADRAO },
    // Um clique humano chega DEPOIS da leitura e ANTES do UPDATE.
    antesDeGravar: (ls) => {
      ls[0].concluido_em = new Date(AGORA - 1 * H).toISOString();
      ls[0].concluido_por = "atendente@fastcloner.com";
      ls[0].concluido_motivo = "resolvido no WhatsApp";
    },
  });

  const r = await com("1", () => varrerConclusaoAutomatica(admin, AGORA));

  assert.equal(r.elegiveis, 1);
  assert.equal(r.concluidos, 0, "a linha já não se qualificava");
  assert.equal(r.erros, 0, "perder a corrida NÃO é falha");
  // O rastro de quem tratou o caso continua inteiro.
  assert.equal(linhas[0].concluido_por, "atendente@fastcloner.com");
  assert.equal(linhas[0].concluido_motivo, "resolvido no WhatsApp");
});

/* ===========================================================================
 * 6) NUNCA arquiva quem não foi avisado
 * ========================================================================= */

test("sem carimbo de aviso não fecha, mesmo com o clone pronto há 30 dias", async () => {
  const linhas = [pedido({ atualizado_em: new Date(AGORA - 30 * D).toISOString() })];
  // `profiles` responde sem carimbo: ninguém avisou o aluno.
  const { admin, updates } = bancoFake(linhas, { avisos: { "user-1": null } });

  const r = await com("1", () => varrerConclusaoAutomatica(admin, AGORA));

  assert.equal(r.elegiveis, 0);
  assert.equal(r.concluidos, 0);
  assert.equal(updates.length, 0);
  assert.equal(linhas[0].concluido_em, null);
});

test("aviso ANTERIOR ao envio deste ciclo não conta, e o caso não fecha", async () => {
  // O aluno refez o SGP: o carimbo do ciclo velho não pode fechar o novo.
  const linhas = [pedido()];
  const { admin } = bancoFake(linhas, {
    avisos: { "user-1": new Date(AGORA - 20 * D).toISOString() }, // antes do enviado_em (12d)
  });
  const r = await com("1", () => varrerConclusaoAutomatica(admin, AGORA));
  assert.equal(r.elegiveis, 0);
  assert.equal(linhas[0].concluido_em, null);
});

test("erro registrado trava o fechamento, mesmo passados os 7 dias", async () => {
  const linhas = [pedido({ erro: "voz falhou" })];
  const { admin } = bancoFake(linhas, { avisos: { "user-1": AVISO_PADRAO } });
  const r = await com("1", () => varrerConclusaoAutomatica(admin, AGORA));
  assert.equal(r.elegiveis, 0);
  assert.equal(linhas[0].concluido_em, null);
});

/* ===========================================================================
 * 7) A 118 pode não existir — a escrita cai, a TELA continua honesta
 * ========================================================================= */

test("sem a coluna da 118 ainda fecha, e o sentinela mantém a tela sabendo", async () => {
  const linhas = [pedido({ concluido_automatico: undefined })];
  const { admin } = bancoFake(linhas, {
    ausentes: ["concluido_automatico"],
    avisos: { "user-1": AVISO_PADRAO },
  });

  const r = await com("1", () => varrerConclusaoAutomatica(admin, AGORA));

  assert.equal(r.concluidos, 1);
  assert.equal(r.erros, 0);
  assert.equal(linhas[0].concluido_por, SGP_CONCLUSAO_AUTOMATICA_AUTOR);
  assert.equal(linhas[0].concluido_automatico, undefined, "a coluna não existe");

  // E mesmo assim a tela sabe que foi automático — pelo sentinela, por
  // IGUALDADE EXATA. É o ponto da constante compartilhada.
  const linha = montarLinha(linhas[0], AGORA, undefined, null);
  assert.equal(linha.concluidoAutomatico, true);
});

/* ===========================================================================
 * 8) A TELA — um caso que ninguém olhou não pode parecer um caso tratado
 * ========================================================================= */

test("a linha diz FECHADO AUTOMATICAMENTE e não atribui o fechamento a ninguém", () => {
  const p = pedido({
    concluido_em: new Date(AGORA - 3 * H).toISOString(),
    concluido_por: SGP_CONCLUSAO_AUTOMATICA_AUTOR,
    concluido_motivo: "Entregue há 10 dias (mais de 7 dias) e ninguém registrou reclamação.",
    concluido_automatico: true,
  });

  const fim = lerConclusao(p, AGORA);
  assert.ok(fim);
  assert.equal(fim.automatica, true);
  assert.equal(fim.superada, false);

  const l = montarLinha(p, AGORA, undefined, { em: AVISO_PADRAO, canal: "e-mail", por: "o sistema" });
  assert.equal(l.concluido, true);
  assert.equal(l.concluidoAutomatico, true);
  assert.match(l.concluidoTexto ?? "", /fechado automaticamente/);
  assert.match(l.concluidoTexto ?? "", /ninguém do time olhou/);
  // A frase de ação não pode dar a alguém o crédito de ter tratado o caso.
  assert.match(l.oQueFazer, /fechou sozinho/);
  assert.match(l.oQueFazer, /reabrir/);
  assert.equal(l.oQueFazer.includes(SGP_CONCLUSAO_AUTOMATICA_AUTOR), false);
});

test("conclusão de GENTE continua nomeando a pessoa (o teste que impede o exagero)", () => {
  const p = pedido({
    concluido_em: new Date(AGORA - 3 * H).toISOString(),
    concluido_por: "atendente@fastcloner.com",
    concluido_motivo: "aluno foi reembolsado",
    concluido_automatico: false,
  });
  const l = montarLinha(p, AGORA, undefined, null);
  assert.equal(l.concluidoAutomatico, false);
  assert.match(l.concluidoTexto ?? "", /por atendente@fastcloner\.com/);
  assert.match(l.oQueFazer, /atendente@fastcloner\.com concluiu este atendimento/);
});

test("o resumo separa o que o relógio fechou do que o time fechou", () => {
  const doRelogio = pedido({
    id: "p-auto",
    concluido_em: new Date(AGORA - 3 * H).toISOString(),
    concluido_por: SGP_CONCLUSAO_AUTOMATICA_AUTOR,
    concluido_automatico: true,
  });
  const doTime = pedido({
    id: "p-gente",
    concluido_em: new Date(AGORA - 3 * H).toISOString(),
    concluido_por: "atendente@fastcloner.com",
    concluido_automatico: false,
  });
  const aberto = pedido({ id: "p-aberto" });

  const r = resumir([doRelogio, doTime, aberto].map((p) => montarLinha(p, AGORA, undefined, null)));
  assert.equal(r.concluidos, 2);
  assert.equal(r.concluidosAutomaticamente, 1);
});
