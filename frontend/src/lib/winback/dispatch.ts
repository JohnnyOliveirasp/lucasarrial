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
import { wahaNumberExists, wahaReachoutLockUntil } from "@/lib/agent/waha";
import { connectionState } from "@/lib/agent/provider";
import { nextWinbackTarget } from "@/lib/winback/targets";
import {
  openingInstruction,
  winbackMission,
  WINBACK_MAX_PARTS,
  tirarCaraDeRobo,
} from "@/lib/winback/script";
import type { AgentChatRow, WinbackSettingsRow, WinbackTargetRow } from "@/lib/db/types";

/** Contatos por dia, degrau a degrau. Do 6º dia em diante, 15/dia. */
const ESCADA = [5, 8, 10, 12, 15] as const;
/**
 * Intervalo entre um contato e outro: ~1 HORA (ordem do Johnny 10/08), com
 * variação pra não sair cadenciado. Cinco mensagens espalhadas em cinco horas
 * não têm cara de campanha — e foi uma rajada que rendeu tranca de 24h.
 */
const INTERVALO_ALVO_MS = 60 * 60 * 1000;
const INTERVALO_MIN_MS = 15 * 60 * 1000; // piso quando a cota do dia é grande
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

/**
 * Quando falar com a próxima pessoa.
 *
 * Alvo: ~1 hora entre contatos (ordem do Johnny). Com 5 no dia isso ocupa 5 das
 * 10 horas da janela e fica bem espalhado. Quando a escada sobe (12, 15/dia),
 * uma por hora não caberia — aí o intervalo encolhe só o necessário pra cota
 * caber no que resta do dia, nunca abaixo de 15 min.
 * O ±25% aleatório existe porque intervalo cravado é assinatura de robô.
 */
function intervaloAleatorio(fator = 1, faltamHoje = 1): string {
  const horasRestantes = Math.max(0.5, JANELA_FIM - brtAgora().hora);
  const couberNoDia = (horasRestantes * 3600_000) / Math.max(1, faltamHoje);
  const base = Math.max(INTERVALO_MIN_MS, Math.min(INTERVALO_ALVO_MS, couberNoDia));
  const ms = base * (0.75 + Math.random() * 0.5) * fator;
  return new Date(Date.now() + ms).toISOString();
}

/**
 * Agenda o próximo contato DEPOIS DE QUALQUER TENTATIVA — inclusive as que
 * falharam.
 *
 * Foi o furo do dia 10/08: o intervalo só era agendado no sucesso, então cada
 * erro liberava o cron pra tentar de novo no minuto seguinte, com OUTRA pessoa.
 * Deu 12 abordagens a 12 desconhecidos em 12 minutos — exatamente a rajada que
 * a proteção existia pra evitar. Depois disso o WhatsApp passou a recusar todo
 * envio para contato novo (erro 463), enquanto o celular seguia funcionando
 * normal: o problema não era o número, era o nosso ritmo.
 * Em falha o intervalo é DOBRADO: se algo está errado, insistir rápido piora.
 */
async function agendarProximo(falhou: boolean, faltamHoje = 1): Promise<void> {
  await saveSettings({ next_send_at: intervaloAleatorio(falhou ? 2 : 1, faltamHoje) });
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

  // A SESSÃO ESTÁ DE PÉ? (10/08: o WhatsApp derrubou a sessão 3s depois da 1ª
  // mensagem; o cron seguiu consumindo a fila e queimou 60 pessoas em 1h sem
  // enviar nada a ninguém.) Checar ANTES de tocar na fila.
  const conexao = await connectionState();
  if (conexao !== "open") return { acao: "whatsapp_fora_do_ar", detalhe: conexao };

  // O WhatsApp trancou a conta pra abordar desconhecido? (reachoutTimelock,
  // 24h). Enquanto durar, TODA tentativa volta com 463 — então nem tira
  // ninguém da fila, e já agenda a volta pra depois que a tranca cair.
  const trancadoAte = await wahaReachoutLockUntil();
  if (trancadoAte) {
    await saveSettings({
      next_send_at: new Date(trancadoAte + 5 * 60 * 1000).toISOString(),
      last_note: `WhatsApp trancado para contato novo até ${new Date(trancadoAte).toISOString()}`,
    });
    return { acao: "trancado_pelo_whatsapp", detalhe: new Date(trancadoAte).toISOString() };
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

  // A PARTIR DAQUI a tentativa já conta: agenda o intervalo AGORA, antes de
  // qualquer coisa poder falhar. Assim nenhum caminho de erro deixa o cron
  // livre pra abordar outra pessoa no minuto seguinte (foi o que produziu a
  // rajada de 12 desconhecidos em 12 minutos em 10/08).
  await agendarProximo(false, Math.max(1, cota - enviadosHoje));
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
  texto = tirarCaraDeRobo(
    texto.replace(/\[(MOTIVO|CREDITAR|SAIR|ESCALAR[^\]]*)[^\]]*\]/gi, "").trim(),
  );
  // A abertura sai PICOTADA (ordem do Johnny 10/08): 2-3 mensagens curtas com
  // "digitando…" entre elas, como gente escreve. O sendHumanized quebra nas
  // linhas em branco, então elas são preservadas de propósito aqui — só a
  // frase da saída fácil é que não pode ficar sozinha (isso o prompt garante).
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
    enviado = await sendHumanized(jid, texto, { group: false, maxParts: WINBACK_MAX_PARTS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "?";
    // Erro de SESSÃO = a mensagem com certeza não saiu (a WAHA recusa antes de
    // enviar) → devolve pra fila, a pessoa continua por contatar.
    // Qualquer outro erro fica em 'sending': o envio PODE ter saído, e receber
    // duas vezes é pior do que não receber. Revisão manual.
    // 463 = o servidor do WhatsApp RECUSOU o envio (acontece quando ele
    // desconfia do ritmo). Como a sessão caída, é certeza de que nada saiu.
    const sessaoFora =
      /Session status is not as expected|status.*FAILED|ECONNREFUSED|error 463/i.test(msg);
    // erro dobra o intervalo: insistir rápido piora
    await agendarProximo(true, Math.max(1, cota - enviadosHoje));
    await admin
      .from("winback_targets")
      .update({
        ...(sessaoFora ? { status: "pending" as const } : {}),
        note: `falha no envio: ${msg.slice(0, 200)}`,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", alvo.id);
    return { acao: sessaoFora ? "erro_sessao" : "erro_envio", detalhe: msg, alvo: alvo.email };
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
    next_send_at: intervaloAleatorio(1, Math.max(1, cota - enviadosHoje - 1)),
  });

  return { acao: "contatada", alvo: alvo.email, detalhe: `${enviadosHoje + 1}/${cota} hoje` };
}
