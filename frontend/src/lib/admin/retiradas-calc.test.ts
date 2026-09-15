/**
 * `node --test src/lib/admin/retiradas-calc.test.ts`
 *
 * O que estes testes protegem: a REGRA CONTÁBIL das retiradas de sócio.
 * Retirada não é despesa — ela não pode encostar no "Lucro (caixa)". O teste
 * `emCaixa sem retiradas === lucro` é a trava: se alguém somar retirada no
 * custo (ou trocar o sinal), ele quebra.
 *
 * Import com extensão `.ts` e sem alias `@/`: o runner não resolve o alias.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SOCIOS,
  VALOR_MAXIMO,
  centavos,
  ehTabelaAusente,
  emCaixa,
  parseValorBrl,
  totalRetiradas,
  validarRetirada,
  type RetiradaLinha,
} from "./retiradas-calc.ts";

const linha = (valor: number | string, socio = "Johnny"): RetiradaLinha => ({
  id: `${socio}-${valor}`,
  valor,
  socio,
  retirada_em: "2026-09-11T15:00:00.000Z",
  origem: "hotmart",
  registrado_por: "seed:migration-108",
});

/** As três retiradas reais que o seed da migration 108 grava. */
const AS_TRES: RetiradaLinha[] = [linha(2947, "Johnny"), linha(2947, "Lucas"), linha(2947, "Eduardo")];

// ───────── parseValorBrl ─────────

test("parseValorBrl lê o jeito que humano digita em pt-BR", () => {
  assert.equal(parseValorBrl("2.947,00"), 2947);
  assert.equal(parseValorBrl("2947,00"), 2947);
  assert.equal(parseValorBrl("2947.00"), 2947);
  assert.equal(parseValorBrl("2947"), 2947);
  assert.equal(parseValorBrl("R$ 2.947,00"), 2947);
  assert.equal(parseValorBrl("r$2947"), 2947);
  assert.equal(parseValorBrl("1.234.567,89"), 1234567.89);
  assert.equal(parseValorBrl("0,50"), 0.5);
});

test("parseValorBrl trata ponto sozinho: milhar quando é grupo de 3, decimal quando não é", () => {
  assert.equal(parseValorBrl("2.947"), 2947); // milhar
  assert.equal(parseValorBrl("2.9"), 2.9); // decimal
  assert.equal(parseValorBrl("12.50"), 12.5); // decimal (2 casas, não é grupo de 3)
});

test("parseValorBrl devolve null no que não é número", () => {
  assert.equal(parseValorBrl(""), null);
  assert.equal(parseValorBrl("   "), null);
  assert.equal(parseValorBrl("abc"), null);
  assert.equal(parseValorBrl("R$"), null);
  assert.equal(parseValorBrl("-"), null);
  assert.equal(parseValorBrl("1,2,3"), null);
});

// ───────── validarRetirada ─────────

test("validarRetirada aceita a retirada real de R$ 2.947,00", () => {
  const r = validarRetirada({ valor: "2.947,00", socio: "Johnny" });
  assert.deepEqual(r, { ok: true, valor: 2947, socio: "Johnny" });
});

test("validarRetirada aceita valor numérico vindo da API", () => {
  const r = validarRetirada({ valor: 2947, socio: "Eduardo" });
  assert.deepEqual(r, { ok: true, valor: 2947, socio: "Eduardo" });
});

test("validarRetirada canoniza o sócio (caixa e espaço não criam sócio novo)", () => {
  const r = validarRetirada({ valor: 10, socio: "  lucas " });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.socio, "Lucas");
});

test("validarRetirada recusa zero, negativo, lixo e sócio desconhecido", () => {
  for (const v of [0, -1, "0", "-2947", "abc", "", null, undefined, {}]) {
    const r = validarRetirada({ valor: v, socio: "Johnny" });
    assert.equal(r.ok, false, `deveria recusar valor ${JSON.stringify(v)}`);
  }
  assert.equal(validarRetirada({ valor: 10, socio: "Fulano" }).ok, false);
  assert.equal(validarRetirada({ valor: 10, socio: "" }).ok, false);
  assert.equal(validarRetirada({ valor: 10, socio: 42 }).ok, false);
});

test("validarRetirada barra dedo gordo acima do teto", () => {
  assert.equal(validarRetirada({ valor: VALOR_MAXIMO, socio: "Johnny" }).ok, true);
  assert.equal(validarRetirada({ valor: VALOR_MAXIMO + 0.01, socio: "Johnny" }).ok, false);
});

test("validarRetirada arredonda pro centavo", () => {
  const r = validarRetirada({ valor: 10.005, socio: "Johnny" });
  assert.equal(r.ok && r.valor, 10.01);
});

// ───────── totalRetiradas ─────────

test("totalRetiradas soma as três retiradas de R$ 2.947,00 = R$ 8.841,00", () => {
  assert.equal(totalRetiradas(AS_TRES), 8841);
});

test("totalRetiradas aceita numeric como string (PostgREST) e ignora linha podre", () => {
  assert.equal(totalRetiradas([linha("2947.00"), linha("2947.00")]), 5894);
  assert.equal(totalRetiradas([linha(2947), linha("xis")]), 2947);
});

test("totalRetiradas de lista vazia é zero", () => {
  assert.equal(totalRetiradas([]), 0);
});

// ───────── emCaixa — a trava da regra contábil ─────────

test("TRAVA: sem retiradas, Em caixa é EXATAMENTE o lucro (retirada não é despesa)", () => {
  for (const lucro of [0, 1, 12_345.67, -500]) {
    assert.equal(emCaixa(lucro, []), centavos(lucro));
  }
});

test("Em caixa = lucro − retiradas (o número que o Johnny quer ver)", () => {
  assert.equal(emCaixa(20_000, AS_TRES), 11_159); // 20.000 − 8.841
  assert.equal(emCaixa(8841, AS_TRES), 0);
});

test("Em caixa fica negativo quando se retirou mais do que o lucro do período", () => {
  assert.equal(emCaixa(5000, AS_TRES), -3841);
});

test("Em caixa não vira NaN com lucro negativo (prejuízo no período)", () => {
  const r = emCaixa(-1000, AS_TRES);
  assert.equal(Number.isFinite(r), true);
  assert.equal(r, -9841);
});

test("Em caixa fecha em centavos sem erro de ponto flutuante", () => {
  assert.equal(emCaixa(0.3, [linha(0.1), linha(0.1), linha(0.1)]), 0);
});

// ───────── ehTabelaAusente ─────────

test("ehTabelaAusente reconhece os dois jeitos do Supabase dizer que a tabela não existe", () => {
  assert.equal(ehTabelaAusente('relation "public.retiradas_socios" does not exist'), true);
  assert.equal(ehTabelaAusente("42P01"), true);
  assert.equal(
    ehTabelaAusente("Could not find the table 'public.retiradas_socios' in the schema cache"),
    true,
  );
  assert.equal(ehTabelaAusente("PGRST205"), true);
});

test("ehTabelaAusente não confunde erro comum com migration faltando", () => {
  assert.equal(ehTabelaAusente("JWT expired"), false);
  assert.equal(ehTabelaAusente("timeout"), false);
  assert.equal(ehTabelaAusente(""), false);
});

// ───────── sanidade da lista de sócios ─────────

test("SOCIOS são os três do acordo, sem repetição", () => {
  assert.deepEqual([...SOCIOS], ["Johnny", "Lucas", "Eduardo"]);
  assert.equal(new Set(SOCIOS).size, SOCIOS.length);
});
