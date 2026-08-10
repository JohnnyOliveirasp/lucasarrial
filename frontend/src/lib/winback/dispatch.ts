/**
 * Resgate da Fast — o DISPARADOR. Server-only.
 *
 * Chamado de minuto em minuto por cron; ele decide sozinho se é hora de falar
 * com mais uma pessoa. Tudo que protege o número mora aqui:
 *
 *  - ESCADA de aquecimento: 5 → 8 → 10 → 12 → 15/dia. O número é novo; quem
 *    dispara 89 mensagens no primeiro dia perde a conta antes de ler a
 *    primeira resposta.
 *  - JANELA: 9h-19h (Brasília), dias úteis. Mensagem de empresa de madrugada
 *    vira denúncia.
 *  - INTERVALO ALEATÓRIO (8 a 35 min). Intervalo cravado é assinatura de robô.
 *  - FREIO: dia sem NENHUMA resposta não sobe degrau; 2+ pedidos de "não me
 *    mande mais" no mesmo dia pausam 48h e descem um degrau.
 *  - CHECAGEM do número antes de falar (existe no WhatsApp?).
 *
 * O interruptor `enabled` nasce FALSE: nada sai enquanto o Johnny não ligar.
 */
import { getAdmin } from "@/lib/db/admin";
import { agentComplete } from "@/lib/agent/brain";
import { buildAgentSystem } from "@/lib/agent/manual";
import { sendHumanized } from "@/lib/agent/humanize";
import { wahaNumberExists } from "@/lib/agent/waha";
import { nextWinbackTarget } from "@/lib/winback/targets";
import { openingInstruction, winbackMission } from "@/lib/winback/script";
import type { AgentChatRow, WinbackSettingsRow, WinbackTargetRow } from "@/lib/db/types";

/** Contatos por dia, degrau a degrau. Do 5º dia em diante, 15/dia. */
const ESCADA = [5, 8, 10, 12, 15] as const;
const INTERVALO_MIN_MS = 8 * 60 * 1000;
const INTERVALO_MAX_MS = 35 * 60 * 1000;
const JANELA_INICIO = 9; // 9h BRT
const JANELA_FIM = 19; // até 18h59 BRT
const PAUSA_FREIO_HORAS = 48;

export type SweepResult = { acao: string; detalhe?: string; alvo?: string };

/** Agora no fuso de Brasília (o servidor roda em UTC). */
function brtAgora(): { data: string; hora: number; diaSemana: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false, weekday: "short",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    data: `${p.year}-${p.month}-${p.day}`,
    hora: Number(p.hour),
    diaSemana: dias[p.weekday as string] ?? 1,
  };
}

async function loadSettings(): Promise<WinbackSettingsRow | null> {
  const { data } = await getAdmin().from("winback_settings").select("*").eq("id", 1).maybeSingle();
  return (data as WinbackSettingsRow | null) ?? null;
}

async function saveSettings(patch: Partial<WinbackSettingsRow>): Promise<void> {
  await getAdmin()
    .from("winback_settings")
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("id", 1);
}

/**
 * Vira o dia: decide se o degrau sobe, fica ou desce, olhando o que aconteceu
 * no dia anterior. Ninguém respondeu = a mensagem (ou o número) tem problema;
 * subir o volume nessa hora é acelerar rumo ao ban.
 */
async function virarDia(s: WinbackSettingsRow, hoje: string): Promise<number> {
  const admin = getAdmin();
  const desde = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const [{ count: enviados }, { count: responderam }, { count: saíram }] = await Promise.all([
    admin.from("winback_targets").select("id", { count: "exact", head: true }).gte("sent_at", desde),
    admin.from("winback_targets").select("id", { count: "exact", head: true }).gte("replied_at", desde),
    admin
      .from("winback_targets")
      .select("id", { count: "exact", head: true })
      .eq("status", "optout")
      .gte("sent_at", desde),
  ]);

  let degrau = s.day_index;
  let nota = `dia anterior: ${enviados ?? 0} contatos, ${responderam ?? 0} respostas, ${saíram ?? 0} pediram pra parar`;

  if ((saíram ?? 0) >= 2) {
    degrau = Math.max(0, degrau - 1);
    nota += " → FREIO: pausa de 48h e um degrau abaixo";
    await saveSettings({
      paused_until: new Date(Date.now() + PAUSA_FREIO_HORAS * 3600_000).toISOString(),
    });
  } else if ((enviados ?? 0) >= 5 && (responderam ?? 0) === 0) {
    nota += " → FREIO: ninguém respondeu, degrau mantido";
  } else {
    degrau = Math.min(degrau + 1, ESCADA.length - 1);
    nota += " → degrau ↑";
  }

  await saveSettings({ day_index: degrau, sent_today: 0, last_send_date: hoje, last_note: nota });
  return degrau;
}

/** Garante a conversa no banco (nós abrimos o papo — o webhook só veria o eco). */
async function ensureChat(jid: string, nome: string | null): Promise<AgentChatRow | null> {
  const admin = getAdmin();
  const { data: existing } = await admin.from("agent_chats").select("*").eq("wa_jid", jid).maybeSingle();
  if (existing) return existing as AgentChatRow;
  const { data: created } = await admin
    .from("agent_chats")
    .insert({ wa_jid: jid, kind: "private", name: nome } as never)
    .select("*")
    .maybeSingle();
  if (created) return created as AgentChatRow;
  const { data: retry } = await admin.from("agent_chats").select("*").eq("wa_jid", jid).maybeSingle();
  return (retry as AgentChatRow | null) ?? null;
}

/** Primeiro nome da pessoa, se a gente tiver o cadastro. */
async function primeiroNome(t: WinbackTargetRow): Promise<string | null> {
  if (!t.profile_id) return null;
  const { data } = await getAdmin()
    .from("profiles")
    .select("display_name")
    .eq("id", t.profile_id)
    .maybeSingle();
  const nome = (data as { display_name: string | null } | null)?.display_name?.trim();
  if (!nome) return null;
  const primeiro = nome.split(/\s+/)[0];
  return primeiro.length >= 2 ? primeiro : null;
}

function intervaloAleatorio(): string {
  const ms = INTERVALO_MIN_MS + Math.random() * (INTERVALO_MAX_MS - INTERVALO_MIN_MS);
  return new Date(Date.now() + ms).toISOString();
}

/**
 * Uma rodada. Devolve o que fez (ou por que não fez) — o cron chama sempre e
 * a maior parte das vezes a resposta é "ainda não é hora".
 */
export async function runWinbackSweep(opts?: { force?: boolean }): Promise<SweepResult> {
  const s = await loadSettings();
  if (!s) return { acao: "sem_config" };
  if (!s.enabled && !opts?.force) return { acao: "desligado" };

  const { data: hoje, hora, diaSemana } = brtAgora();
  if (!opts?.force) {
    if (diaSemana === 0 || diaSemana === 6) return { acao: "fim_de_semana" };
    if (hora < JANELA_INICIO || hora >= JANELA_FIM) return { acao: "fora_da_janela", detalhe: `${hora}h BRT` };
    if (s.paused_until && new Date(s.paused_until).getTime() > Date.now()) {
      return { acao: "pausado", detalhe: s.paused_until };
    }
  }

  let degrau = s.day_index;
  let enviadosHoje = s.sent_today;
  if (s.last_send_date !== hoje) {
    degrau = s.last_send_date ? await virarDia(s, hoje) : s.day_index;
    if (!s.last_send_date) await saveSettings({ last_send_date: hoje, sent_today: 0 });
    enviadosHoje = 0;
  }

  const cota = ESCADA[Math.min(degrau, ESCADA.length - 1)];
  if (!opts?.force && enviadosHoje >= cota) {
    return { acao: "cota_do_dia_cumprida", detalhe: `${enviadosHoje}/${cota}` };
  }
  if (!opts?.force && s.next_send_at && new Date(s.next_send_at).getTime() > Date.now()) {
    return { acao: "aguardando_intervalo", detalhe: s.next_send_at };
  }

  const alvo = await nextWinbackTarget();
  if (!alvo) return { acao: "fila_vazia" };
  if (!alvo.phone_digits) return { acao: "sem_telefone", alvo: alvo.email };

  const admin = getAdmin();

  // CLAIM atômico: o cron roda de minuto em minuto e uma rodada leva ~30s.
  // Sem isso, duas rodadas sobrepostas abririam a MESMA conversa duas vezes.
  const { data: claimed } = await admin
    .from("winback_targets")
    .update({ status: "sending", updated_at: new Date().toISOString() } as never)
    .eq("id", alvo.id)
    .eq("status", "pending")
    .select("id");
  if (!(claimed ?? []).length) return { acao: "corrida_perdida", alvo: alvo.email };
  /** Devolve pra fila quando o envio não chega a acontecer. */
  const devolver = async (motivo: string) => {
    await admin
      .from("winback_targets")
      .update({ status: "pending", note: motivo, updated_at: new Date().toISOString() } as never)
      .eq("id", alvo.id);
  };

  // O número existe no WhatsApp? Falar com número inexistente é sinal de spam.
  const existe = await wahaNumberExists(alvo.phone_digits);
  if (existe === false) {
    await admin
      .from("winback_targets")
      .update({ status: "skipped", note: "número sem WhatsApp", updated_at: new Date().toISOString() } as never)
      .eq("id", alvo.id);
    return { acao: "pulado_sem_whatsapp", alvo: alvo.email };
  }

  const jid = `${alvo.phone_digits}@s.whatsapp.net`;
  const nome = await primeiroNome(alvo);

  // A abertura nasce do LLM (não de template): 89 mensagens iguais é o padrão
  // que o WhatsApp reconhece como disparo em massa.
  let texto: string;
  try {
    const system = `${buildAgentSystem()}\n\n${winbackMission(alvo, s.credits_cap)}`;
    texto = await agentComplete(system, openingInstruction(alvo, nome), { maxTokens: 300 });
  } catch (e) {
    await devolver("LLM falhou");
    return { acao: "erro_llm", detalhe: e instanceof Error ? e.message : "?", alvo: alvo.email };
  }
  // Rede de segurança: nenhum marcador escapa pra pessoa.
  texto = texto.replace(/\[(MOTIVO|CREDITAR|SAIR|ESCALAR[^\]]*)[^\]]*\]/gi, "").trim();
  // A abertura sai numa mensagem SÓ. O envio humanizado quebra por parágrafo,
  // e no teste isso jogou o "se preferir que eu não escreva mais" pra uma
  // mensagem isolada — destacada assim, ela vira convite pra recusar.
  texto = texto.replace(/\n{2,}/g, "\n").trim();
  if (!texto) {
    await devolver("LLM devolveu vazio");
    return { acao: "erro_llm", detalhe: "texto vazio", alvo: alvo.email };
  }

  const chat = await ensureChat(jid, nome);
  if (!chat) {
    await devolver("não consegui criar a conversa");
    return { acao: "erro_chat", alvo: alvo.email };
  }

  let enviado;
  try {
    enviado = await sendHumanized(jid, texto, { group: false });
  } catch (e) {
    // NÃO devolve pra fila: o envio pode ter saído antes do erro. Fica em
    // 'sending' pra ninguém receber duas vezes — a revisão é manual.
    await admin
      .from("winback_targets")
      .update({ note: `falha no envio: ${e instanceof Error ? e.message : "?"}` } as never)
      .eq("id", alvo.id);
    return { acao: "erro_envio", detalhe: e instanceof Error ? e.message : "?", alvo: alvo.email };
  }

  const agora = new Date().toISOString();
  for (const parte of enviado) {
    await admin.from("agent_messages").insert({
      chat_id: chat.id,
      wa_message_id: parte.waMessageId,
      from_me: true,
      role: "agent",
      kind: "text",
      content: parte.text,
    } as never);
  }
  await admin.from("agent_chats").update({ last_message_at: agora } as never).eq("id", chat.id);
  await admin
    .from("winback_targets")
    .update({ status: "sent", sent_at: agora, chat_id: chat.id, wa_jid: jid, updated_at: agora } as never)
    .eq("id", alvo.id);
  await saveSettings({
    sent_today: enviadosHoje + 1,
    last_send_date: hoje,
    day_index: degrau,
    next_send_at: intervaloAleatorio(),
  });

  return { acao: "contatada", alvo: alvo.email, detalhe: `${enviadosHoje + 1}/${cota} hoje` };
}
