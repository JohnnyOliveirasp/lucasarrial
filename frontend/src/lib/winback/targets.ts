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
 *
 * O campo é digitado pela pessoa no checkout, então chega de tudo: com
 * máscara "(75) 99152-2005", com o DDD repetido dentro do número
 * (cell "12991477132" + dddCell "12"), já com o 55 na frente, ou sem o 9º
 * dígito (cadastro antigo: "96763237"). Cada formato desses era uma pessoa
 * que a gente perdia à toa.
 *
 * Devolve null só quando não sobra nada aproveitável. Número que existir de
 * verdade é confirmado depois, na checagem do WhatsApp antes de falar.
 */
export function phoneFromHotmart(
  phone: { cell?: string; dddCell?: string; phone?: string; dddPhone?: string } | undefined,
): string | null {
  if (!phone) return null;
  const d = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
  const dddValido = (x: string) => x.length === 2 && Number(x) >= 11 && Number(x) <= 99;

  // Do mais confiável (celular) pro menos.
  const candidatos: [string, string][] = [
    [d(phone.dddCell), d(phone.cell)],
    [d(phone.dddPhone), d(phone.phone)],
  ];

  for (const [ddd, num] of candidatos) {
    if (!num) continue;

    // Já vem completo, com país
    if (num.startsWith("55") && (num.length === 12 || num.length === 13)) {
      const local = num.slice(2);
      if (!dddValido(local.slice(0, 2))) continue;
      return local.length === 10 ? `55${local.slice(0, 2)}9${local.slice(2)}` : num;
    }
    // Portugal — vários alunos moram fora e falam português
    if (num.startsWith("351") && num.length === 12) return num;

    // Com DDD embutido (o dddCell separado é redundante aqui)
    if (num.length === 11 && dddValido(num.slice(0, 2)) && num[2] === "9") return `55${num}`;
    if (num.length === 10 && dddValido(num.slice(0, 2))) return `55${num.slice(0, 2)}9${num.slice(2)}`;

    // Só o número, DDD no campo separado
    if (dddValido(ddd)) {
      if (num.length === 9 && num.startsWith("9")) return `55${ddd}${num}`;
      if (num.length === 8) return `55${ddd}9${num}`; // celular antigo, antes do 9º dígito
    }
  }
  return null;
}

/**
 * A pessoa VOLTOU depois de cancelar?
 *
 * Cuidado que já custou caro: quem cancela na Hotmart continua com acesso até
 * o fim do período pago. Tratar "acesso ativo" como "voltou" tirava da fila
 * justamente quem acabou de cancelar — os mais recentes, que ainda lembram da
 * plataforma e são os mais fáceis de trazer de volta.
 *
 * O sinal honesto é uma COMPRA NOVA depois do cancelamento (só APPROVED: o
 * COMPLETE pode chegar atrasado, referente ao ciclo que já estava pago).
 */
async function voltouDepoisDeCancelar(email: string, canceledAt: string): Promise<boolean> {
  const { count } = await getAdmin()
    .from("payment_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "PURCHASE_APPROVED")
    .ilike("buyer_email", email)
    .gt("received_at", canceledAt);
  return (count ?? 0) > 0;
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

  if (await voltouDepoisDeCancelar(email, canceledAt)) {
    const { data: p } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    return {
      ...base,
      profile_id: (p as { id: string } | null)?.id ?? null,
      segment: "usou_e_saiu",
      skip: "voltou a assinar",
    };
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("id, access_until")
    .ilike("email", email)
    .maybeSingle();
  const profile = prof as { id: string; access_until: string | null } | null;

  if (!profile) {
    return { ...base, profile_id: null, segment: "sem_conta", skip: phone ? null : "sem telefone" };
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

  const { data: existentes } = await admin.from("winback_targets").select("email, status, note");
  const jaTem = new Map(
    ((existentes ?? []) as { email: string; status: string; note: string | null }[]).map((r) => [
      r.email.toLowerCase(),
      r,
    ]),
  );

  let novos = 0;
  let pulados = 0;
  for (const [email, ev] of maisRecentePorEmail) {
    const atual = jaTem.get(email);
    const statusAtual = atual?.status;
    // Já contatada (ou em qualquer estado que não seja fila) → não toca.
    // Exceção: quem ficou de fora por telefone volta a ser avaliado — a
    // leitura do número melhorou depois e recupera gente descartada à toa.
    const reavaliar =
      statusAtual === "skipped" &&
      (atual?.note === "sem telefone" || atual?.note === "voltou a assinar");
    if (statusAtual && statusAtual !== "pending" && !reavaliar) continue;

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

    if (statusAtual === "pending" || reavaliar) {
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
