/**
 * Retiradas dos sócios — camada de dados (server-only, service_role).
 * A regra e as contas moram em `retiradas-calc.ts` (puro, testado).
 *
 * ⚠️ A migration `scripts/113_retiradas_socios.sql` pode NÃO estar aplicada.
 * Quando não está, a leitura devolve `tabelaAusente: true` em vez de explodir —
 * e o painel DIZ isso na tela. Degradar pra "0 retiradas" em silêncio seria
 * pior que o erro: o "Em caixa" repetiria o lucro e mentiria pro Johnny.
 */
import { getAdmin } from "@/lib/db/admin";
import { fetchAllPages } from "@/lib/db/paginate";
import type { RetiradaSocioRow } from "@/lib/db/types";
import type { DateRange } from "./queries";
import { ehTabelaAusente, totalRetiradas } from "./retiradas-calc";

const COLUNAS = "id, valor, socio, retirada_em, origem, registrado_por, criado_em";

export type ListaRetiradas = {
  retiradas: RetiradaSocioRow[];
  /** true = migration 108 ainda não foi rodada no banco. */
  tabelaAusente: boolean;
};

/**
 * Retiradas com `retirada_em` dentro de [since, until) — a MESMA janela de
 * calendário dos KPIs, pra que "Em caixa" fale do mesmo período que o lucro.
 *
 * Paginado (fetchAllPages) com ordem estável `retirada_em desc, id`: hoje são
 * 3 linhas, mas o teto silencioso de 1000 do PostgREST já cortou agregação
 * neste painel antes (incidente 72a4c9db) e não vai cortar esta.
 */
export async function listRetiradas(range: DateRange): Promise<ListaRetiradas> {
  const admin = getAdmin();
  try {
    const rows = await fetchAllPages<RetiradaSocioRow>("retiradas_socios período", (from, to) =>
      admin
        .from("retiradas_socios")
        .select(COLUNAS)
        .gte("retirada_em", range.since)
        .lt("retirada_em", range.until)
        .order("retirada_em", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    );
    return { retiradas: rows, tabelaAusente: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (ehTabelaAusente(msg)) {
      console.warn("[retiradas] tabela ausente — rode scripts/113_retiradas_socios.sql");
      return { retiradas: [], tabelaAusente: true };
    }
    throw e;
  }
}

export type NovaRetirada = {
  /** Já validado por `validarRetirada` (> 0, em centavos). */
  valor: number;
  socio: string;
  origem?: string;
  /** E-mail do admin que registrou (auditoria). Null quando o auth não traz e-mail. */
  registradoPor: string | null;
};

/** Grava a retirada e devolve a linha criada (o painel usa pra recalcular na hora). */
export async function createRetirada(nova: NovaRetirada): Promise<RetiradaSocioRow> {
  const { data, error } = await getAdmin()
    .from("retiradas_socios")
    .insert({
      valor: nova.valor,
      socio: nova.socio,
      origem: nova.origem?.trim() || "hotmart",
      registrado_por: nova.registradoPor ?? null,
    })
    .select(COLUNAS)
    .single();

  if (error) {
    if (ehTabelaAusente(error.message)) {
      throw new Error(
        "A tabela de retiradas ainda não existe no banco — rode scripts/113_retiradas_socios.sql.",
      );
    }
    throw new Error(`Falha ao registrar a retirada: ${error.message}`);
  }
  return data as RetiradaSocioRow;
}

/**
 * Quanto já foi retirado: no período e desde o início (pedido Johnny 18/09,
 * "todos os valores positivos precisam conter esta retirada"). É o que o
 * dashboard desconta do Lucro (caixa) e do Lucro acumulado — SÓ pro sócio.
 *
 * Tabela ausente ou leitura podre devolve 0: o painel de dinheiro não pode
 * ficar em branco por causa disto, e 0 mantém os números como eram antes.
 */
export async function somasRetiradas(range: DateRange): Promise<{ periodo: number; acumulado: number }> {
  const admin = getAdmin();
  const ler = async (janela: DateRange | null) =>
    fetchAllPages<RetiradaSocioRow>(
      janela ? "retiradas_socios período" : "retiradas_socios acumulado",
      (from, to) => {
        let q = admin.from("retiradas_socios").select(COLUNAS);
        if (janela) q = q.gte("retirada_em", janela.since).lt("retirada_em", janela.until);
        return q.order("retirada_em", { ascending: false }).order("id", { ascending: true }).range(from, to);
      },
    );

  try {
    const [periodo, acumulado] = await Promise.all([ler(range), ler(null)]);
    return { periodo: totalRetiradas(periodo), acumulado: totalRetiradas(acumulado) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!ehTabelaAusente(msg)) console.warn("[retiradas] soma falhou:", msg);
    return { periodo: 0, acumulado: 0 };
  }
}
