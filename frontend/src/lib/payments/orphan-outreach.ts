/**
 * Convite pra compra órfã (pedido Johnny 03/08): comprador aprovou na Hotmart
 * mas NUNCA criou conta — os créditos ficam esperando e a pessoa acha que
 * "não entraram" (principal reclamação do suporte@; 5 pagantes nessa situação).
 *
 * Sweeper diário: acha compras aprovadas sem perfil correspondente (>1h de
 * idade, pra dar tempo do fluxo normal), manda e-mail convite PELO suporte@
 * (se a pessoa responder, a Fast atende) e 1 lembrete único após 3 dias.
 * Dedupe persistente em agent_state key "orphan_invites" (sem migration).
 */
import { getAdmin } from "@/lib/db/admin";
import { sendEmail } from "@/lib/email/resend";
import { sendSupportMail } from "@/lib/agent/mail-smtp";

const PRODUCT_ID = "7851642";
const STATE_KEY = "orphan_invites";
const MIN_AGE_MS = 60 * 60 * 1000; // 1h: deixa o fluxo normal acontecer primeiro
const REMINDER_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

const TEST_EMAILS = new Set([
  "test@hotmart.com",
  "johnny.optimal@gmail.com",
  "johnny.milum001@gmail.com",
  "johnny.oliveirasp1@gmail.com",
  "jmo.usa.007@gmail.com",
]);
const isTestEmail = (e: string) =>
  !e || e.includes("@example.com") || e.endsWith("@fastcloner.com") || TEST_EMAILS.has(e);

type InviteState = Record<string, { first: string; reminder: string | null }>;
type ApprovedRow = {
  buyer_email: string | null;
  received_at: string;
  payload: { data?: { product?: { id?: number | string }; purchase?: { price?: { value?: number } }; buyer?: { name?: string } } };
};

async function loadState(): Promise<InviteState> {
  // agent_state fica fora do Database tipado (padrão das rotas do Vigia).
  const { data } = await getAdmin()
    .from("agent_state" as never)
    .select("value")
    .eq("key", STATE_KEY)
    .maybeSingle();
  return (((data as { value?: InviteState } | null)?.value ?? {}) as InviteState) || {};
}

async function saveState(state: InviteState): Promise<void> {
  await getAdmin()
    .from("agent_state" as never)
    .upsert({ key: STATE_KEY, value: state, updated_at: new Date().toISOString() } as never);
}

function inviteText(firstName: string, email: string, reminder: boolean): { subject: string; text: string } {
  const oi = firstName ? `Oi, ${firstName}!` : "Oi!";
  const subject = reminder
    ? "Lembrete: seus créditos do FastCloner seguem te esperando"
    : "Seus créditos do FastCloner estão prontos — falta só criar sua conta";
  const text = [
    oi,
    "",
    reminder
      ? "Passando de novo porque vimos que você ainda não ativou seu acesso ao FastCloner — e seus créditos continuam reservados, intactos, esperando por você."
      : "Sua compra foi aprovada e seus créditos do FastCloner já estão reservados — só falta um passo pra você começar a usar:",
    "",
    "1. Acesse https://fastcloner.com/app",
    `2. Crie sua conta (ou entre) usando EXATAMENTE este e-mail: ${email}`,
    "3. Pronto — os créditos aparecem automaticamente no primeiro acesso.",
    "",
    "Importante: precisa ser o MESMO e-mail da compra. Se você prefere usar outro e-mail, ou já criou uma conta com outro endereço, é só responder esta mensagem que a gente vincula pra você.",
    "",
    "Qualquer dúvida, responde aqui mesmo — eu te ajudo na hora. 😊",
    "",
    "Abraço,",
    "Fast — suporte FastCloner",
  ].join("\n");
  return { subject, text };
}

export type OrphanSweepSummary = {
  orphans: number;
  invited: number;
  reminded: number;
  errors: number;
};

/** Uma varredura (cron diário). Convite 1x + lembrete único após 3 dias. */
export async function sweepOrphanPurchases(): Promise<OrphanSweepSummary> {
  const summary: OrphanSweepSummary = { orphans: 0, invited: 0, reminded: 0, errors: 0 };
  const admin = getAdmin();

  // ⚠️ Teto silencioso do PostgREST: .select() sem .range() devolve NO MÁXIMO
  // 1000 linhas. payment_events já tem 1099 PURCHASE_APPROVED (19/08), então
  // sem paginação compradores somem da varredura em silêncio. Paginar sempre,
  // com ordem estável (id), até a página vir incompleta.
  const approved: ApprovedRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("payment_events")
      .select("buyer_email, received_at, payload")
      .eq("event_type", "PURCHASE_APPROVED")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`[orphan-outreach] payment_events falhou: ${error.message}`);
    approved.push(...((data ?? []) as ApprovedRow[]));
    if (!data || data.length < PAGE) break;
  }

  // Última compra aprovada por comprador (produto da plataforma, sem testes).
  const buyers = new Map<string, { at: string; name: string }>();
  for (const row of approved) {
    const email = (row.buyer_email ?? "").toLowerCase();
    const d = row.payload?.data;
    if (isTestEmail(email) || String(d?.product?.id ?? "") !== PRODUCT_ID) continue;
    const cur = buyers.get(email);
    if (!cur || row.received_at > cur.at) {
      buyers.set(email, { at: row.received_at, name: (d?.buyer?.name ?? "").split(" ")[0] });
    }
  }

  // Guarda que decide quem é "órfão". NUNCA puxar a tabela profiles inteira:
  // o teto de 1000 do PostgREST foi exatamente o que mandou "crie sua conta"
  // pra 105 clientes ATIVOS (incidente 72a4c9db, 04–19/08; profiles tinha 1293
  // linhas e o Set só conhecia 1000). Consultamos SÓ os e-mails dos compradores,
  // em blocos de 500 pra não estourar o tamanho da URL do .in().
  // Premissa verificada em produção (20/08): profiles.email é sempre minúsculo
  // (Supabase Auth normaliza no signup) e as chaves de buyers já são minúsculas,
  // então o .in() case-sensitive bate; a comparação segue em lowercase.
  // Se a consulta da guarda falhar, ABORTA — seguir com Set incompleto é o que
  // transforma cliente ativo em "órfão".
  const hasAccount = new Set<string>();
  const buyerEmails = [...buyers.keys()];
  const CHUNK = 500;
  for (let i = 0; i < buyerEmails.length; i += CHUNK) {
    const chunk = buyerEmails.slice(i, i + CHUNK);
    const { data, error } = await admin.from("profiles").select("email").in("email", chunk);
    if (error) throw new Error(`[orphan-outreach] guarda hasAccount falhou: ${error.message}`);
    for (const p of (data ?? []) as { email: string | null }[]) {
      if (p.email) hasAccount.add(p.email.toLowerCase());
    }
  }

  // #127 (Cassio, 24/08): compra aprovada UMA VEZ entrava na lista pra sempre.
  // Quem cancelou/estornou/chargeback/expirou recebia "seus créditos continuam
  // reservados" — e o lembrete de 3 dias também. A verdade do acesso é
  // entitlements.status (vale a linha mais recente por comprador): só 'active'
  // ganha convite. Consulta em blocos, e se falhar ABORTA (mesma regra da guarda
  // hasAccount: lista incompleta é o que manda e-mail errado).
  const naoAtivo = new Set<string>();
  {
    const ultimo = new Map<string, { status: string; at: string }>();
    for (let i = 0; i < buyerEmails.length; i += CHUNK) {
      const chunk = buyerEmails.slice(i, i + CHUNK);
      const { data, error } = await admin
        .from("entitlements")
        .select("buyer_email, status, updated_at, created_at")
        .in("buyer_email", chunk);
      if (error) throw new Error(`[orphan-outreach] guarda entitlements falhou: ${error.message}`);
      for (const e of (data ?? []) as {
        buyer_email: string | null; status: string | null; updated_at: string | null; created_at: string | null;
      }[]) {
        const em = (e.buyer_email ?? "").toLowerCase();
        if (!em) continue;
        const at = e.updated_at ?? e.created_at ?? "";
        const cur = ultimo.get(em);
        if (!cur || at > cur.at) ultimo.set(em, { status: e.status ?? "", at });
      }
    }
    for (const [em, u] of ultimo) if (u.status !== "active") naoAtivo.add(em);
  }

  const state = await loadState();
  const now = Date.now();
  const sent: string[] = [];

  // Pedido Johnny 03/08: admins recebem CÓPIA OCULTA de cada convite.
  const { data: adminRows } = await admin.from("admin_emails").select("email");
  const bcc = ((adminRows ?? []) as { email: string }[])
    .map((r) => r.email.toLowerCase())
    .filter((e) => e && e !== "suporte@fastcloner.com");

  for (const [email, info] of buyers) {
    if (hasAccount.has(email)) continue; // criou conta — claim do login resolve
    if (naoAtivo.has(email)) continue; // cancelou/estornou/expirou — não há crédito a convidar (#127)
    if (now - new Date(info.at).getTime() < MIN_AGE_MS) continue;
    summary.orphans += 1;

    const record = state[email];
    try {
      if (!record) {
        const { subject, text } = inviteText(info.name, email, false);
        await sendSupportMail({ to: email, subject, text, bcc });
        state[email] = { first: new Date().toISOString(), reminder: null };
        summary.invited += 1;
        sent.push(`convite → ${email}`);
      } else if (!record.reminder && now - new Date(record.first).getTime() > REMINDER_AFTER_MS) {
        const { subject, text } = inviteText(info.name, email, true);
        await sendSupportMail({ to: email, subject, text, bcc });
        record.reminder = new Date().toISOString();
        summary.reminded += 1;
        sent.push(`lembrete → ${email}`);
      }
    } catch (e) {
      summary.errors += 1;
      console.error(`[orphan-outreach] falha ${email}:`, e instanceof Error ? e.message : e);
    }
  }

  if (summary.invited + summary.reminded > 0) {
    await saveState(state);
    // Resumo único pros admins (não um BCC por aluno).
    const { data: admins } = await admin.from("admin_emails").select("email");
    const to = ((admins ?? []) as { email: string }[]).map((r) => r.email).filter(Boolean);
    if (to.length > 0) {
      await sendEmail({
        to,
        subject: `📨 Convites de compra órfã enviados: ${summary.invited + summary.reminded}`,
        html:
          `<p>Compradores sem conta na plataforma receberam convite pra ativar (créditos já reservados):</p>` +
          `<ul>${sent.map((s) => `<li>${s}</li>`).join("")}</ul>` +
          `<p>Órfãos no total agora: ${summary.orphans}. Quem responder cai no suporte@ (a Fast atende).</p>`,
      });
    }
  }
  return summary;
}
