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
import { janelaGarantia, type EventoCompra } from "@/lib/agent/garantia";
import { linhaMoeda, moedaDaCompra, MOEDA_ESCALAR, type EventoMoeda } from "@/lib/agent/moeda";
import { avisoPagamentoPendenteAtivo } from "@/lib/payments/pendente-pure";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";

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
 *  - usa a janela que FECHA PRIMEIRO entre as compras pagas (nunca promete
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
 *
 * ── A CONSTANTE DE 7 DIAS SAIU DAQUI (incidente #265, 05/09/2026) ───────────
 * A janela vinha de `aprovação + 7 dias`. Sete não é a janela deste produto e
 * nunca foi — a conta certa, o que foi medido e por que não existe constante
 * de reserva estão em `garantia.ts`, junto da função pura e dos testes dela.
 * Aqui ficou só a consulta e o texto.
 */
export const GARANTIA_ESCALAR =
  `GARANTIA HOTMART: NÃO foi possível confirmar a janela de garantia deste e-mail. ` +
  `NÃO afirme nada sobre prazo de garantia e escale pro humano.`;

async function linhaGarantiaHotmart(email: string | null): Promise<string> {
  if (!email) return GARANTIA_ESCALAR;
  try {
    const { data, error } = await getAdmin()
      .from("payment_events")
      .select("payload")
      .eq("provider", "hotmart")
      .eq("event_type", "PURCHASE_APPROVED")
      .ilike("buyer_email", email);
    // erro do banco NÃO pode virar "não tem compra": devolve ESCALAR igual.
    if (error || !data?.length) return GARANTIA_ESCALAR;

    const agora = new Date();
    const j = janelaGarantia(data as EventoCompra[], agora);
    if (!j) return GARANTIA_ESCALAR;

    const cabeca =
      `GARANTIA HOTMART (calculado pelo sistema — obedeça esta linha): compra paga em ${diaBR(j.compra)} · `;
    return j.dentro
      ? cabeca +
        `a garantia informada pela Hotmart vai até ${diaBR(j.fim)} · hoje é ${diaBR(agora)} → DENTRO da janela. ` +
        `Cite a DATA, nunca um número de dias: a janela varia por produto.`
      : cabeca +
        `a garantia informada pela Hotmart terminou em ${diaBR(j.fim)} · hoje é ${diaBR(agora)} → FORA da janela. ` +
        `NÃO prometa reembolso; escale pro humano. (Renovação mensal NÃO reabre a garantia. Se a pessoa contesta uma ` +
        `cobrança RECENTE de renovação, isso é cobrança indevida — escale, não trate como garantia.)`;
  } catch {
    return GARANTIA_ESCALAR;
  }
}

/**
 * Em que moeda/país esta pessoa é cobrada (incidente #319, 09/09/2026).
 *
 * Sem esta linha o contexto não tinha moeda nem país, e a única receita que
 * sobrava pra Fast era o roteiro de Pix do `manual.ts` — Brasil-only. Foi
 * assim que o Duarte, em Portugal, pagando 19 EUR, recebeu instrução de Pix.
 *
 * ⚠️ REPARE NO QUE ESTA CONSULTA **NÃO** TEM: o filtro
 * `.eq("event_type", "PURCHASE_APPROVED")` que a consulta da garantia usa
 * logo acima. NÃO é esquecimento. Quem tem cobrança PENDENTE em geral nunca
 * teve compra aprovada — medido em 09/09, dos 4 perfis EUR/Portugal com
 * pendência vencida, 2 têm ZERO evento `PURCHASE_APPROVED`:
 *     duartesoaresconsultor@gmail.com  APPROVED=1
 *     aneto2@gmail.com                 APPROVED=1
 *     carlamsmpro@gmail.com            APPROVED=0  (só BILLET_PRINTED)
 *     info.claudiamonteiro@gmail.com   APPROVED=0  (só BILLET_PRINTED)
 * Copiar aquele filtro pra cá acertaria 2 de 4 e calaria justamente sobre
 * metade de quem o conserto existe pra proteger.
 *
 * A ordem importa: mais recente primeiro, porque `moedaDaCompra` fica com o
 * primeiro evento que tiver moeda legível — a cobrança que está valendo.
 * Erro de banco NÃO vira "não tem moeda" com cara de fato: devolve a mesma
 * linha de NÃO AFIRMAR, igual à garantia.
 */
async function linhaMoedaCobranca(email: string | null): Promise<string> {
  if (!email) return MOEDA_ESCALAR;
  try {
    const { data, error } = await getAdmin()
      .from("payment_events")
      .select("payload")
      .eq("provider", "hotmart")
      .ilike("buyer_email", email)
      .order("received_at", { ascending: false })
      .limit(20);
    if (error || !data?.length) return MOEDA_ESCALAR;
    return linhaMoeda(moedaDaCompra(data as EventoMoeda[]));
  } catch {
    return MOEDA_ESCALAR;
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
      admin.from("credit_transactions").select("kind,ref_type,amount,note,created_at").eq("user_id", profileId).order("created_at", { ascending: false }).limit(6),
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

    // ⚠️ `ref_type` VAI JUNTO, e não é detalhe: `kind` MENTE sobre estorno.
    //
    // Todo estorno é gravado com `kind = 'extra_purchase'` — medido em 07/09:
    // 668 linhas de estorno na base, TODAS com esse kind, em 8 `ref_type`
    // diferentes (video_clone_refund 216, image_refund 169, image_video_refund
    // 78, generation_refund 72, voice_train_refund 67, studio_scene_refund 40,
    // support_refund 14, studio_audio_refund 12). É a mesma armadilha que já
    // quase pagou 13 alunos em dobro: estorno se confere por `ref_type`, NUNCA
    // por `kind`.
    //
    // Mandando só o `kind`, a Fast via um estorno como "extra_purchase" — ou
    // seja, não conseguia distinguir estorno de COMPRA de crédito, e o manual
    // (`manual.ts`, commit 8405eb0) manda ela citar data e valor do estorno
    // quando a linha existe. Sem este campo aquela instrução era impossível de
    // cumprir: ela só podia escalar, inclusive quando o estorno estava ali.
    const txLines = ((txs.data ?? []) as { kind: string; ref_type: string | null; amount: number; note: string | null; created_at: string }[])
      .map((t) => {
        const tipo = t.ref_type ? `${t.kind}/${t.ref_type}` : t.kind;
        return `  - ${dtBR(t.created_at)}: ${t.amount > 0 ? "+" : ""}${t.amount} cr (${tipo}${t.note ? ` — ${t.note.slice(0, 80)}` : ""})`;
      })
      .join("\n");

    const saldo = (profile.credits_subscription ?? 0) + (profile.credits_extra ?? 0);
    const acesso = profile.access_until
      ? `ativo até ${dtBR(profile.access_until)}`
      : profile.access_source
        ? "ativo"
        : "SEM assinatura ativa";

    // Nenhuma das duas deixa de sair: as funções já devolvem a linha de
    // ESCALAR em qualquer falha. É a ausência da linha que produziu o #198.
    const [garantia, moeda] = await Promise.all([
      linhaGarantiaHotmart(profile.email),
      linhaMoedaCobranca(profile.email),
    ]);

    // Pagamento pendente: a MESMA regra do banner do /app, importada — não
    // reescrita (incidente #319). O null check cru que morava nesta linha
    // ignorava a janela de 3 dias e o acesso, então TODOS os 130 perfis com
    // `pending_payment_at` recebiam a afirmação — inclusive 101 cujo código
    // já tinha vencido e 5 que JÁ estavam com acesso ativo (esses tinham
    // pagado: mandá-los pagar de novo é o pior caso). Com a regra certa
    // sobram 23, que são os que de fato têm cobrança viva.
    //
    // O TEXTO ficou neutro de propósito: quem diz se Pix/boleto valem pra
    // esta pessoa é a linha COBRANÇA abaixo, que sabe a moeda. Escrever
    // "Pix/boleto" aqui é afirmar meio de pagamento sem olhar o país — a
    // segunda metade exata do #319.
    const pendente = avisoPagamentoPendenteAtivo({
      pendingPaymentAt: profile.pending_payment_at,
      temAcesso: hasActiveAccess(profile.email, profile.access_until, profile.access_source),
      bypassaCobranca: bypassesBilling(profile.email),
    });

    return [
      `Nome: ${profile.display_name ?? "?"} · E-mail: ${profile.email}`,
      `Plano: ${profile.plan} · Acesso: ${acesso}${pendente ? " · ⚠️ pagamento PENDENTE aguardando confirmação (gerado nas últimas 72h)" : ""}`,
      `Saldo: ${saldo.toLocaleString("pt-BR")} créditos (${(profile.credits_subscription ?? 0).toLocaleString("pt-BR")} do plano + ${(profile.credits_extra ?? 0).toLocaleString("pt-BR")} avulsos)`,
      `Cadastro em: ${dtBR(profile.created_at)}`,
      garantia,
      moeda,
      jobs.length ? `Últimos trabalhos (3 por produto):\n${jobLines(jobs)}` : "Nenhum trabalho ainda (conta sem uso).",
      txLines ? `Últimas movimentações de crédito:\n${txLines}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return null;
  }
}
