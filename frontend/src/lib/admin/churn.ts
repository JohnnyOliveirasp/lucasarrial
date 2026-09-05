/**
 * Churn de assinatura SEPARADO por quem paga de verdade × trial/gratuidade
 * (oferta R$0): misturar os dois inflava a taxa (03/08: 20,6% misto vs 3,8%
 * pagantes). Usado pelo acumulado do /admin (totals) e pela rota
 * /api/v1/admin/churn (popup "quem cancelou" do gráfico).
 *
 * Motivo do cancelamento: quem cancela PELA PLATAFORMA deixa a pesquisa em
 * subscription_cancellations (reason+detail, por user_id → e-mail). Quem
 * cancela direto no Hotmart não tem motivo aqui — a UI mostra isso.
 */
import type { getAdmin } from "@/lib/db/admin";
import { fetchAllPages } from "@/lib/db/paginate";

/** Produto da plataforma na Hotmart (mesmo id usado nas análises de venda). */
const HOTMART_PRODUCT_ID = "7851642";

type CancelPayload = {
  data?: {
    subscriber?: { email?: string };
    buyer?: { email?: string };
    product?: { id?: number | string };
    subscription?: { product?: { id?: number | string } };
    purchase?: { price?: { value?: number } };
  };
};

const isTestEmail = (e: string) => !e || e.includes("@example.com") || e === "test@hotmart.com";

export type ChurnDay = { day: string; paid: number; trial: number };
export type ChurnPerson = {
  email: string;
  day: string;
  kind: "paid" | "trial";
  /** Motivo da pesquisa DA PLATAFORMA; null = cancelou direto no Hotmart. */
  reason: string | null;
  detail: string | null;
};

export type ChurnSummary = {
  canceledPaid: number;
  churnPaidPct: number;
  canceledFree: number;
  churnFreePct: number;
  churnDaily: ChurnDay[];
  people: ChurnPerson[];
};

export async function computeChurn(admin: ReturnType<typeof getAdmin>): Promise<ChurnSummary> {
  // ⚠️ Teto silencioso de 1000 do PostgREST (incidente 72a4c9db): .select()
  // sem .range() devolve NO MÁXIMO 1000 linhas, sem erro. payment_events
  // passou de 1000 PURCHASE_APPROVED em 19/08 (1099 medidas) e os Sets
  // paid/freeOnly ficaram cegos pra ~99 compras — o churn pago×trial do
  // /admin saía ERRADO. Paginar sempre, com ordem estável, até a página vir
  // incompleta; falha ABORTA (nunca degradar pra Set vazio).
  const [cancelRows, approvedRows, surveyRowsRaw] = await Promise.all([
    fetchAllPages("payment_events SUBSCRIPTION_CANCELLATION", (from, to) =>
      admin
        .from("payment_events")
        .select("payload, received_at")
        .eq("event_type", "SUBSCRIPTION_CANCELLATION")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages("payment_events PURCHASE_APPROVED", (from, to) =>
      admin
        .from("payment_events")
        .select("buyer_email, payload")
        .eq("event_type", "PURCHASE_APPROVED")
        .order("id", { ascending: true })
        .range(from, to),
    ),
    // created_at desc preserva a semântica "1ª resposta vista = mais recente";
    // id desempata (created_at pode colidir) pra ordem ser estável entre páginas.
    fetchAllPages("subscription_cancellations", (from, to) =>
      admin
        .from("subscription_cancellations")
        .select("user_id, reason, detail, created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  // user_id → e-mail (FK da pesquisa aponta pra auth.users, sem embed)
  const surveyRows = surveyRowsRaw as Array<{
    user_id: string | null;
    reason: string | null;
    detail: string | null;
  }>;
  const surveyUserIds = [...new Set(surveyRows.map((r) => r.user_id).filter(Boolean))] as string[];
  const emailById = new Map<string, string>();
  // .in() em blocos de 500 (mesmo padrão do fix do orphan-outreach, c5f67bd):
  // URL não estoura e cada bloco devolve ≤500 linhas, abaixo do teto de 1000.
  const CHUNK = 500;
  for (let i = 0; i < surveyUserIds.length; i += CHUNK) {
    const chunk = surveyUserIds.slice(i, i + CHUNK);
    const { data: profs, error } = await admin.from("profiles").select("id, email").in("id", chunk);
    if (error) throw new Error(`[churn] profiles falhou: ${error.message}`);
    for (const p of (profs ?? []) as { id: string; email: string | null }[]) {
      if (p.email) emailById.set(p.id, p.email.toLowerCase());
    }
  }

  // Assinante é PAGANTE se alguma compra aprovada teve valor > 0.
  const paid = new Set<string>();
  const freeOnly = new Set<string>();
  for (const row of approvedRows as { buyer_email: string | null; payload: CancelPayload }[]) {
    const email = (row.buyer_email ?? "").toLowerCase();
    const d = row.payload?.data;
    if (isTestEmail(email) || String(d?.product?.id ?? "") !== HOTMART_PRODUCT_ID) continue;
    if (Number(d?.purchase?.price?.value ?? 0) > 0) {
      paid.add(email);
      freeOnly.delete(email);
    } else if (!paid.has(email)) {
      freeOnly.add(email);
    }
  }

  // 1º cancelamento de cada e-mail (o mesmo assinante pode gerar 2+ eventos)
  const canceledAt = new Map<string, string>();
  for (const row of cancelRows as { payload: CancelPayload; received_at: string }[]) {
    const d = row.payload?.data;
    const email = (d?.subscriber?.email || d?.buyer?.email || "").toLowerCase();
    const product = String(d?.product?.id ?? d?.subscription?.product?.id ?? "");
    if (isTestEmail(email) || product !== HOTMART_PRODUCT_ID) continue;
    const prev = canceledAt.get(email);
    if (!prev || row.received_at < prev) canceledAt.set(email, row.received_at);
  }

  // Pesquisa da plataforma: última resposta por e-mail
  const surveyByEmail = new Map<string, { reason: string | null; detail: string | null }>();
  for (const row of surveyRows) {
    const email = row.user_id ? emailById.get(row.user_id) : undefined;
    if (!email || surveyByEmail.has(email)) continue; // ordenado desc → 1ª é a mais recente
    surveyByEmail.set(email, { reason: row.reason, detail: row.detail });
  }

  // Série diária COMPLETA (fuso BRT), esparsa — só dias com cancelamento.
  const dayKey = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const byDay = new Map<string, { paid: number; trial: number }>();
  const people: ChurnPerson[] = [];
  for (const [email, at] of canceledAt) {
    const kind = paid.has(email) ? "paid" : freeOnly.has(email) ? "trial" : null;
    if (!kind) continue; // fora do produto/paid-free — não entra
    const key = dayKey(at);
    const bucket = byDay.get(key) ?? { paid: 0, trial: 0 };
    bucket[kind]++;
    byDay.set(key, bucket);
    const survey = surveyByEmail.get(email);
    people.push({ email, day: key, kind, reason: survey?.reason ?? null, detail: survey?.detail ?? null });
  }
  people.sort((a, b) => (a.day < b.day ? 1 : -1));
  const churnDaily = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, c]) => ({ day, ...c }));

  const canceledPaid = people.filter((p) => p.kind === "paid").length;
  const canceledFree = people.filter((p) => p.kind === "trial").length;
  return {
    canceledPaid,
    churnPaidPct: paid.size > 0 ? (canceledPaid / paid.size) * 100 : 0,
    canceledFree,
    churnFreePct: freeOnly.size > 0 ? (canceledFree / freeOnly.size) * 100 : 0,
    churnDaily,
    people,
  };
}
