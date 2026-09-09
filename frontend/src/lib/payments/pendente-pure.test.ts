/**
 * Testes da regra ÚNICA do aviso de pagamento pendente (incidente #319).
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/pendente-pure.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE: a regra vivia duplicada — a versão certa no
 * `/app/layout.tsx` e uma versão crua (`pending_payment_at ? ... : ...`) no
 * contexto da Fast. Duplicata não tem como divergir "com barulho": os dois
 * lados compilam, os dois lados renderizam, e a diferença só aparece quando um
 * aluno é mandado pagar um código morto. Foi o que aconteceu.
 *
 * AS DATAS SÃO REAIS. Os 12 perfis abaixo são a varredura de `profiles` feita
 * em 09/09/2026 com o critério do chamado #319: `pending_payment_at` fora da
 * janela de 3 dias E `access_until`/`access_source` os DOIS nulos.
 * `lucas.m.arrial@gmail.com` (o sócio) e `duartesoaresconsultor@gmail.com`
 * (o caso que abriu o chamado) estão na lista.
 *
 * ⚠️ 12 é um PISO, não o alcance. Rodando esta função contra o banco inteiro,
 * o null check cru afirmava a pendência pros 130 perfis que têm a flag, e a
 * regra certa silencia 107 (101 com o código já vencido, 5 que já tinham
 * acesso ativo, 1 da equipe). A diferença é o critério de acesso: a varredura
 * do chamado só via `access_until` NULO, e `hasActiveAccess` também lê
 * `access_until` VENCIDO como sem acesso. Os 12 continuam aqui porque são
 * datas reais e conferidas — não porque sejam o total.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { avisoPagamentoPendenteAtivo, JANELA_AVISO_PENDENTE_MS } from "./pendente-pure.ts";

/** Relógio fixo: prazo testado com relógio real vira teste que quebra sozinho. */
const AGORA = new Date("2026-09-09T18:00:00Z").getTime();
const DIA = 24 * 60 * 60 * 1000;
const haDias = (d: number) => new Date(AGORA - d * DIA).toISOString();

/** Aluno comum sem acesso: o cenário do incidente. */
const semAcesso = { temAcesso: false, bypassaCobranca: false, agora: AGORA };

test("(a) pendente há 1 dia e sem acesso → avisa", () => {
  assert.equal(
    avisoPagamentoPendenteAtivo({ pendingPaymentAt: haDias(1), ...semAcesso }),
    true,
  );
});

test("(b) pendente há 9 dias e sem acesso (caso Duarte) → NÃO avisa", () => {
  assert.equal(
    avisoPagamentoPendenteAtivo({
      pendingPaymentAt: "2026-08-31T13:13:51.213+00:00", // valor real do perfil b1006494
      ...semAcesso,
    }),
    false,
  );
});

test("(c) pendente recente mas JÁ tem acesso → NÃO avisa (o pagamento caiu)", () => {
  assert.equal(
    avisoPagamentoPendenteAtivo({
      pendingPaymentAt: haDias(1),
      temAcesso: true,
      bypassaCobranca: false,
      agora: AGORA,
    }),
    false,
  );
});

test("(d) sem pendência → NÃO avisa", () => {
  for (const vazio of [null, undefined, "", "   "]) {
    assert.equal(
      avisoPagamentoPendenteAtivo({ pendingPaymentAt: vazio, ...semAcesso }),
      false,
      `pendingPaymentAt=${JSON.stringify(vazio)} não pode virar aviso`,
    );
  }
});

test("equipe/admin (bypassa cobrança) nunca vê aviso, mesmo com pendência fresca", () => {
  assert.equal(
    avisoPagamentoPendenteAtivo({
      pendingPaymentAt: haDias(0.1),
      temAcesso: false,
      bypassaCobranca: true,
      agora: AGORA,
    }),
    false,
  );
});

test("a janela é de 3 dias: 1ms antes avisa, na borda exata não avisa", () => {
  const quaseFora = new Date(AGORA - JANELA_AVISO_PENDENTE_MS + 1).toISOString();
  const naBorda = new Date(AGORA - JANELA_AVISO_PENDENTE_MS).toISOString();
  assert.equal(avisoPagamentoPendenteAtivo({ pendingPaymentAt: quaseFora, ...semAcesso }), true);
  assert.equal(avisoPagamentoPendenteAtivo({ pendingPaymentAt: naBorda, ...semAcesso }), false);
  assert.equal(JANELA_AVISO_PENDENTE_MS, 3 * DIA);
});

test("data ilegível NÃO vira aviso (não inventa cobrança a partir de lixo)", () => {
  for (const lixo of ["ontem", "0000-13-45", "não é data"]) {
    assert.equal(
      avisoPagamentoPendenteAtivo({ pendingPaymentAt: lixo, ...semAcesso }),
      false,
      `${lixo} não pode virar aviso`,
    );
  }
});

test("data no futuro (skew de relógio) CONTINUA avisando — paridade com o banner antigo", () => {
  // Quem acabou de gerar o Pix é justamente quem precisa do aviso. Um guard de
  // "idade negativa" pareceria mais correto e esconderia o banner nesse instante.
  const daquiA10s = new Date(AGORA + 10_000).toISOString();
  assert.equal(avisoPagamentoPendenteAtivo({ pendingPaymentAt: daquiA10s, ...semAcesso }), true);
});

/**
 * O TESTE QUE PEGA O BUG: os 12 perfis medidos em 09/09/2026. Com a regra
 * certa, NENHUM deles é avisado. Com o null check cru que morava no
 * `account.ts` (`!!pending_payment_at`), TODOS os 12 eram — e a Fast dizia a
 * cada um deles que bastava pagar o Pix.
 */
const PENDENCIAS_VENCIDAS_09_09 = [
  ["itabenke@gmail.com", "2026-09-02T13:59:08.361+00:00"],
  ["rosayelma@gmail.com", "2026-09-01T14:16:01.905+00:00"],
  ["duartesoaresconsultor@gmail.com", "2026-08-31T13:13:51.213+00:00"],
  ["wtxsolucoes@gmail.com", "2026-08-30T14:00:29.379+00:00"],
  ["lucas.m.arrial@gmail.com", "2026-08-30T13:43:52.021+00:00"],
  ["tikomuscl@gmail.com", "2026-08-23T13:46:26.428+00:00"],
  ["richargam@gmail.com", "2026-08-21T13:57:36.829+00:00"],
  ["clinicanutrisecrets@gmail.com", "2026-08-21T13:55:08.324+00:00"],
  ["carlamsmpro@gmail.com", "2026-08-18T15:45:52.357+00:00"],
  ["maykonrapacci@gmail.com", "2026-08-10T17:35:14.501+00:00"],
  ["casatumca@gmail.com", "2026-07-28T14:48:39.236+00:00"],
  ["info.claudiamonteiro@gmail.com", "2026-07-14T18:32:50.366+00:00"],
] as const;

test("os 12 perfis reais com pendência vencida: a regra certa não avisa nenhum", () => {
  const avisados = PENDENCIAS_VENCIDAS_09_09.filter(([, at]) =>
    avisoPagamentoPendenteAtivo({ pendingPaymentAt: at, ...semAcesso }),
  ).map(([email]) => email);

  assert.deepEqual(avisados, [], "ninguém com Pix vencido pode ser mandado pagar");
  assert.equal(PENDENCIAS_VENCIDAS_09_09.length, 12);
});

test("a regra ANTIGA do account.ts avisaria os 12 — é a regressão que este arquivo trava", () => {
  const regraAntiga = (pendingPaymentAt: string) => !!pendingPaymentAt;
  const avisados = PENDENCIAS_VENCIDAS_09_09.filter(([, at]) => regraAntiga(at));
  assert.equal(avisados.length, 12, "confirma que o null check cru pegava todos os 12");
});
