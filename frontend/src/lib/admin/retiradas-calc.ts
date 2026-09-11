/**
 * Retiradas dos sócios — a parte PURA (sem banco, sem React, sem `@/`).
 * Fica isolada de propósito: é aqui que mora a regra contábil que não pode
 * quebrar, e assim ela roda em `node --test` sem subir nada.
 *
 * REGRA (aprovada pelo Johnny 11/09): retirada de sócio NÃO É DESPESA.
 * Ela nunca entra no "Saiu (gastos)" nem no `totalOut`, e NÃO muda o
 * "Lucro (caixa)". O único número que ela produz é o "Em caixa":
 *
 *     Em caixa = Lucro (caixa) − soma das retiradas do período
 *
 * Corolário testado (`emCaixa` sem retiradas === lucro): se algum dia alguém
 * somar retirada no custo, o teste morre.
 */

/** Sócios que a UI oferece. Entrar um quarto sócio = editar esta lista
 *  (a coluna no banco é texto livre, não precisa de migration). */
export const SOCIOS = ["Johnny", "Lucas", "Eduardo"] as const;
export type Socio = (typeof SOCIOS)[number];

/** Teto de sanidade do campo de valor: R$ 1.000.000,00 por retirada.
 *  Não é regra de negócio, é anti-dedo-gordo (digitar "294700" sem vírgula
 *  zeraria o "Em caixa" e ninguém entenderia por quê). */
export const VALOR_MAXIMO = 1_000_000;

/** Uma retirada como o painel a enxerga (espelha a tabela retiradas_socios). */
export type RetiradaLinha = {
  id: string;
  /** R$. Pode chegar como string do PostgREST em `numeric` — sempre coagir. */
  valor: number | string;
  socio: string;
  retirada_em: string;
  origem: string;
  registrado_por: string | null;
};

/**
 * Lê valor digitado por humano em pt-BR e devolve número, ou null.
 * Aceita "2.947,00", "2947,00", "2947.00", "2947", "R$ 2.947,00".
 * "1.234" (sem decimais, grupo de 3) é lido como milhar → 1234.
 */
export function parseValorBrl(raw: string): number | null {
  let s = String(raw ?? "").trim();
  if (!s) return null;
  s = s.replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!s) return null;

  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    // "1.234.567,89" — ponto é separador de milhar, vírgula é a decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    s = s.replace(",", ".");
  } else if (temPonto && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "2.947" digitado como milhar (sem decimais) — vira 2947, não 2,947.
    s = s.replace(/\./g, "");
  }

  if (!/^-?\d*\.?\d*$/.test(s) || s === "." || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Arredonda pra centavo (evita 2946.9999999 virar linha no banco). */
export function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}

export type RetiradaValida = { ok: true; valor: number; socio: Socio };
export type RetiradaInvalida = { ok: false; erro: string };

/**
 * Valida o que veio do formulário (ou do corpo do POST). Aceita valor como
 * número (API) ou string digitada (UI). Sócio é casado contra SOCIOS sem
 * ligar pra caixa/acentuação de espaço, e devolvido na forma canônica —
 * "johnny " e "Johnny" não podem virar dois sócios diferentes no relatório.
 */
export function validarRetirada(input: { valor: unknown; socio: unknown }): RetiradaValida | RetiradaInvalida {
  const bruto =
    typeof input.valor === "number"
      ? input.valor
      : typeof input.valor === "string"
        ? parseValorBrl(input.valor)
        : null;
  if (bruto === null || !Number.isFinite(bruto)) return { ok: false, erro: "Informe o valor da retirada" };

  const valor = centavos(bruto);
  if (valor <= 0) return { ok: false, erro: "O valor da retirada precisa ser maior que zero" };
  if (valor > VALOR_MAXIMO) {
    return { ok: false, erro: `Valor acima do limite por retirada (máx. ${VALOR_MAXIMO.toLocaleString("pt-BR")})` };
  }

  const alvo = typeof input.socio === "string" ? input.socio.trim().toLowerCase() : "";
  const socio = SOCIOS.find((s) => s.toLowerCase() === alvo);
  if (!socio) return { ok: false, erro: "Selecione o sócio da retirada" };

  return { ok: true, valor, socio };
}

/** Soma as retiradas. Valor não-numérico é ignorado em vez de virar NaN —
 *  uma linha podre não pode apagar o "Em caixa" da tela inteira. */
export function totalRetiradas(linhas: readonly RetiradaLinha[]): number {
  const soma = linhas.reduce((s, l) => {
    const v = typeof l.valor === "number" ? l.valor : Number(l.valor);
    return Number.isFinite(v) ? s + v : s;
  }, 0);
  return centavos(soma);
}

/**
 * O número que o Johnny quer ver: quanto sobrou de verdade.
 * `lucro` é o "Lucro (caixa)" do período, entregue PRONTO pelo backend — esta
 * função não recalcula lucro nenhum, só subtrai o que já foi distribuído.
 */
export function emCaixa(lucro: number, linhas: readonly RetiradaLinha[]): number {
  return centavos(lucro - totalRetiradas(linhas));
}

/**
 * A migration 108 pode não ter sido aplicada (DDL commitado ≠ DDL aplicado).
 * Quando não foi, a tabela não existe e o painel precisa DIZER isso — mostrar
 * "0 retiradas" em silêncio faria o "Em caixa" repetir o lucro e mentir.
 * 42P01 = undefined_table (Postgres); PGRST205 = tabela fora do schema cache.
 */
export function ehTabelaAusente(mensagem: string): boolean {
  const m = String(mensagem ?? "").toLowerCase();
  return (
    m.includes("42p01") ||
    m.includes("pgrst205") ||
    m.includes("does not exist") ||
    m.includes("could not find the table")
  );
}
