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
import {
  janelaGarantia,
  janelasPorProduto,
  blocoGarantiaMultiProduto,
  diaBR,
  GARANTIA_ESCALAR,
  type EventoCompra,
} from "@/lib/agent/garantia";
import { qaVeredito, AVISO_QA_NAO_PROVA } from "@/lib/generations/qa-veredito";
import { entitlementValeAcesso } from "@/lib/payments/acesso-regra";
import { fraseDeAcessoParaAgente } from "@/lib/payments/acesso-frase";
import { blocoSgpParaAgente, type PedidoNoContexto } from "@/lib/agent/sgp-passo";

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

type JobLine = {
  label: string;
  name: string | null;
  status: string | null;
  error: string | null;
  at: string | null;
  /**
   * Ressalva do QA (incidente 702cc916), SÓ nas gerações que têm uma. Existe
   * porque uma geração com chunk reprovado sai daqui como `ready` com
   * `error_message = null` — ou seja, indistinguível de uma geração perfeita
   * para quem atende. Ver `lib/generations/qa-veredito.ts`.
   */
  ressalva?: string | null;
};

function jobLines(lines: JobLine[]): string {
  return lines
    .map((j) => {
      const err = j.status === "failed" && j.error ? ` — erro: ${j.error.slice(0, 120)}` : "";
      // Linha própria e indentada: o `status: ready` continua verdadeiro (o
      // arquivo existe e foi entregue), a ressalva é o que o status não conta.
      const qa = j.ressalva ? `\n      ${j.ressalva}` : "";
      return `  - ${j.label}${j.name ? ` "${j.name}"` : ""}: ${j.status ?? "?"} (${dtBR(j.at)})${err}${qa}`;
    })
    .join("\n");
}

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
// A constante e o texto do multi-produto vivem em `garantia.ts` (sem import de
// banco), que é o único jeito de TESTAR a string que chega no prompt. Re-exporto
// daqui porque este era o endereço dela desde o #198.
export { GARANTIA_ESCALAR };

/**
 * O status da MELHOR linha viva de `entitlements` — "a assinatura desta conta
 * renova ou termina?". Incidente #303.
 *
 * Existe porque `profiles.access_until` sozinho NÃO responde: para assinatura
 * ACTIVE aquela data é a próxima COBRANÇA (medido em 17/09: 605 de 606 perfis
 * com entitlement `active` vivo têm `access_until` igual, ao minuto, a
 * `raw_event->purchase->date_next_charge`), e para CANCELED é o fim do período
 * pago. A mesma coluna, dois significados opostos.
 *
 * O desempate é o de `entitlements-pure.melhorAcesso`, que é quem escreveu o
 * `access_until` do perfil: "active" ganha de "canceled"; empatado, a data mais
 * longe. Ler por outro critério daria o status de UMA linha e a data de OUTRA.
 *
 * ⚠️ Devolve `null` quando a leitura falha, e isso é decisão, não descuido:
 * `null` leva a frase para o ramo `desconhecido`, que manda a Fast ESCALAR em
 * vez de afirmar. É o princípio do #282 — erro de leitura não pode virar
 * afirmação sobre a assinatura de um pagante. Best-effort igual ao resto deste
 * arquivo: nada aqui derruba o pipeline.
 */
async function statusDaAssinatura(profileId: string): Promise<string | null> {
  try {
    const { data, error } = await getAdmin()
      .from("entitlements")
      .select("status,access_until")
      .eq("user_id", profileId);
    if (error || !data?.length) return null;
    const agoraIso = new Date().toISOString();
    const vivas = (data as { status: string; access_until: string | null }[]).filter((e) =>
      entitlementValeAcesso(e, agoraIso),
    );
    if (!vivas.length) return null;
    return vivas.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      const va = a.access_until === null ? Infinity : new Date(a.access_until).getTime();
      const vb = b.access_until === null ? Infinity : new Date(b.access_until).getTime();
      return vb - va;
    })[0].status;
  } catch {
    return null;
  }
}

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

    // ── 2+ PRODUTOS: uma linha POR produto (incidente #265, falso positivo da
    // Evelyn, 14/09). Com UMA linha sem dono, a Fast atribui a data ao produto
    // que o aluno perguntou — com 2+ compras é erro garantido, não risco.
    // Medido em 15/09: 36 alunos têm compras de 2+ produtos DIFERENTES (26 deles
    // misturando produto pago com adesão de R$ 0, que é a forma exata do caso da
    // Evelyn). Os "237 com 2+ janelas" da primeira medição contavam RENOVAÇÃO do
    // mesmo produto, que é política do Johnny e não passa por aqui.
    const porProduto = janelasPorProduto(data as EventoCompra[], agora);
    const bloco = blocoGarantiaMultiProduto(porProduto, agora);
    if (bloco) return bloco;

    // Um produto só (ou nenhuma janela confirmada): caminho de sempre, intacto.
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
 * A leitura do #315: ÚLTIMO LOGIN + ESTADO DO PEDIDO NO SGP.
 *
 * A decisão e todo o texto moram em `sgp-passo.ts` (puro e sob teste, igual
 * `garantia.ts`); aqui é só banco. As duas consultas que faltavam:
 *
 *  1. `auth.users.last_sign_in_at` — ⚠️ NÃO vem de `profiles`. Conferi o
 *     `information_schema` em 17/09: `profiles` tem 19 colunas e
 *     `last_sign_in_at` NÃO é uma delas. A coluna é do schema `auth`, que o
 *     client do Supabase não expõe por `.from()`, então a leitura é pela API de
 *     admin do Auth (`auth.admin.getUserById`), mesmo caminho de
 *     `lib/api/auth.ts:87`. Vale registrar porque existem scripts em `_frank/`
 *     fazendo `profiles.select("last_sign_in_at")` — isso não lê nada.
 *
 *  2. `sgp_pedidos` POR CONTA **E POR E-MAIL**, e o "e por e-mail" é o ponto
 *     inteiro: `user_id` só é preenchido no "Confirmar e Enviar". Medido em
 *     17/09, 311 pedidos: dos 214 sem `user_id`, TODOS estão em passo de wizard
 *     (dados 107 · foto 83 · audio 22 · revisao 2) e os 96 `pronto` têm todos
 *     `user_id`. Buscar só por conta, como faz `sgp/pedido.lerPedido`, acharia
 *     apenas pedido já finalizado e seria cego aos 214 em andamento — que são
 *     exatamente os casos em que "em que passo ele está?" importa. 136 desses
 *     214 têm perfil casável por e-mail hoje.
 *
 * Best-effort igual ao resto do arquivo, mas com uma diferença que é decisão:
 * falha de leitura NÃO vira "não tem pedido". Vira "não consegui ler", que leva
 * a Fast a escalar — princípio do #282, e o oposto exato do #315, onde a
 * ausência de dado virou afirmação sobre onde o material estava.
 */
async function blocoDoSgp(profileId: string, email: string | null): Promise<string> {
  const admin = getAdmin();

  let ultimoLogin: string | null = null;
  let loginDesconhecido = false;
  try {
    const { data, error } = await admin.auth.admin.getUserById(profileId);
    if (error) throw error;
    ultimoLogin = data.user?.last_sign_in_at ?? null;
  } catch {
    loginDesconhecido = true;
  }

  let pedidos: PedidoNoContexto[] = [];
  let pedidosDesconhecidos = false;
  try {
    // `select("*")` de propósito: as colunas opcionais do SGP (migrations
    // 106/109/110/116) podem não existir na base, e nomeá-las derrubaria a
    // consulta inteira. Ver o comentário de `SgpPedidoRow`.
    const [porConta, porEmail] = await Promise.all([
      admin.from("sgp_pedidos" as never).select("*").eq("user_id", profileId),
      email
        ? admin.from("sgp_pedidos" as never).select("*").ilike("email", email)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (porConta.error) throw porConta.error;
    if (porEmail.error) throw porEmail.error;

    type Linha = {
      id: string;
      user_id: string | null;
      email: string | null;
      status: PedidoNoContexto["status"];
      criado_em: string | null;
      atualizado_em: string | null;
      enviado_em: string | null;
      email_verificado_at: string | null;
      codigo_expira_em: string | null;
      erro: string | null;
      fotos: unknown[] | null;
      audios: unknown[] | null;
    };

    // ⚠️ O `ilike` acima é só pra não depender da caixa do e-mail gravado; a
    // igualdade de verdade é conferida aqui, em minúsculas e por inteiro.
    // Motivo: em `ilike` o `_` é CURINGA de um caractere, e e-mail com
    // underscore (`joao_silva@x.com`) casaria com o endereço de outra pessoa.
    // Anexar o pedido de um terceiro a esta conta seria pior que não achar
    // nenhum, então o filtro é estrito.
    //
    // NÃO uso a normalização de Gmail (`sgp/compradores.chaveEmail`) aqui: ela
    // funde pontos e `+tag`, o que ALARGA o casamento. Num painel interno isso
    // desduplica; num contexto que a Fast usa pra afirmar o que chegou, alargar
    // é arriscar falar do material de outra pessoa. Conservador nas duas pontas.
    const alvo = (email ?? "").trim().toLowerCase();
    const vistos = new Set<string>();
    for (const linha of [
      ...((porConta.data ?? []) as unknown as Linha[]),
      ...((porEmail.data ?? []) as unknown as Linha[]),
    ]) {
      const daConta = linha.user_id === profileId;
      const doEmail = !!alvo && (linha.email ?? "").trim().toLowerCase() === alvo;
      if (!daConta && !doEmail) continue;
      if (vistos.has(linha.id)) continue;
      vistos.add(linha.id);
      pedidos.push({
        status: linha.status,
        criado_em: linha.criado_em,
        atualizado_em: linha.atualizado_em,
        enviado_em: linha.enviado_em,
        email_verificado_at: linha.email_verificado_at,
        codigo_expira_em: linha.codigo_expira_em,
        erro: linha.erro,
        fotos: Array.isArray(linha.fotos) ? linha.fotos.length : 0,
        audios: Array.isArray(linha.audios) ? linha.audios.length : 0,
        porEmail: !daConta,
      });
    }
  } catch {
    pedidos = [];
    pedidosDesconhecidos = true;
  }

  return blocoSgpParaAgente({ pedidos, ultimoLogin, loginDesconhecido, pedidosDesconhecidos });
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
      // `qa` entra SÓ aqui (incidente 702cc916): é a única tabela com a
      // telemetria do laço de QA do worker. Uma geração cujo QA esgotou as
      // tentativas é gravada como `ready` / `error_message = null` — sem ler
      // este jsonb, a Fast vê "geração perfeita" enquanto o aluno reclama da
      // voz, e o atendimento cai em culpar o aluno.
      recent("generations", "name,status,error_message,created_at,qa"),
      recent("video_clones", "name,status,error_message,created_at"),
      recent("image_generations", "name,status,error_message,created_at"),
      // scene_count entra no nome: em 27/08 a Fast apontou pra aluna "o projeto
      // das 16 cenas" e era o projeto ERRADO (1 cena) — ela apagou esse. Sem o
      // número de cenas o bot não tem como distinguir um projeto do outro.
      recent("video_projects", "name,status,error_message,created_at,scene_count"),
      admin.from("credit_transactions").select("kind,ref_type,amount,note,created_at").eq("user_id", profileId).order("created_at", { ascending: false }).limit(6),
    ]);

    type R = { name?: string | null; status?: string | null; error_message?: string | null; created_at?: string | null; scene_count?: number | null; qa?: unknown };
    const lines = (label: string, rows: unknown): JobLine[] =>
      ((rows ?? []) as R[]).map((r) => ({
        label,
        name: r.name ? (typeof r.scene_count === "number" ? `${r.name} (${r.scene_count} cenas)` : r.name) : null,
        status: r.status ?? null,
        error: r.error_message ?? null,
        at: r.created_at ?? null,
        // Só `generations` pede a coluna; nas outras `r.qa` vem undefined e o
        // veredito devolve null — nenhuma linha extra, nenhum prompt inflado.
        ressalva: qaVeredito(r.qa)?.linha ?? null,
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

    // ⚠️ A DATA VAI ACOMPANHADA DO STATUS — incidente #303. Até aqui esta linha
    // era `ativo até ${dtBR(profile.access_until)}`, e a string entregue ao
    // agente NÃO carregava se a assinatura renova. Para assinatura ACTIVE
    // `access_until` é a PRÓXIMA COBRANÇA, então "ativo até 09/09" descrevia uma
    // RENOVAÇÃO com cara de vencimento e o agente inventava urgência: em 07/09 a
    // casa escreveu a uma aluna "o seu acesso está indo até 09/09, ou seja, mais
    // dois dias" (Enviados uid 1243) sobre a assinatura HCIA7GIM, ACTIVE, que ia
    // renovar naquele dia — 27.436 créditos queimados nas 8 horas seguintes.
    //
    // Mesmo desenho de `linhaGarantiaHotmart()` três linhas abaixo, criada
    // depois do #198 pela mesma razão: o dado que falta vira afirmação errada.
    // A frase mora em `payments/acesso-frase.ts` (puro, sob teste) porque a
    // armadilha não é do agente — é da LEITURA DA COLUNA, e em 08/09 ela
    // reapareceu num e-mail escrito à mão para 8 pagantes.
    const acesso = fraseDeAcessoParaAgente(
      {
        accessUntil: profile.access_until ?? null,
        accessSource: profile.access_source ?? null,
        statusEntitlement: await statusDaAssinatura(profileId),
      },
      new Date().toISOString(),
    );

    // Nunca deixa de sair: as duas funções já devolvem a linha de ESCALAR (ou
    // de "não consegui ler") em qualquer falha. É a ausência da primeira que
    // produziu o #198, e a da segunda que produziu o #315. Em paralelo porque
    // são leituras independentes e este caminho está no meio de uma resposta.
    const [garantia, blocoSgp] = await Promise.all([
      linhaGarantiaHotmart(profile.email),
      blocoDoSgp(profileId, profile.email),
    ]);

    // Pix/boleto pendente: MESMA janela de 3 dias que o /app já aplica em
    // `app/layout.tsx` (`pendingRecent`). Aqui a checagem era um null check CRU
    // sobre `pending_payment_at`, sem recência e sem "ainda sem acesso" — então
    // a tela do aluno escondia o aviso quando o código vencia e a Fast seguia
    // anunciando o MESMO Pix como pendente para sempre (incidente #319).
    // Medido em produção em 09/09: 131 perfis com a flag, 106 dela mais velhos
    // que a própria janela do /app, e 12 sem acesso — o pior com um Pix de
    // 14/07, 57 dias. Um código de Pix vive dias, não meses: mandar pagá-lo é
    // mandar o aluno a uma parede. Caso vivo que abriu o card: comprador em
    // Portugal, que paga em EUR por multibanco, orientado a pagar por Pix.
    //
    // Por que aqui NÃO some, ao contrário do banner: o /app fala com o aluno e
    // calar é a gentileza certa; a Fast é ATENDENTE e a existência de uma
    // cobrança morta é contexto que ela precisa para explicar a falta de acesso.
    // Então o vencido é dito como VENCIDO, com instrução explícita de não
    // mandar pagar — silêncio aqui devolveria a agente ao escuro que gerou #198.
    const pendingAt = profile.pending_payment_at;
    const temAcesso = profile.access_until
      ? new Date(profile.access_until).getTime() > Date.now()
      : !!profile.access_source;
    const pendingRecente = pendingAt
      ? Date.now() - new Date(pendingAt).getTime() < 3 * 24 * 60 * 60 * 1000
      : false;
    const linhaPendente =
      !pendingAt || temAcesso
        ? ""
        : pendingRecente
          ? " · ⚠️ Pix/boleto PENDENTE aguardando pagamento"
          : ` · ⚠️ havia um Pix/boleto de ${dtBR(pendingAt)} que JÁ VENCEU — NÃO peça para pagar este código; oriente a gerar uma cobrança nova`;

    return [
      `Nome: ${profile.display_name ?? "?"} · E-mail: ${profile.email}`,
      `Plano: ${profile.plan} · Acesso: ${acesso}${linhaPendente}`,
      `Saldo: ${saldo.toLocaleString("pt-BR")} créditos (${(profile.credits_subscription ?? 0).toLocaleString("pt-BR")} do plano + ${(profile.credits_extra ?? 0).toLocaleString("pt-BR")} avulsos)`,
      `Cadastro em: ${dtBR(profile.created_at)}`,
      // Fica JUNTO dos fatos de identidade/acesso e ANTES da lista de trabalhos
      // de propósito: é a lista vazia ("Nenhum trabalho ainda (conta sem uso)")
      // que cria o enquadramento "o material deve estar em algum menu do app",
      // e no #315 a Fast afirmou isso CONTRA o dado presente. O enquadramento
      // certo — onde o pedido do SGP está, e se ele consegue entrar na conta —
      // tem que chegar antes.
      blocoSgp,
      garantia,
      jobs.length ? `Últimos trabalhos (3 por produto):\n${jobLines(jobs)}` : "Nenhum trabalho ainda (conta sem uso).",
      // O aviso só sai quando há ressalva na lista — sem ele, "esta tem
      // ressalva" escorrega para "as outras estão conferidas", que é
      // exatamente o que a medição NÃO prova (cobertura é cega a substituição
      // de palavra: geração 1425ca2f, 10/09). Gastar estas linhas de prompt em
      // contas sem ressalva nenhuma seria inflar o contexto à toa.
      jobs.some((j) => j.ressalva) ? AVISO_QA_NAO_PROVA : "",
      txLines ? `Últimas movimentações de crédito:\n${txLines}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return null;
  }
}
