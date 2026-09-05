/**
 * Agente de suporte — F4: identidade e contexto da conta. Server-only.
 *
 * Cadeia: JID do WhatsApp → telefone real → perfil do aluno → snapshot
 * SÓ-LEITURA (plano, saldo, jobs recentes, falhas) injetado no prompt.
 *
 * - GOWS identifica contatos por LID (anônimo); o telefone vem do store do
 *   whatsmeow via WAHA GET /lids/{lid} (mapeamento lid→pn).
 * - A plataforma NÃO coleta telefone no cadastro — o match é com o
 *   checkout_phone que a Hotmart manda no webhook (payment_events.payload).
 *   Telefone é evidência forte (ninguém "chuta" o telefone de outro aluno);
 *   NUNCA vincular por e-mail dito na conversa (qualquer um alegaria).
 * - Best-effort: qualquer falha aqui devolve null e a Fast responde sem
 *   contexto (nunca derruba o pipeline).
 */
import { getAdmin } from "@/lib/db/admin";
import { agentProvider } from "@/lib/agent/provider";
import { wahaLidToPhone } from "@/lib/agent/waha";
import type { AgentChatRow, ProfileRow } from "@/lib/db/types";

/** Telefone (dígitos) a partir do JID do chat. @lid → consulta a WAHA. */
export async function phoneFromJid(jid: string): Promise<string | null> {
  if (jid.endsWith("@s.whatsapp.net") || jid.endsWith("@c.us")) {
    const digits = jid.split("@")[0].replace(/\D/g, "");
    return digits || null;
  }
  if (jid.endsWith("@lid") && agentProvider() === "waha") {
    return wahaLidToPhone(jid);
  }
  return null;
}

/**
 * Variantes do telefone pra casar com o checkout_phone da Hotmart, que vem
 * em formato LOCAL sem o código do país (ex.: "21983033483"). O WhatsApp
 * entrega com país (ex.: "5521983033483") e números BR antigos podem não
 * ter o 9º dígito — gera as combinações razoáveis.
 */
function phoneCandidates(digits: string): string[] {
  const out = new Set<string>([digits]);
  if (digits.startsWith("55") && digits.length >= 12) {
    const local = digits.slice(2); // DDD + número
    out.add(local);
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);
    if (rest.length === 8) out.add(`${ddd}9${rest}`); // sem 9 → com 9
    if (rest.length === 9 && rest.startsWith("9")) out.add(`${ddd}${rest.slice(1)}`); // com 9 → sem 9
  }
  return [...out];
}

/** Acha o perfil do aluno pelo telefone (via checkout_phone da Hotmart). */
async function matchProfileByPhone(digits: string): Promise<string | null> {
  const admin = getAdmin();
  const { data } = await admin
    .from("payment_events")
    .select("buyer_email, received_at")
    .in("payload->data->buyer->>checkout_phone", phoneCandidates(digits))
    .not("buyer_email", "is", null)
    .order("received_at", { ascending: false })
    .limit(5);
  const rows = (data ?? []) as { buyer_email: string | null }[];
  const email = rows.find((r) => r.buyer_email)?.buyer_email;
  if (!email) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return (profile as { id: string } | null)?.id ?? null;
}

/**
 * Garante wa_phone e profile_id no chat (privado). Telefone resolve UMA vez;
 * o match com perfil re-tenta a cada mensagem enquanto não achar (o aluno
 * pode comprar depois da primeira conversa). Devolve o profile_id ou null.
 */
export async function ensureChatIdentity(chat: AgentChatRow): Promise<string | null> {
  try {
    if (chat.kind !== "private") return null;
    if (chat.profile_id) return chat.profile_id;

    const admin = getAdmin();
    let phone = chat.wa_phone;
    if (!phone) {
      phone = await phoneFromJid(chat.wa_jid);
      if (!phone) return null;
      await admin.from("agent_chats").update({ wa_phone: phone } as never).eq("id", chat.id);
    }

    const profileId = await matchProfileByPhone(phone);
    if (!profileId) return null;
    await admin.from("agent_chats").update({ profile_id: profileId } as never).eq("id", chat.id);
    return profileId;
  } catch {
    return null;
  }
}

const dtBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "?";

type JobLine = { label: string; name: string | null; status: string | null; error: string | null; at: string | null };

function jobLines(lines: JobLine[]): string {
  return lines
    .map((j) => {
      const err = j.status === "failed" && j.error ? ` — erro: ${j.error.slice(0, 120)}` : "";
      return `  - ${j.label}${j.name ? ` "${j.name}"` : ""}: ${j.status ?? "?"} (${dtBR(j.at)})${err}`;
    })
    .join("\n");
}

/**
 * COMO O EXTRATO É ROTULADO PRO MODELO (#260, 05/09).
 *
 * O QUE ACONTECEU: a Fast AFIRMOU pra uma aluna um estorno que não existia.
 * O extrato que ia pro prompt trazia só `kind` e `note`, e todo estorno é
 * gravado por `add_extra_credits` (scripts/13_credits.sql:131) com
 * kind='extra_purchase' e note='pacote avulso' FIXOS. Ou seja: no texto que o
 * modelo lia, estorno e compra de pacote eram a MESMA linha, palavra por
 * palavra. Ele leu três estornos de 19/08 como compras avulsas.
 *
 * A ÚNICA coisa que distingue os dois é `ref_type` — que não vinha no select.
 * É a mesma armadilha já registrada na casa: estorno se confere por
 * `ref_type`, NUNCA por `kind`.
 *
 * NÃO é só `generation_refund`: existem 12 ref_types de estorno hoje
 * (generation, video_clone, voice_train, image, image_video, studio_audio,
 * studio_face, studio_montage, studio_scene, edicao_broll, edicao_captions),
 * e todos caem no mesmo 'extra_purchase / pacote avulso'. Por isso a regra é o
 * SUFIXO `_refund`, e não uma lista fixa — ferramenta nova que estorne amanhã
 * já nasce rotulada certo em vez de virar o próximo #260.
 */
export function rotuloTransacao(t: { kind: string; ref_type: string | null; amount: number }): string {
  const ref = (t.ref_type ?? "").toLowerCase();
  if (ref.endsWith("_refund")) return "ESTORNO — devolução de crédito por falha nossa (NÃO é compra)";
  if (ref === "courtesy_grant") return "cortesia dada pela equipe (NÃO é compra)";
  if (t.amount < 0) return "consumo (crédito gasto em um trabalho)";
  if (t.kind === "subscription_grant") return "créditos do plano (renovação da assinatura)";
  if (t.kind === "extra_purchase") return "compra de pacote avulso";
  return t.kind;
}

/**
 * Janela do extrato mandado pro modelo. Movimentação velha lida como "recente"
 * foi parte do #260 — os estornos que ele citou eram de 17 dias antes. O bloco
 * diz a janela em voz alta (ver `buildAccountContext`), porque uma lista vazia
 * aqui NÃO pode ser lida como "esta conta nunca teve movimentação".
 */
const EXTRATO_DIAS = 7;

/** Janela de garantia da Hotmart, em dias, contada da aprovação da compra. */
const GARANTIA_DIAS = 7;

const diaBR = (d: Date) =>
  d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * A linha da GARANTIA, já CALCULADA — não a data crua.
 *
 * POR QUE ESTA FUNÇÃO EXISTE (incidente #198, 30/08/2026): o manual mandava a
 * Fast escolher entre "está na garantia" e "escalar pro humano" (manual.ts:259
 * e :263) usando uma data que NINGUÉM colocava no contexto dela. Sem a data a
 * escolha virava chute — e o chute caía no lado generoso, que é o lado que
 * promete dinheiro de volta. Em 30/08 ela escreveu ao Natanael "como você está
 * dentro dos 7 primeiros dias, a garantia total com reembolso é processada
 * pela Hotmart"; a compra dele era de 18/08, ou seja o dia 12, com a janela
 * fechada desde 25/08.
 *
 * ⚠️ ENTREGAR A DATA CRUA NÃO BASTA, e isso foi MEDIDO no próprio caso: o
 * contexto já trazia "Cadastro em: 18/08" e ela ainda assim afirmou 7 dias.
 * Modelo não é confiável pra fazer aritmética de prazo no meio de uma conversa
 * sobre dinheiro. Então a CONTA vem pronta daqui, e o manual só obedece.
 *
 * Conservadora de propósito, nas três pontas:
 *  - usa a compra aprovada MAIS ANTIGA (a janela fecha antes → nunca promete
 *    reembolso a mais);
 *  - só considera compra PAGA (`price.value > 0`): adesão de R$0 não tem o que
 *    reembolsar. É a mesma regra do `pagou_de_verdade.cjs`, e existe porque a
 *    Hotmart emite mensalidade OVERDUE pra quem nunca pagou (18/08: devolvemos
 *    1.356.554 créditos a 14 pessoas por confundir valor com pagamento);
 *  - quando não acha compra, ou quando a consulta falha, devolve a linha de
 *    ESCALAR — nunca o silêncio. Silêncio aqui é o bug: foi a AUSÊNCIA da
 *    informação que deixou o chute solto.
 *
 * O e-mail do perfil pode não ser o e-mail da compra (o caso "duas contas" do
 * #195). Nesse caso não achamos a compra e a linha manda escalar, que é o
 * desfecho certo: quem decide reembolso de conta ambígua é gente.
 */
async function linhaGarantiaHotmart(email: string | null): Promise<string> {
  const ESCALAR =
    `GARANTIA HOTMART: NÃO foi possível confirmar a data da compra deste e-mail. ` +
    `NÃO afirme nada sobre a janela de ${GARANTIA_DIAS} dias e escale pro humano.`;
  if (!email) return ESCALAR;
  try {
    const { data, error } = await getAdmin()
      .from("payment_events")
      .select("payload")
      .eq("provider", "hotmart")
      .eq("event_type", "PURCHASE_APPROVED")
      .ilike("buyer_email", email);
    // erro do banco NÃO pode virar "não tem compra": devolve ESCALAR igual.
    if (error || !data?.length) return ESCALAR;

    type Ev = { payload?: { data?: { purchase?: { approved_date?: unknown; order_date?: unknown; price?: { value?: unknown } } } } };
    const ms = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);

    const aprovadas = (data as Ev[])
      .map((e) => e.payload?.data?.purchase)
      .filter((c) => Number(c?.price?.value ?? 0) > 0)
      .map((c) => ms(c?.approved_date) ?? ms(c?.order_date))
      .filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t > 0);
    if (!aprovadas.length) return ESCALAR;

    const compra = new Date(Math.min(...aprovadas));
    const fim = new Date(compra.getTime() + GARANTIA_DIAS * 86_400_000);
    const agora = new Date();

    return agora.getTime() <= fim.getTime()
      ? `GARANTIA HOTMART (calculado pelo sistema — obedeça esta linha): primeira compra paga em ${diaBR(compra)} · ` +
        `a janela de ${GARANTIA_DIAS} dias vai até ${diaBR(fim)} · hoje é ${diaBR(agora)} → DENTRO da janela.`
      : `GARANTIA HOTMART (calculado pelo sistema — obedeça esta linha): primeira compra paga em ${diaBR(compra)} · ` +
        `a janela de ${GARANTIA_DIAS} dias terminou em ${diaBR(fim)} · hoje é ${diaBR(agora)} → FORA da janela. ` +
        `NÃO prometa reembolso; escale pro humano. (Renovação mensal NÃO reabre a garantia. Se a pessoa contesta uma ` +
        `cobrança RECENTE de renovação, isso é cobrança indevida — escale, não trate como garantia.)`;
  } catch {
    return ESCALAR;
  }
}

/**
 * Snapshot compacto da conta pro system prompt da Fast (SÓ leitura).
 * Últimos jobs de cada produto + saldo + transações recentes de crédito.
 */
export async function buildAccountContext(profileId: string): Promise<string | null> {
  try {
    const admin = getAdmin();
    const { data: p } = await admin.from("profiles").select("*").eq("id", profileId).maybeSingle();
    if (!p) return null;
    const profile = p as ProfileRow;

    const recent = (table: string, cols: string) =>
      admin.from(table as never).select(cols).eq("user_id", profileId).order("created_at", { ascending: false }).limit(3);

    const [voices, gens, clones, images, videos, txs] = await Promise.all([
      recent("voices", "name,status,error_message,created_at"),
      recent("generations", "name,status,error_message,created_at"),
      recent("video_clones", "name,status,error_message,created_at"),
      recent("image_generations", "name,status,error_message,created_at"),
      // scene_count entra no nome: em 27/08 a Fast apontou pra aluna "o projeto
      // das 16 cenas" e era o projeto ERRADO (1 cena) — ela apagou esse. Sem o
      // número de cenas o bot não tem como distinguir um projeto do outro.
      recent("video_projects", "name,status,error_message,created_at,scene_count"),
      // ref_type/ref_id são OBRIGATÓRIOS aqui (#260): sem eles estorno e compra
      // avulsa chegam idênticos no prompt. Janela de 7 dias pra não apresentar
      // movimentação velha como recente.
      admin
        .from("credit_transactions")
        .select("kind,amount,note,ref_type,ref_id,created_at")
        .eq("user_id", profileId)
        .gte("created_at", new Date(Date.now() - EXTRATO_DIAS * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    type R = { name?: string | null; status?: string | null; error_message?: string | null; created_at?: string | null; scene_count?: number | null };
    const lines = (label: string, rows: unknown): JobLine[] =>
      ((rows ?? []) as R[]).map((r) => ({
        label,
        name: r.name ? (typeof r.scene_count === "number" ? `${r.name} (${r.scene_count} cenas)` : r.name) : null,
        status: r.status ?? null,
        error: r.error_message ?? null,
        at: r.created_at ?? null,
      }));

    const jobs = [
      ...lines("Voz (treino)", voices.data),
      ...lines("Áudio (TTS)", gens.data),
      ...lines("Vídeo Clone", clones.data),
      ...lines("Imagem", images.data),
      ...lines("Vídeo História", videos.data),
    ];

    // Cada linha vai ROTULADA pelo ref_type (#260). O rótulo vem antes do
    // kind/note crus de propósito: 'extra_purchase — pacote avulso' foi
    // literalmente o texto que o modelo leu como compra num estorno.
    const txLines = (
      (txs.data ?? []) as {
        kind: string;
        amount: number;
        note: string | null;
        ref_type: string | null;
        ref_id: string | null;
        created_at: string;
      }[]
    )
      .map((t) => {
        const cru = `${t.kind}${t.ref_type ? `/${t.ref_type}` : ""}${t.note ? ` — ${t.note.slice(0, 80)}` : ""}`;
        return `  - ${dtBR(t.created_at)}: ${t.amount > 0 ? "+" : ""}${t.amount} cr · ${rotuloTransacao(t)} [${cru}]`;
      })
      .join("\n");

    const saldo = (profile.credits_subscription ?? 0) + (profile.credits_extra ?? 0);
    const acesso = profile.access_until
      ? `ativo até ${dtBR(profile.access_until)}`
      : profile.access_source
        ? "ativo"
        : "SEM assinatura ativa";

    // Nunca deixa de sair: a função já devolve a linha de ESCALAR em qualquer
    // falha. É a ausência desta linha que produziu o #198.
    const garantia = await linhaGarantiaHotmart(profile.email);

    return [
      `Nome: ${profile.display_name ?? "?"} · E-mail: ${profile.email}`,
      `Plano: ${profile.plan} · Acesso: ${acesso}${profile.pending_payment_at ? " · ⚠️ Pix/boleto PENDENTE aguardando pagamento" : ""}`,
      `Saldo: ${saldo.toLocaleString("pt-BR")} créditos (${(profile.credits_subscription ?? 0).toLocaleString("pt-BR")} do plano + ${(profile.credits_extra ?? 0).toLocaleString("pt-BR")} avulsos)`,
      `Cadastro em: ${dtBR(profile.created_at)}`,
      garantia,
      jobs.length ? `Últimos trabalhos (3 por produto):\n${jobLines(jobs)}` : "Nenhum trabalho ainda (conta sem uso).",
      // A janela precisa estar ESCRITA, e o vazio precisa dizer o que é. Sem
      // isto o #260 só troca de lado: uma lista vazia por causa do recorte de
      // 7 dias seria lida como "esta conta nunca comprou/nunca foi estornada",
      // e a Fast afirmaria a ausência com a mesma confiança com que afirmou o
      // estorno inexistente.
      txLines
        ? `Movimentações de crédito nos últimos ${EXTRATO_DIAS} dias (o rótulo depois do "·" é o que MANDA — obedeça a ele, não ao texto entre colchetes):\n${txLines}`
        : `Nenhuma movimentação de crédito nos últimos ${EXTRATO_DIAS} dias. ATENÇÃO: isto é só a janela consultada — NÃO afirme que a pessoa nunca comprou, nunca gastou ou nunca foi estornada. Se ela perguntar de algo mais antigo, diga que a equipe vai conferir.`,
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return null;
  }
}
