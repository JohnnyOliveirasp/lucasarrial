/**
 * Cortesias (mentoria sem Hotmart) — migration 53, spec aprovada 25/07.
 *
 * Campanha = nome + lista de e-mails + créditos POR PESSOA + janela [início,
 * fim]. Na janela aberta cada e-mail recebe o valor no saldo EXTRA
 * (add_extra_credits, ref_type 'courtesy_grant' — idempotente via UPDATE
 * condicional em granted_at). E-mail sem conta é resgatado no login
 * (claimCourtesyOnLogin, mesmo padrão das compras órfãs). No FIM da campanha o
 * sweeper de 5min expira o RESTANTE via expire_courtesy_credits — debita SÓ
 * credits_extra (nunca o saldo da assinatura), limitado ao valor dado.
 *
 * Acesso funciona porque crédito é o ÚNICO gate (regra travada) — nada aqui
 * toca assinatura/access_until.
 *
 * Server-only (service_role). NUNCA importar no client.
 */
import { getAdmin } from "@/lib/db/admin";
import { fetchAllPages } from "@/lib/db/paginate";
import { addExtraCredits, resolveUserIdByEmail } from "@/lib/credits/service";
import type { CourtesyCampaignRow } from "@/lib/db/types";

export type CourtesyCampaignWithStats = CourtesyCampaignRow & {
  people: number;
  granted_count: number;
  credits_granted: number;
  expired_count: number;
  credits_expired: number;
};

export type CourtesySweepSummary = {
  granted: number;
  expired: number;
  waiting_signup: number;
  errors: number;
};

type Admin = ReturnType<typeof getAdmin>;
type GrantKey = { campaign_id: string; email: string; amount: number };

const refIdOf = (campaignId: string, email: string) => `${campaignId}:${email}`;

/** Lista campanhas + estatísticas de concessão/expiração (painel admin). */
export async function listCourtesyCampaigns(): Promise<CourtesyCampaignWithStats[]> {
  const admin = getAdmin();
  // ⚠️ Teto de 1000 do PostgREST (incidente 72a4c9db): .select() sem .range()
  // corta em 1000 linhas em silêncio — uma campanha grande (>1000 e-mails)
  // mostraria estatística truncada no painel. Paginado com ordem estável
  // (created_at+id nas campanhas; PK campaign_id+email nos grants); falha
  // aborta (fetchAllPages lança), mesmo comportamento dos throws antigos.
  const [camps, grants] = await Promise.all([
    fetchAllPages("courtesy_campaigns", (from, to) =>
      admin
        .from("courtesy_campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllPages("courtesy_grants stats", (from, to) =>
      admin
        .from("courtesy_grants")
        .select("campaign_id, amount, granted_at, expired_at, remaining_expired")
        .order("campaign_id", { ascending: true })
        .order("email", { ascending: true })
        .range(from, to),
    ),
  ]);

  const stats = new Map<string, Omit<CourtesyCampaignWithStats, keyof CourtesyCampaignRow>>();
  for (const g of grants) {
    const s = stats.get(g.campaign_id) ?? {
      people: 0,
      granted_count: 0,
      credits_granted: 0,
      expired_count: 0,
      credits_expired: 0,
    };
    s.people += 1;
    if (g.granted_at) {
      s.granted_count += 1;
      s.credits_granted += g.amount;
    }
    if (g.expired_at) {
      s.expired_count += 1;
      s.credits_expired += g.remaining_expired ?? 0;
    }
    stats.set(g.campaign_id, s);
  }
  return camps.map((c) => ({
    ...c,
    ...(stats.get(c.id) ?? {
      people: 0,
      granted_count: 0,
      credits_granted: 0,
      expired_count: 0,
      credits_expired: 0,
    }),
  }));
}

/**
 * Cria a campanha + uma linha de grant por e-mail (normalizado, deduplicado).
 * Se a janela já começou, tenta conceder imediatamente (best-effort — o
 * sweeper de 5min cobre qualquer resto).
 */
export async function createCourtesyCampaign(args: {
  name: string;
  creditsPerPerson: number;
  emails: string[];
  endsAt: string;
  startsAt?: string;
  createdBy?: string | null;
}): Promise<CourtesyCampaignRow> {
  const emails = [
    ...new Set(args.emails.map((e) => e.trim().toLowerCase()).filter((e) => /^\S+@\S+\.\S+$/.test(e))),
  ];
  if (emails.length === 0) throw new Error("Nenhum e-mail válido na lista");

  const admin = getAdmin();
  const { data: campaign, error } = await admin
    .from("courtesy_campaigns")
    .insert({
      name: args.name,
      credits_per_person: args.creditsPerPerson,
      ends_at: args.endsAt,
      ...(args.startsAt ? { starts_at: args.startsAt } : {}),
      created_by: args.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const { error: gErr } = await admin.from("courtesy_grants").insert(
    emails.map((email) => ({
      campaign_id: campaign.id,
      email,
      amount: args.creditsPerPerson,
    })),
  );
  if (gErr) throw new Error(gErr.message);

  try {
    await processCourtesyCampaigns();
  } catch {
    /* sweeper cobre */
  }
  return campaign as CourtesyCampaignRow;
}

/** Encerra agora: antecipa ends_at pra já — o próximo processamento expira o restante. */
export async function endCourtesyCampaignNow(id: string): Promise<void> {
  const { error } = await getAdmin()
    .from("courtesy_campaigns")
    .update({ ends_at: new Date().toISOString(), active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  try {
    await processCourtesyCampaigns();
  } catch {
    /* sweeper cobre */
  }
}

/**
 * Concede UM grant de forma idempotente: o UPDATE condicional em
 * granted_at IS NULL é a trava (só um chamador ganha a linha). Se o crédito
 * falhar depois da marca, desfaz pra o próximo sweep tentar de novo.
 */
async function grantOne(admin: Admin, g: GrantKey, userId: string): Promise<boolean> {
  const { data: claimed } = await admin
    .from("courtesy_grants")
    .update({ user_id: userId, granted_at: new Date().toISOString() })
    .eq("campaign_id", g.campaign_id)
    .eq("email", g.email)
    .is("granted_at", null)
    .select("campaign_id");
  if (!claimed || claimed.length === 0) return false; // outra via já concedeu

  const r = await addExtraCredits({
    userId,
    amount: g.amount,
    refType: "courtesy_grant",
    refId: refIdOf(g.campaign_id, g.email),
  });
  if (!r.ok) {
    await admin
      .from("courtesy_grants")
      .update({ user_id: null, granted_at: null })
      .eq("campaign_id", g.campaign_id)
      .eq("email", g.email);
    return false;
  }
  return true;
}

/** Expira UM grant (mesma trava condicional, agora em expired_at). */
async function expireOne(
  admin: Admin,
  g: GrantKey & { user_id: string | null; granted_at: string | null },
): Promise<boolean> {
  const { data: claimed } = await admin
    .from("courtesy_grants")
    .update({ expired_at: new Date().toISOString() })
    .eq("campaign_id", g.campaign_id)
    .eq("email", g.email)
    .is("expired_at", null)
    .select("campaign_id");
  if (!claimed || claimed.length === 0) return false;

  // nunca chegou a ser creditado (sem conta até o fim) → só fecha a linha
  if (!g.granted_at || !g.user_id) {
    await admin
      .from("courtesy_grants")
      .update({ remaining_expired: 0 })
      .eq("campaign_id", g.campaign_id)
      .eq("email", g.email);
    return true;
  }

  const { data, error } = await admin.rpc("expire_courtesy_credits", {
    p_user_id: g.user_id,
    p_max_amount: g.amount,
    p_ref_id: refIdOf(g.campaign_id, g.email),
  });
  if (error) {
    await admin
      .from("courtesy_grants")
      .update({ expired_at: null })
      .eq("campaign_id", g.campaign_id)
      .eq("email", g.email);
    return false;
  }
  const debited = ((data ?? {}) as { debited?: number }).debited ?? 0;
  await admin
    .from("courtesy_grants")
    .update({ remaining_expired: debited })
    .eq("campaign_id", g.campaign_id)
    .eq("email", g.email);
  return true;
}

/**
 * Processamento periódico (sweeper 5min + após criar/encerrar campanha):
 *  1. janelas ABERTAS → credita quem tem conta e ainda não recebeu;
 *  2. campanhas VENCIDAS → expira o restante de cada concessão.
 */
export async function processCourtesyCampaigns(): Promise<CourtesySweepSummary> {
  const admin = getAdmin();
  const nowIso = new Date().toISOString();
  const summary: CourtesySweepSummary = { granted: 0, expired: 0, waiting_signup: 0, errors: 0 };

  // 1) conceder nas janelas abertas
  const { data: open } = await admin
    .from("courtesy_campaigns")
    .select("id")
    .eq("active", true)
    .lte("starts_at", nowIso)
    .gt("ends_at", nowIso);
  const openIds = (open ?? []).map((c) => c.id);
  if (openIds.length > 0) {
    const { data: pending } = await admin
      .from("courtesy_grants")
      .select("campaign_id, email, amount, user_id")
      .in("campaign_id", openIds)
      .is("granted_at", null);
    for (const g of pending ?? []) {
      try {
        const userId = g.user_id ?? (await resolveUserIdByEmail(g.email));
        if (!userId) {
          summary.waiting_signup += 1; // resgate no login cobre quando criar conta
          continue;
        }
        if (await grantOne(admin, g, userId)) summary.granted += 1;
      } catch {
        summary.errors += 1;
      }
    }
  }

  // 2) expirar o restante das campanhas vencidas
  const { data: ended } = await admin
    .from("courtesy_campaigns")
    .select("id")
    .lte("ends_at", nowIso);
  const endedIds = (ended ?? []).map((c) => c.id);
  if (endedIds.length > 0) {
    const { data: toExpire } = await admin
      .from("courtesy_grants")
      .select("campaign_id, email, amount, user_id, granted_at")
      .in("campaign_id", endedIds)
      .is("expired_at", null);
    for (const g of toExpire ?? []) {
      try {
        if (await expireOne(admin, g)) summary.expired += 1;
      } catch {
        summary.errors += 1;
      }
    }
  }

  return summary;
}

/**
 * Resgate no login (best-effort, nunca derruba o login): e-mail que entrou
 * numa campanha antes de ter conta recebe a cortesia na primeira entrada
 * dentro da janela.
 */
export async function claimCourtesyOnLogin(userId: string, email: string): Promise<void> {
  try {
    const admin = getAdmin();
    const norm = email.trim().toLowerCase();
    const nowIso = new Date().toISOString();
    const { data: grants } = await admin
      .from("courtesy_grants")
      .select("campaign_id, email, amount")
      .eq("email", norm)
      .is("granted_at", null);
    if (!grants || grants.length === 0) return;

    const ids = [...new Set(grants.map((g) => g.campaign_id))];
    const { data: camps } = await admin
      .from("courtesy_campaigns")
      .select("id")
      .in("id", ids)
      .eq("active", true)
      .lte("starts_at", nowIso)
      .gt("ends_at", nowIso);
    const openSet = new Set((camps ?? []).map((c) => c.id));
    for (const g of grants) {
      if (openSet.has(g.campaign_id)) await grantOne(admin, g, userId);
    }
  } catch {
    /* best-effort */
  }
}
