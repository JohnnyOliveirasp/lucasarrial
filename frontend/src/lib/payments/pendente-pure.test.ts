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
 * o null check cru afirmava "PENDENTE aguardando pagamento" pros 129 perfis
 * que têm a flag; com a regra certa sobram 23 ativos, 100 viram "vencido" e 6
 * ficam em silêncio (5 já tinham acesso, 1 é da equipe). A diferença pro
 * número do chamado é o critério de acesso: a varredura do chamado só via
 * `access_until` NULO, e `hasActiveAccess` também lê `access_until` VENCIDO
 * como sem acesso. Os 12 continuam aqui porque são datas reais e conferidas —
 * não porque sejam o total.
 *
 * ⚠️ AS DATAS SÃO LITERAIS DE PROPÓSITO, não leitura do banco. O perfil do
 * Duarte, por exemplo, teve o `pending_payment_at` zerado depois da abertura
 * do card. Um teste que lesse o banco viraria verde sozinho quando o dado
 * mudasse, justamente escondendo a regressão que ele existe pra travar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avisoPagamentoPendenteAtivo,
  diasDesde,
  estadoAvisoPendente,
  JANELA_AVISO_PENDENTE_MS,
} from "./pendente-pure.ts";

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

/* ────────────────────────────────────────────────────────────────────────────
 * O TERCEIRO ESTADO ("vencido") — reconciliação com o PR #218.
 *
 * A primeira versão desta regra devolvia só `boolean`, e por isso a linha de
 * pendência SUMIA quando o código vencia. O #218, aberto no mesmo incidente,
 * apontou o custo disso: a Fast é atendente e a cobrança morta é o que EXPLICA
 * a falta de acesso — apagá-la devolve a agente ao escuro que gerou o #198.
 *
 * Os testes abaixo travam a distinção que resolve os dois lados: "não existe
 * cobrança" e "existe uma cobrança, morta" NÃO podem colapsar no mesmo estado.
 * ──────────────────────────────────────────────────────────────────────────── */

test("vencido ≠ nenhum: o Duarte tem cobrança MORTA, não ausência de cobrança", () => {
  // O caso que abriu o #319. O boolean dizia só "não avisa" e a Fast ficava sem
  // saber que existiu cobrança; o estado diz POR QUE ele está sem acesso.
  assert.equal(
    estadoAvisoPendente({
      pendingPaymentAt: "2026-08-31T13:13:51.213+00:00", // perfil b1006494
      ...semAcesso,
    }),
    "vencido",
  );
  assert.equal(
    estadoAvisoPendente({ pendingPaymentAt: null, ...semAcesso }),
    "nenhum",
    "sem cobrança nenhuma é um fato DIFERENTE de cobrança vencida",
  );
});

test("os 3 estados na régua da janela de 3 dias", () => {
  const quaseFora = new Date(AGORA - JANELA_AVISO_PENDENTE_MS + 1).toISOString();
  const naBorda = new Date(AGORA - JANELA_AVISO_PENDENTE_MS).toISOString();
  assert.equal(estadoAvisoPendente({ pendingPaymentAt: haDias(1), ...semAcesso }), "ativo");
  assert.equal(estadoAvisoPendente({ pendingPaymentAt: quaseFora, ...semAcesso }), "ativo");
  assert.equal(estadoAvisoPendente({ pendingPaymentAt: naBorda, ...semAcesso }), "vencido");
  assert.equal(estadoAvisoPendente({ pendingPaymentAt: haDias(57), ...semAcesso }), "vencido");
});

test("quem PAGOU (ou é da equipe) não recebe nem 'vencido' — não há falta de acesso a explicar", () => {
  // Este é o limite do argumento do #218: a cobrança morta só é contexto útil
  // enquanto existe falta de acesso pra explicar. Com acesso ativo, mencionar
  // cobrança é o pior caso — foi o que atingiu 5 perfis medidos em 09/09.
  assert.equal(
    estadoAvisoPendente({
      pendingPaymentAt: haDias(57),
      temAcesso: true,
      bypassaCobranca: false,
      agora: AGORA,
    }),
    "nenhum",
  );
  assert.equal(
    estadoAvisoPendente({
      pendingPaymentAt: haDias(57),
      temAcesso: false,
      bypassaCobranca: true, // lucas.m.arrial@gmail.com, o sócio
      agora: AGORA,
    }),
    "nenhum",
  );
});

test("data ilegível vira 'nenhum', NUNCA 'vencido' (não se afirma vencimento a partir de lixo)", () => {
  for (const lixo of ["ontem", "0000-13-45", "não é data", "", "   "]) {
    assert.equal(
      estadoAvisoPendente({ pendingPaymentAt: lixo, ...semAcesso }),
      "nenhum",
      `${JSON.stringify(lixo)} não pode virar afirmação de cobrança vencida`,
    );
  }
});

test("o banner do /app continua desenhando SÓ o 'ativo' (comportamento intacto)", () => {
  // A regra passou a ter 3 estados, mas o //app não mudou de comportamento:
  // quem vence some da tela do aluno, exatamente como antes do #319.
  for (const at of [haDias(1), haDias(57), null, "lixo"]) {
    assert.equal(
      avisoPagamentoPendenteAtivo({ pendingPaymentAt: at, ...semAcesso }),
      estadoAvisoPendente({ pendingPaymentAt: at, ...semAcesso }) === "ativo",
      `o wrapper do banner tem que ser exatamente estado === "ativo" (at=${at})`,
    );
  }
});

test("os 12 perfis reais: NENHUM é 'ativo' e TODOS os 12 são 'vencido'", () => {
  // O mesmo conjunto do teste acima, agora provando o outro lado: além de não
  // mandar ninguém pagar, a Fast passa a SABER que os 12 têm cobrança morta.
  const estados = PENDENCIAS_VENCIDAS_09_09.map(([, at]) =>
    estadoAvisoPendente({ pendingPaymentAt: at, ...semAcesso }),
  );
  assert.deepEqual(
    estados.filter((e) => e !== "vencido"),
    [],
    "os 12 têm cobrança morta — nem paga, nem inexistente",
  );
  assert.equal(estados.length, 12);
});

test("diasDesde mede a idade da cobrança (é o que dá tamanho ao problema)", () => {
  assert.equal(diasDesde(haDias(57), AGORA), 57);
  assert.equal(diasDesde(haDias(0.5), AGORA), 0);
  // O pior caso vivo medido em 09/09: Pix de 14/07 ainda anunciado como pagável.
  assert.equal(diasDesde("2026-07-14T18:32:50.366+00:00", AGORA), 56);
  for (const vazio of [null, undefined, "", "lixo"]) {
    assert.equal(diasDesde(vazio, AGORA), null, `${JSON.stringify(vazio)} não vira idade`);
  }
});
