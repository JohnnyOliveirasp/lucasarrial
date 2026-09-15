/**
 * Período CALENDÁRIO do /admin (fuso de Brasília): dia exato, mês fechado ou
 * ano fechado — nada de "últimos X dias".
 *
 * Extraído da rota /api/v1/admin/dashboard (03/09 morava lá dentro) porque a
 * rota de Retiradas precisa recortar EXATAMENTE a mesma janela: se as duas
 * calculassem o intervalo por conta própria, "Em caixa" poderia subtrair
 * retiradas de um período diferente do lucro mostrado ao lado.
 */
import type { DateRange } from "./queries";

const TZ = "-03:00"; // Brasília

/** Monta [since, until) a partir da granularidade + chave. Null = inválido. */
export function rangeFor(gran: string, key: string): DateRange | null {
  if (gran === "day" && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const since = new Date(`${key}T00:00:00${TZ}`);
    const until = new Date(since.getTime() + 24 * 3600 * 1000);
    return { since: since.toISOString(), until: until.toISOString() };
  }
  if (gran === "month" && /^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split("-").map(Number);
    const since = new Date(`${key}-01T00:00:00${TZ}`);
    const nextKey = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    const until = new Date(`${nextKey}-01T00:00:00${TZ}`);
    return { since: since.toISOString(), until: until.toISOString() };
  }
  if (gran === "year" && /^\d{4}$/.test(key)) {
    const y = Number(key);
    return {
      since: new Date(`${y}-01-01T00:00:00${TZ}`).toISOString(),
      until: new Date(`${y + 1}-01-01T00:00:00${TZ}`).toISOString(),
    };
  }
  return null;
}

/** Mês corrente em Brasília (default do filtro). */
export function currentMonthKey(): string {
  const now = new Date(Date.now() - 3 * 3600 * 1000); // UTC→BRT
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Query string (gran/key) → janela. Parâmetro ausente ou inválido cai no mês corrente. */
export function resolveRange(gran: string | null, key: string | null): DateRange {
  return (
    rangeFor(gran ?? "month", key ?? currentMonthKey()) ?? rangeFor("month", currentMonthKey())!
  );
}
