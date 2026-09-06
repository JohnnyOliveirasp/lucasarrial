/**
 * Parte suja do detector de VÍNCULO QUEBRADO (Supabase + Telegram + e-mail).
 * A decisão, o texto e o dedupe moram em `vinculo-quebrado.ts`, que é puro e
 * testado; aqui só se pluga o mundo.
 *
 * Mesmo desenho do `aviso-orfao-canal.ts`: grava o recado DURÁVEL em
 * `agent_state` antes de tentar qualquer canal volátil, porque silêncio não
 * pode ser indistinguível de sucesso — foi exatamente assim que o aviso do
 * #239 passou um mês sem chegar em ninguém.
 *
 * NÃO VINCULA E NÃO CREDITA. São ~800 mil créditos e a decisão é do
 * Johnny/Lucas; a religação está em `scripts/backfill-vinculo-orfao.mjs`, que
 * é manual de propósito.
 */
import { getAdmin } from "@/lib/db/admin";
import { sendEmail } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";
import {
  aAvisar,
  marcarAvisados,
  separar,
  textoDoAviso,
  type ContaDoEmail,
  type EstadoVinculo,
  type OrfaoAtivo,
  type Quebrado,
} from "@/lib/payments/vinculo-quebrado";

const CHAVE_ESTADO = "vinculo_quebrado_alerts";
const PAGE = 1000;
const CHUNK = 500;

export type VinculoSweepSummary = {
  orfaosAtivos: number;
  quebrados: number;
  avisadosAgora: number;
  lembretes: number;
  canais: string[];
};

async function lerEstado(): Promise<EstadoVinculo> {
  const { data } = await getAdmin()
    .from("agent_state" as never)
    .select("value")
    .eq("key", CHAVE_ESTADO)
    .maybeSingle();
  return (((data as { value?: EstadoVinculo } | null)?.value ?? {}) as EstadoVinculo) || {};
}

async function gravarEstado(estado: EstadoVinculo): Promise<void> {
  await getAdmin()
    .from("agent_state" as never)
    .upsert({ key: CHAVE_ESTADO, value: estado, updated_at: new Date().toISOString() } as never);
}

async function registrarDuravel(assunto: string, texto: string, quebrados: Quebrado[]): Promise<void> {
  await getAdmin()
    .from("agent_state" as never)
    .upsert({
      key: `para_frank_vinculo_${new Date().toISOString().slice(0, 10)}`,
      value: {
        at: new Date().toISOString(),
        subject: assunto.slice(0, 200),
        message: texto.slice(0, 8000),
        from: "sweep-vinculo-quebrado",
        casos: quebrados,
      },
      updated_at: new Date().toISOString(),
    } as never);
}

async function mandarNoTelegram(texto: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: `/msg@Frank_agent_007_bot\n${texto.slice(0, 3500)}`,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function mandarPorEmail(assunto: string, texto: string): Promise<boolean> {
  try {
    const destinos = new Set<string>([SUPPORT_EMAIL]);
    const { data } = await getAdmin().from("admin_emails").select("email");
    for (const r of (data ?? []) as { email: string | null }[]) {
      if (r.email) destinos.add(r.email.toLowerCase());
    }
    const html = `<pre style="font:14px/1.5 ui-monospace,monospace">${texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</pre>`;
    return await sendEmail({ to: [...destinos], subject: assunto, html });
  } catch {
    return false;
  }
}

/**
 * Uma varredura. Consulta que falha ABORTA (mesma regra do orphan-outreach,
 * incidente 72a4c9db): lista incompleta aqui vira alarme errado — ou, pior,
 * silêncio sobre quem está pagando sem receber.
 */
export async function sweepVinculosQuebrados(agoraIso?: string): Promise<VinculoSweepSummary> {
  const admin = getAdmin();
  const agora = agoraIso ?? new Date().toISOString();

  // 1. Todos os órfãos ATIVOS. Paginado: o teto silencioso de 1000 do PostgREST
  // esconderia justamente os mais antigos.
  const orfaos: OrfaoAtivo[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("entitlements")
      .select("external_id, buyer_email, status, access_until, created_at")
      .is("user_id", null)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`[vinculo-quebrado] entitlements falhou: ${error.message}`);
    for (const e of (data ?? []) as {
      external_id: string | null;
      buyer_email: string | null;
      status: string | null;
      access_until: string | null;
      created_at: string | null;
    }[]) {
      if (!e.buyer_email || !e.created_at) continue;
      orfaos.push({
        externalId: e.external_id ?? `email:${e.buyer_email}`,
        buyerEmail: e.buyer_email,
        status: e.status ?? "",
        accessUntil: e.access_until,
        createdAt: e.created_at,
      });
    }
    if (!data || data.length < PAGE) break;
  }

  // 2. Existe conta com o MESMO e-mail? Só os e-mails em jogo (nunca a tabela
  // inteira — foi o teto de 1000 que mandou convite pra 105 clientes ativos).
  const emails = [...new Set(orfaos.map((o) => o.buyerEmail.trim().toLowerCase()))];
  const contas = new Map<string, ContaDoEmail>();
  for (let i = 0; i < emails.length; i += CHUNK) {
    const bloco = emails.slice(i, i + CHUNK);
    const { data, error } = await admin
      .from("profiles")
      .select("email, created_at")
      .in("email", bloco);
    if (error) throw new Error(`[vinculo-quebrado] profiles falhou: ${error.message}`);
    for (const p of (data ?? []) as { email: string | null; created_at: string | null }[]) {
      if (p.email && p.created_at) {
        contas.set(p.email.trim().toLowerCase(), { criadaEm: p.created_at });
      }
    }
  }

  const { quebrados, contagem } = separar(orfaos, contas, agora);
  const summary: VinculoSweepSummary = {
    orfaosAtivos: orfaos.length,
    quebrados: quebrados.length,
    avisadosAgora: 0,
    lembretes: 0,
    canais: [],
  };
  if (quebrados.length === 0) return summary;

  const estado = await lerEstado();
  const { novos, lembretes } = aAvisar(quebrados, estado, agora);
  if (novos.length + lembretes.length === 0) return summary;

  const { assunto, texto } = textoDoAviso(novos, lembretes, contagem);
  // Durável PRIMEIRO: se Telegram e Resend caírem, o recado ainda existe.
  await registrarDuravel(assunto, texto, [...novos, ...lembretes]);
  summary.canais.push("agent_state");
  if (await mandarNoTelegram(texto)) summary.canais.push("telegram");
  if (await mandarPorEmail(assunto, texto)) summary.canais.push("email");

  await gravarEstado(marcarAvisados(estado, [...novos, ...lembretes], agora));
  summary.avisadosAgora = novos.length;
  summary.lembretes = lembretes.length;
  return summary;
}
