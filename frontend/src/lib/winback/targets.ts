/**
 * Resgate da Fast — construção da FILA de quem contatar. Server-only.
 *
 * Fonte: os eventos SUBSCRIPTION_CANCELLATION da Hotmart (o telefone vem no
 * payload — `subscriber.phone`, com DDD separado). Para cada pessoa a gente
 * classifica pelo USO REAL, não pelo que ela disse na pesquisa de saída:
 * metade marca "Outro motivo" e não escreve nada, então o comportamento é a
 * única fonte honesta que temos antes da conversa começar.
 *
 * Regra dura: 1 abordagem por pessoa, pra sempre (índice único por e-mail).
 * Quem voltou a assinar NUNCA entra na fila.
 */
import { getAdmin } from "@/lib/db/admin";
import type { WinbackSegment, WinbackTargetRow } from "@/lib/db/types";

type CancelEvent = {
  received_at: string;
  payload: {
    data?: {
      subscriber?: {
        email?: string;
        phone?: { cell?: string; dddCell?: string; phone?: string; dddPhone?: string };
      };
    };
  };
};

/**
 * Telefone da Hotmart → dígitos com país (5511987654321).
 * O payload traz DDD e número separados, e o campo "cell" às vezes vem vazio
 * com o celular no campo "phone" (caso real: leilapatricia). Só aceitamos o
 * que parece celular brasileiro (9 dígitos começando com 9) — fixo não tem
 * WhatsApp e disparar pra ele é sinal ruim de graça.
 */
export function phoneFromHotmart(
  phone: { cell?: string; dddCell?: string; phone?: string; dddPhone?: string } | undefined,
): string | null {
  if (!phone) return null;
  const pairs: [string, string][] = [
    [phone.dddCell ?? "", phone.cell ?? ""],
    [phone.dddPhone ?? "", phone.phone ?? ""],
  ];
  for (const [rawDdd, rawNum] of pairs) {
    const ddd = rawDdd.replace(/\D/g, "");
    const num = rawNum.replace(/\D/g, "");
    if (ddd.length !== 2 || num.length !== 9 || !num.startsWith("9")) continue;
    return `55${ddd}${num}`;
  }
  return null;
}

/** Assinatura ativa hoje? (quem voltou não é alvo de resgate) */
function isActive(accessUntil: string | null): boolean {
  return Boolean(accessUntil && new Date(accessUntil).getTime() > Date.now());
}

type Classified = {
  email: string;
  phone_digits: string | null;
  profile_id: string | null;
  canceled_at: string;
  segment: WinbackSegment;
  survey_reason: string | null;
  survey_detail: string | null;
  /** Fora da fila (voltou a assinar / sem telefone utilizável) */
  skip: string | null;
};

/**
 * Classifica UMA pessoa pelo uso: quem assinou e nunca criou uma voz não
 * rejeitou o produto — travou. É outra conversa (e a mais fácil de recuperar).
 */
async function classify(email: string, phone: string | null, canceledAt: string): Promise<Classified> {
  const admin = getAdmin();
  const base = {
    email,
    phone_digits: phone,
    canceled_at: canceledAt,
    survey_reason: null as string | null,
    survey_detail: null as string | null,
  };

  const { data: prof } = await admin
    .from("profiles")
    .select("id, access_until")
    .ilike("email", email)
    .maybeSingle();
  const profile = prof as { id: string; access_until: string | null } | null;

  if (!profile) {
    return { ...base, profile_id: null, segment: "sem_conta", skip: phone ? null : "sem telefone" };
  }
  if (isActive(profile.access_until)) {
    return { ...base, profile_id: profile.id, segment: "usou_e_saiu", skip: "voltou a assinar" };
  }

  const [{ count: voices }, { data: survey }] = await Promise.all([
    admin.from("voices").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
    admin
      .from("subscription_cancellations")
      .select("reason, detail")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const s = survey as { reason: string | null; detail: string | null } | null;

  return {
    ...base,
    profile_id: profile.id,
    segment: (voices ?? 0) === 0 ? "nunca_ativou" : "usou_e_saiu",
    survey_reason: s?.reason?.trim() || null,
    survey_detail: s?.detail?.trim() || null,
    skip: phone ? null : "sem telefone",
  };
}

/**
 * Varre os cancelamentos e sincroniza a fila (idempotente: roda quantas vezes
 * quiser). NÃO mexe em quem já foi contatado — só insere gente nova e mantém
 * atualizado quem ainda está `pending`.
 */
export async function syncWinbackTargets(): Promise<{ novos: number; total: number; pulados: number }> {
  const admin = getAdmin();
  const { data } = await admin
    .from("payment_events")
    .select("received_at, payload")
    .eq("event_type", "SUBSCRIPTION_CANCELLATION")
    .order("received_at", { ascending: false })
    .limit(1000);

  const events = (data ?? []) as unknown as CancelEvent[];
  const maisRecentePorEmail = new Map<string, CancelEvent>();
  for (const ev of events) {
    const email = ev.payload?.data?.subscriber?.email?.trim().toLowerCase();
    if (!email || maisRecentePorEmail.has(email)) continue; // já veio ordenado desc
    maisRecentePorEmail.set(email, ev);
  }

  const { data: existentes } = await admin.from("winback_targets").select("email, status");
  const jaTem = new Map(
    ((existentes ?? []) as { email: string; status: string }[]).map((r) => [r.email.toLowerCase(), r.status]),
  );

  let novos = 0;
  let pulados = 0;
  for (const [email, ev] of maisRecentePorEmail) {
    const statusAtual = jaTem.get(email);
    // Já contatada (ou em qualquer estado que não seja fila) → não toca.
    if (statusAtual && statusAtual !== "pending") continue;

    const phone = phoneFromHotmart(ev.payload?.data?.subscriber?.phone);
    const c = await classify(email, phone, ev.received_at);
    if (c.skip) pulados++;

    const row = {
      email,
      phone_digits: c.phone_digits,
      profile_id: c.profile_id,
      canceled_at: c.canceled_at,
      segment: c.segment,
      survey_reason: c.survey_reason,
      survey_detail: c.survey_detail,
      status: c.skip ? ("skipped" as const) : ("pending" as const),
      note: c.skip,
      updated_at: new Date().toISOString(),
    };

    if (statusAtual === "pending") {
      await admin.from("winback_targets").update(row as never).eq("email", email);
    } else {
      const { error } = await admin.from("winback_targets").insert(row as never);
      if (!error) novos++;
    }
  }

  const { count } = await admin
    .from("winback_targets")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return { novos, total: count ?? 0, pulados };
}

/**
 * Próxima pessoa da fila. Ordem: cancelamento MAIS RECENTE primeiro — quem
 * saiu ontem lembra da plataforma e responde; quem saiu em junho estranha.
 * E resposta recebida conta como conversa de mão dupla, o que protege a
 * reputação do número nos disparos seguintes.
 */
export async function nextWinbackTarget(): Promise<WinbackTargetRow | null> {
  const { data } = await getAdmin()
    .from("winback_targets")
    .select("*")
    .eq("status", "pending")
    .not("phone_digits", "is", null)
    .order("canceled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as WinbackTargetRow | null) ?? null;
}

/** Alvo vinculado a uma conversa (usado quando a pessoa responde). */
export async function winbackByChat(chatId: string): Promise<WinbackTargetRow | null> {
  const { data } = await getAdmin()
    .from("winback_targets")
    .select("*")
    .eq("chat_id", chatId)
    .not("status", "in", "(optout,skipped)")
    .maybeSingle();
  return (data as WinbackTargetRow | null) ?? null;
}
