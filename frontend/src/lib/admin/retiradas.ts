/**
 * Retiradas dos sócios — camada de dados (server-only, service_role).
 * A regra e as contas moram em `retiradas-calc.ts` (puro, testado).
 *
 * ⚠️ A migration `scripts/108_retiradas_socios.sql` pode NÃO estar aplicada.
 * Quando não está, a leitura devolve `tabelaAusente: true` em vez de explodir —
 * e o painel DIZ isso na tela. Degradar pra "0 retiradas" em silêncio seria
 * pior que o erro: o "Em caixa" repetiria o lucro e mentiria pro Johnny.
 */
import { getAdmin } from "@/lib/db/admin";
import { fetchAllPages } from "@/lib/db/paginate";
import type { RetiradaSocioRow } from "@/lib/db/types";
import type { DateRange } from "./queries";
import { ehTabelaAusente } from "./retiradas-calc";

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
      console.warn("[retiradas] tabela ausente — rode scripts/108_retiradas_socios.sql");
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
        "A tabela de retiradas ainda não existe no banco — rode scripts/108_retiradas_socios.sql.",
      );
    }
    throw new Error(`Falha ao registrar a retirada: ${error.message}`);
  }
  return data as RetiradaSocioRow;
}
