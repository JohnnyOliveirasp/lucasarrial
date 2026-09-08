/**
 * Convite pra compra órfã (pedido Johnny 03/08): comprador aprovou na Hotmart
 * mas NUNCA criou conta — os créditos ficam esperando e a pessoa acha que
 * "não entraram" (principal reclamação do suporte@; 5 pagantes nessa situação).
 *
 * Sweeper diário: acha compras aprovadas sem perfil correspondente (>1h de
 * idade, pra dar tempo do fluxo normal), manda e-mail convite PELO suporte@
 * (se a pessoa responder, a Fast atende) e 1 lembrete único após 3 dias.
 * Dedupe persistente em agent_state key "orphan_invites" (sem migration).
 *
 * ⚠️ O dedupe é POR COBRANÇA, não por e-mail para sempre (08/09/2026, ver
 * `orphan-ciclo.ts`): assinatura mensal cobra de novo todo mês, e calar o
 * comprador depois do primeiro par convite+lembrete deixava pagante sem conta
 * sendo cobrado em silêncio por meses. Cinco casos medidos, quatro escritos à
 * mão naquele dia porque o sweeper não podia falar.
 */
import { getAdmin } from "@/lib/db/admin";
import { sendEmail } from "@/lib/email/resend";
import { sendSupportMail } from "@/lib/agent/mail-smtp";
import {
  compradorMereceConvite,
  entitlementDaPlataforma,
  eventoEhPagamento,
  produtosDeCurso,
} from "@/lib/payments/acesso-regra";
import {
  decidirAcaoConvite,
  registroDoConvite,
  type RegistroConvite,
} from "@/lib/payments/orphan-ciclo";
import { normalizarEmailParaComparacao } from "@/lib/payments/email-normalizado";
import {
  decidirConviteSgp,
  produtoDaCompra,
  produtoQueMandaNoConvite,
  EVENTOS_QUE_DESFAZEM,
  type ProdutoDaCompra,
  type RegistroConviteSgp,
} from "@/lib/payments/orphan-sgp";
import { montarBoasVindas, SGP_PRODUCT_ID_PADRAO } from "@/lib/payments/sgp-boas-vindas";

const PRODUCT_ID = "7851642";
const STATE_KEY = "orphan_invites";
/**
 * Estado do aviso do SGP, em chave PRÓPRIA — não no `orphan_invites`.
 *
 * Separado de propósito: os dois avisos têm texto, guardas e ciclo diferentes,
 * e um dia alguém compra os dois produtos com o mesmo e-mail. Compartilhar a
 * chave faria um aviso calar o outro em silêncio.
 */
const STATE_KEY_SGP = "orphan_invites_sgp";
/** Registro do e-mail que o WEBHOOK já manda na compra (`sgp-boas-vindas-canal.ts`). */
const STATE_KEY_BOAS_VINDAS = "sgp_boas_vindas";
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

type ApprovedRow = {
  buyer_email: string | null;
  received_at: string;
  payload: {
    data?: {
      product?: { id?: number | string };
      purchase?: { price?: { value?: number }; status?: string };
      buyer?: { name?: string };
    };
  };
};

async function loadState<T>(key: string): Promise<Record<string, T>> {
  // agent_state fica fora do Database tipado (padrão das rotas do Vigia).
  const { data } = await getAdmin()
    .from("agent_state" as never)
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return (((data as { value?: Record<string, T> } | null)?.value ?? {}) as Record<string, T>) || {};
}

async function saveState<T>(key: string, state: Record<string, T>): Promise<void> {
  await getAdmin()
    .from("agent_state" as never)
    .upsert({ key, value: state, updated_at: new Date().toISOString() } as never);
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
  /** Avisos do PORTAL DO SGP — contados à parte: são outro texto e outra régua. */
  sgpOrphans: number;
  sgpInvited: number;
};

/**
 * O texto do aviso do SGP, reusando a CÓPIA CANÔNICA do `sgp-boas-vindas.ts`.
 *
 * ⚠️ REUSO, NÃO CÓPIA, e isso é o ponto: aquele texto é o único lugar onde a
 * regra comercial do Lucas (31/08) está escrita pro aluno — "o SGP NÃO inclui a
 * assinatura da plataforma". Um texto novo aqui divergiria dele no primeiro
 * ajuste e voltaria a prometer a plataforma por outro caminho.
 *
 * Os dois parâmetros vão fixos, e cada um por um motivo:
 *  - `conta` fica `undefined`: o varredor NÃO cria conta nem gera link de senha
 *    (quem faz isso é o webhook, na hora da compra). Sem conta criada, o bloco
 *    "defina sua senha" não entra — mandar link de senha pra quem não pediu é o
 *    estrago que o próprio `sgp-boas-vindas.ts` documenta como o pior deste fluxo.
 *  - `temAssinaturaFastcloner` fica `false`: aqui só chega quem NÃO tem conta na
 *    plataforma (a guarda `hasAccount` roda antes), então quem chega não tem
 *    assinatura pra usar. É também o default seguro documentado no #290.
 */
function textoDoPortalSgp(email: string, nome: string): { subject: string; text: string } {
  const { assunto, texto } = montarBoasVindas({
    eventType: "PURCHASE_APPROVED",
    buyerEmail: email,
    buyerName: nome || null,
    productCode: null,
    productName: null,
    transaction: null,
    externalId: "",
    purchaseStatus: "APPROVED",
  });
  return { subject: assunto, text: texto };
}

/** Uma varredura (cron diário). Convite 1x + lembrete único após 3 dias. */
export async function sweepOrphanPurchases(): Promise<OrphanSweepSummary> {
  const summary: OrphanSweepSummary = {
    orphans: 0,
    invited: 0,
    reminded: 0,
    errors: 0,
    sgpOrphans: 0,
    sgpInvited: 0,
  };
  const admin = getAdmin();
  // Mesma resolução do webhook (`hotmart/route.ts`), pra que os dois concordem
  // sobre o que é SGP mesmo quando o ambiente sobrescreve o padrão.
  const produtoSgp = process.env.HOTMART_SGP_PRODUCT_ID ?? SGP_PRODUCT_ID_PADRAO;

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
  // `pagou` acumula pelo caminho: basta UM evento com dinheiro que entrou de
  // verdade (valor > 0 E status de pagamento). Trial de R$ 0 e boleto impresso
  // que nunca foi pago passam por aqui como PURCHASE_APPROVED e NÃO contam —
  // ver `eventoEhPagamento` e a condição (2) de `compradorMereceConvite`.
  //
  // `pagoEm` é o instante da ÚLTIMA cobrança que entrou de verdade, e é o que
  // define o ciclo do convite (`orphan-ciclo.ts`). Não dá pra reaproveitar o
  // `at`: ele é o último evento aprovado de QUALQUER tipo, e trial de R$ 0 e
  // boleto impresso também chegam como PURCHASE_APPROVED — ancorar o ciclo
  // nele reabriria convite por evento que não é dinheiro.
  //
  // ⚠️ O PRODUTO DEIXOU DE SER UM `continue` CEGO (08/09, #312). A linha antiga
  // (`!== PRODUCT_ID → continue`) rodava ANTES de todas as guardas e apagava o
  // comprador do SGP da varredura inteira: 19 pagantes sem conta, invisíveis.
  // Agora a compra é CLASSIFICADA e cada produto segue seu caminho, com seu
  // texto e suas guardas — ver `orphan-sgp.ts` pra por que alargar o filtro
  // sem separar o texto mandaria promessa falsa E, ao mesmo tempo, não mandaria
  // e-mail nenhum pra 15 dos 19.
  //
  // ⚠️ E O DINHEIRO É CONTADO POR PRODUTO, NUNCA SOMADO ENTRE ELES. Se `pagou`
  // fosse um só, a compra do CURSO (que é sempre paga à vista) responderia
  // "sim, pagou" pela guarda da ASSINATURA — e um trial de R$ 0 do FastCloner
  // em cima de um SGP pago viraria "assinante com acesso vivo". É exatamente a
  // armadilha "acesso vivo ≠ pagou" do #138, que já custou 1.356.554 créditos
  // em 18/08. Cada produto pergunta pelo seu próprio dinheiro.
  type Compra = { at: string; pagou: boolean; pagoEm: string | null };
  const vazia = (): Compra => ({ at: "", pagou: false, pagoEm: null });
  const buyers = new Map<string, { name: string; fastcloner: Compra; sgp: Compra }>();
  for (const row of approved) {
    const email = (row.buyer_email ?? "").toLowerCase();
    const d = row.payload?.data;
    if (isTestEmail(email)) continue;
    const pid = d?.product?.id;
    const produto = produtoDaCompra({
      productId: pid === undefined || pid === null ? null : String(pid),
      produtoFastcloner: PRODUCT_ID,
      produtoSgp,
    });
    if (produto === "outro") continue;

    let cur = buyers.get(email);
    if (!cur) {
      cur = { name: "", fastcloner: vazia(), sgp: vazia() };
      buyers.set(email, cur);
    }
    const alvo = produto === "fastcloner" ? cur.fastcloner : cur.sgp;

    const pagouNesta = eventoEhPagamento({
      valor: d?.purchase?.price?.value,
      status: d?.purchase?.status,
    });
    if (pagouNesta) {
      alvo.pagou = true;
      // Comparação em ms: os dois lados vêm do mesmo campo, mas o resto do
      // fluxo compara com o estado (outro formato) — ver orphan-ciclo.ts.
      if (!alvo.pagoEm || Date.parse(row.received_at) > Date.parse(alvo.pagoEm)) {
        alvo.pagoEm = row.received_at;
      }
    }
    if (row.received_at > alvo.at) {
      alvo.at = row.received_at;
      cur.name = (d?.buyer?.name ?? "").split(" ")[0];
    }
  }

  // ⚠️ ESTORNO DO SGP: no caminho do FastCloner quem barra quem pediu o dinheiro
  // de volta é o entitlement (`refunded`/`chargeback` não valem acesso, #127). O
  // SGP NÃO TEM ENTITLEMENT por desenho, então essa proteção não existiria — e o
  // SGP é o produto da casa com GARANTIA INCONDICIONAL DE 7 DIAS, ou seja, o de
  // MAIOR chance de estorno. Sem esta varredura mandaríamos "envie suas fotos, a
  // equipe vai montar seu clone" pra quem já pediu reembolso. A fonte é o
  // evento, porque é a única que existe pro SGP.
  const estornados = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("payment_events")
      .select("buyer_email, payload")
      .in("event_type", [...EVENTOS_QUE_DESFAZEM])
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    // Falha fechada: sem saber quem estornou, NÃO mandamos aviso de SGP nenhum.
    if (error) throw new Error(`[orphan-outreach] guarda de estorno do SGP falhou: ${error.message}`);
    for (const r of (data ?? []) as ApprovedRow[]) {
      const pid = r.payload?.data?.product?.id;
      if (pid === undefined || pid === null) continue;
      if (String(pid) !== produtoSgp) continue;
      const em = (r.buyer_email ?? "").toLowerCase();
      if (em) estornados.add(em);
    }
    if (!data || data.length < PAGE) break;
  }

  // Guarda que decide quem é "órfão": este comprador já tem conta na plataforma?
  //
  // ⚠️ #306 / 18bf275c (nomeado em 08/09, medido ainda vivo em 17/09): a versão
  // antiga perguntava com `.in("email", chunk)`, ou seja, igualdade de STRING.
  // O Gmail ignora o ponto no nome do usuário e ignora tudo depois do `+`, então
  // `herysilva.27@gmail.com` (compra, entitlement PPEVZBRG, user_id NULL) e
  // `herysilva27@gmail.com` (conta plan=pro criada em 21/07) são a MESMA caixa e
  // a guarda não enxergava: a casa mandou "crie sua conta com EXATAMENTE este
  // e-mail" pra própria dona da conta. Repetição do 72a4c9db / #127.
  // Agora a comparação é por e-mail NORMALIZADO (`email-normalizado.ts`, puro e
  // testado; só funde domínio do Google, de propósito).
  //
  // ⚠️ A normalização MUDA A CHAVE, então não dá mais pra filtrar por
  // `.in("email", ...)`: o banco não conhece a forma normalizada. Lemos a tabela
  // profiles inteira, e é justamente aqui que mora o perigo histórico — o teto
  // silencioso de 1000 linhas do PostgREST foi o que mandou "crie sua conta" pra
  // 105 clientes ATIVOS (72a4c9db, 04–19/08; profiles tinha 1293 linhas e o Set
  // só conhecia 1000), e foi o que o commit c5f67bd consertou neste arquivo.
  // O que torna a leitura completa segura é o CONTRÁRIO de truncar: paginar com
  // ordem estável até a página vir incompleta, ABORTAR com throw se a consulta
  // falhar, e ABORTAR com throw se passar do teto de segurança. Set incompleto é
  // exatamente o que transforma cliente ativo em "órfão" — na dúvida, não mandar
  // e-mail nenhum é o comportamento certo.
  const hasAccount = new Set<string>();
  const PAGE_PROFILES = 1000;
  // Teto de sanidade: profiles tinha ~1,3 mil linhas em 08/2026, e 200 mil é
  // ~150x isso. Se chegarmos lá, a paginação não está terminando (ordem
  // instável, tabela crescendo durante a varredura) e o certo é morrer, nunca
  // truncar em silêncio e seguir com meio Set.
  const TETO_PROFILES = 200_000;
  for (let from = 0; ; from += PAGE_PROFILES) {
    if (from >= TETO_PROFILES) {
      throw new Error(
        `[orphan-outreach] guarda hasAccount passou de ${TETO_PROFILES} perfis sem terminar de paginar — abortando em vez de decidir órfão com lista incompleta`,
      );
    }
    const { data, error } = await admin
      .from("profiles")
      .select("email")
      .order("id", { ascending: true })
      .range(from, from + PAGE_PROFILES - 1);
    if (error) throw new Error(`[orphan-outreach] guarda hasAccount falhou: ${error.message}`);
    for (const p of (data ?? []) as { email: string | null }[]) {
      if (p.email) hasAccount.add(normalizarEmailParaComparacao(p.email));
    }
    if (!data || data.length < PAGE_PROFILES) break;
  }

  const buyerEmails = [...buyers.keys()];
  const CHUNK = 500;

  // #127 (Cassio, 24/08): compra aprovada UMA VEZ entrava na lista pra sempre.
  // Quem estornou/deu chargeback recebia "seus créditos continuam reservados" —
  // e o lembrete de 3 dias também. A verdade do acesso é o entitlement mais
  // recente por comprador, lido pela regra ÚNICA (`entitlementValeAcesso`), não
  // por `status === "active"`: ver `compradorMereceConvite` acima. Consulta em
  // blocos, e se falhar ABORTA (mesma regra da guarda hasAccount: lista
  // incompleta é o que manda e-mail errado).
  //
  // ⚠️ `jaTemDono`: a compra deste e-mail JÁ está ligada a uma conta. A guarda
  // `hasAccount` procura perfil com o e-mail DA COMPRA e por isso é cega pra
  // quem comprou com um endereço e usa a plataforma por outro — exatamente a
  // classe do #20/#27/#36/#195/#218. Medido em 08/09: `nassarab@hotmail.com`
  // (conta `nassaramesquita@gmail.com`, plan pro, 95.590 créditos) e
  // `qooqi.criacoes@gmail.com` (conta `gestao@qooqi.com.br`, 100.000 créditos)
  // passavam nas duas guardas antigas e só não recebiam "crie sua conta"
  // porque o dedupe eterno os calava. Ao tornar o dedupe cíclico, sem esta
  // guarda eu criaria o incidente 72a4c9db de novo: convite pra cliente ATIVO.
  const nowIso = new Date().toISOString();
  // A MESMA lista de curso que o conserto (`reconcileUserEntitlements`) e o
  // detector (`sgp/reconciliacao.ts`) usam — lida do ambiente, não copiada.
  const cursos = produtosDeCurso();
  const ultimoEnt = new Map<string, { status: string; access_until: string | null; at: string }>();
  const jaTemDono = new Set<string>();
  for (let i = 0; i < buyerEmails.length; i += CHUNK) {
    const chunk = buyerEmails.slice(i, i + CHUNK);
    const { data, error } = await admin
      .from("entitlements")
      .select("buyer_email, status, access_until, updated_at, created_at, user_id, product_code")
      .in("buyer_email", chunk);
    if (error) throw new Error(`[orphan-outreach] guarda entitlements falhou: ${error.message}`);
    for (const e of (data ?? []) as {
      buyer_email: string | null; status: string | null; access_until: string | null;
      updated_at: string | null; created_at: string | null; user_id: string | null;
      product_code: string | null;
    }[]) {
      const em = (e.buyer_email ?? "").toLowerCase();
      if (!em) continue;
      // `jaTemDono` olha TODA linha, inclusive a de curso, DE PROPÓSITO: a
      // pergunta dele é "esta compra já está ligada a alguma conta?", e uma
      // linha de curso com dono responde que sim. Filtrar produto antes daqui
      // reabriria o 72a4c9db (convite pra cliente ATIVO).
      if (e.user_id) jaTemDono.add(em);
      // ⚠️ SÓ entitlement da PLATAFORMA pode decidir o convite (#312, 15/09).
      // `ultimoEnt` escolhia a linha mais recente do e-mail sem olhar produto,
      // e `compradorMereceConvite` só pergunta "este entitlement vale acesso?".
      // Um vitalício de CURSO (active, access_until NULL) é a linha mais nova
      // que existe pra quem comprou só o curso em 09/06: ele venceria a disputa
      // e o convite sairia dizendo "seus créditos estão reservados, é só criar
      // a conta". Desde o #313 (36886fa) a conta criada NÃO adota entitlement
      // de curso — a promessa não teria o que entregar.
      //
      // Hoje isto é NO-OP MEDIDO, não suposição: `buyers` só é alimentado por
      // compra do PRODUCT_ID da plataforma, e os 13 e-mails da base cujo
      // entitlement mais recente é de curso têm ZERO evento de compra desse
      // produto (medido 15/09). A guarda existe pro dia em que alguém atender
      // ao pedido (a) do #312 e fizer o varredor enxergar o SGP — que é o mesmo
      // dia em que a armadilha arma. Aviso em nota já falhou três vezes neste
      // cartão; em código ele não depende de ninguém ler.
      if (!entitlementDaPlataforma(e.product_code, cursos)) continue;
      const at = e.updated_at ?? e.created_at ?? "";
      const cur = ultimoEnt.get(em);
      if (!cur || at > cur.at) {
        ultimoEnt.set(em, { status: e.status ?? "", access_until: e.access_until ?? null, at });
      }
    }
  }

  const state = await loadState<RegistroConvite>(STATE_KEY);
  const stateSgp = await loadState<RegistroConviteSgp>(STATE_KEY_SGP);
  // Quem o WEBHOOK já avisou na hora da compra. Medido em 08/09: 15 dos 19
  // órfãos do SGP JÁ estão aqui — sem este cruzamento o conserto deste card
  // gera 15 e-mails repetidos no primeiro dia (a "leva dupla" de 06/09).
  // O registro é por TRANSAÇÃO, e o e-mail mora no valor: cruzamos por e-mail.
  const boasVindasEnviadas = new Set<string>();
  for (const reg of Object.values(
    await loadState<{ buyerEmail?: string }>(STATE_KEY_BOAS_VINDAS),
  )) {
    const em = (reg?.buyerEmail ?? "").trim().toLowerCase();
    if (em) boasVindasEnviadas.add(em);
  }
  const now = Date.now();
  const sent: string[] = [];
  const sentSgp: string[] = [];

  // Pedido Johnny 03/08: admins recebem CÓPIA OCULTA de cada convite.
  const { data: adminRows } = await admin.from("admin_emails").select("email");
  const bcc = ((adminRows ?? []) as { email: string }[])
    .map((r) => r.email.toLowerCase())
    .filter((e) => e && e !== "suporte@fastcloner.com");

  for (const [email, info] of buyers) {
    // GUARDAS COMPARTILHADAS — valem igual pros dois produtos e continuam
    // ANTES de tudo. Nenhuma delas foi afrouxada por este card.
    //
    // Normalizado dos DOIS lados (o Set também é normalizado): é o que enxerga
    // `herysilva.27@` comprando e `herysilva27@` já sendo a conta dela. #306.
    // (veio da main em 9c44e9f9, DEPOIS da base deste branch — mantido aqui de
    // propósito: resolver o conflito a favor do branch REGREDIRIA o #306.)
    if (hasAccount.has(normalizarEmailParaComparacao(email))) continue; // criou conta — claim do login resolve
    if (jaTemDono.has(email)) continue; // compra já ligada a uma conta (outro e-mail)

    // Qual produto manda no convite deste e-mail (FastCloner ganha se comprou
    // os dois — ver `produtoQueMandaNoConvite`).
    const produto: ProdutoDaCompra = produtoQueMandaNoConvite({
      comprouFastcloner: info.fastcloner.at !== "",
      comprouSgp: info.sgp.at !== "",
    });

    // ── CAMINHO DO SGP: texto próprio, guardas próprias ──────────────────
    // Ele NÃO passa por `compradorMereceConvite` de propósito: essa régua exige
    // entitlement, e o SGP não cria entitlement por desenho. Ver `orphan-sgp.ts`.
    if (produto === "sgp") {
      const decisao = decidirConviteSgp({
        pagou: info.sgp.pagou,
        estornado: estornados.has(email),
        jaRecebeuBoasVindas: boasVindasEnviadas.has(email),
        jaAvisadoPeloVarredor: Boolean(stateSgp[email]),
        idadeMs: now - new Date(info.sgp.at).getTime(),
        carenciaMs: MIN_AGE_MS,
      });
      // "órfão do SGP" = pagou, não estornou e não tem conta. Conta mesmo quando
      // o aviso não sai, pra que o número no resumo não esconda a fila.
      if (info.sgp.pagou && !estornados.has(email)) summary.sgpOrphans += 1;
      if (!decisao.manda) continue;
      try {
        const { subject, text } = textoDoPortalSgp(email, info.name);
        await sendSupportMail({ to: email, subject, text, bcc });
        stateSgp[email] = { at: new Date().toISOString(), compraEm: info.sgp.pagoEm };
        summary.sgpInvited += 1;
        sentSgp.push(`portal SGP → ${email}`);
      } catch (e) {
        summary.errors += 1;
        console.error(`[orphan-outreach] falha SGP ${email}:`, e instanceof Error ? e.message : e);
      }
      continue;
    }

    // ── CAMINHO DO FASTCLONER: intacto, byte a byte ──────────────────────
    // Só convida quem PAGOU a assinatura E ainda está dentro da janela paga.
    // Sem as duas: #127 (convite pra quem estornou) ou #138 (trial de R$ 0 lido
    // como "acesso vivo"). A regra mora em acesso-regra.ts, testada.
    const ent = ultimoEnt.get(email);
    if (!compradorMereceConvite(ent ? { status: ent.status, access_until: ent.access_until } : null, info.fastcloner.pagou, nowIso)) {
      continue;
    }
    if (now - new Date(info.fastcloner.at).getTime() < MIN_AGE_MS) continue;
    summary.orphans += 1;

    const record = state[email];
    // O ciclo é da COBRANÇA (orphan-ciclo.ts): pagamento novo depois do ciclo
    // já atendido reabre convite + lembrete; sem pagamento novo, silêncio.
    const acao = decidirAcaoConvite({
      registro: record,
      ultimoPagamentoIso: info.fastcloner.pagoEm,
      agoraMs: now,
      lembreteAposMs: REMINDER_AFTER_MS,
    });
    if (acao === "nada") continue;
    try {
      if (acao === "convite") {
        const { subject, text } = inviteText(info.name, email, false);
        // `origem` veio da main (dccf6472, fecha o laço do bounce pelo
        // Message-ID); `info.fastcloner.pagoEm` é a estrutura nova deste branch.
        // Os dois lados entram — não é ou-um-ou-outro.
        await sendSupportMail({ to: email, subject, text, bcc, origem: "orfao-convite" });
        state[email] = registroDoConvite(new Date().toISOString(), info.fastcloner.pagoEm, record);
        summary.invited += 1;
        sent.push(`convite → ${email}`);
      } else {
        const { subject, text } = inviteText(info.name, email, true);
        await sendSupportMail({ to: email, subject, text, bcc, origem: "orfao-convite" });
        record.reminder = new Date().toISOString();
        summary.reminded += 1;
        sent.push(`lembrete → ${email}`);
      }
    } catch (e) {
      summary.errors += 1;
      console.error(`[orphan-outreach] falha ${email}:`, e instanceof Error ? e.message : e);
    }
  }

  // Cada estado é gravado só se o SEU caminho mandou algo — gravar o do SGP
  // numa varredura que só mandou convite do FastCloner (e vice-versa) reescreve
  // a chave à toa e mistura os dois ciclos.
  if (summary.invited + summary.reminded > 0) await saveState(STATE_KEY, state);
  if (summary.sgpInvited > 0) await saveState(STATE_KEY_SGP, stateSgp);

  if (summary.invited + summary.reminded + summary.sgpInvited > 0) {
    // Resumo único pros admins (não um BCC por aluno).
    const { data: admins } = await admin.from("admin_emails").select("email");
    const to = ((admins ?? []) as { email: string }[]).map((r) => r.email).filter(Boolean);
    if (to.length > 0) {
      // Os dois blocos são SEPARADOS de propósito: são promessas diferentes.
      // Juntar "créditos reservados" com "envie suas fotos" num número só é o
      // começo de alguém repetir a confusão que este card veio desfazer.
      const blocoFastcloner =
        summary.invited + summary.reminded > 0
          ? `<p><b>FastCloner</b> — compradores sem conta receberam convite pra ativar (créditos já reservados):</p>` +
            `<ul>${sent.map((s) => `<li>${s}</li>`).join("")}</ul>` +
            `<p>Órfãos do FastCloner agora: ${summary.orphans}.</p>`
          : "";
      const blocoSgp =
        summary.sgpInvited > 0
          ? `<p><b>SGP</b> — compradores do curso sem conta receberam o caminho do portal ` +
            `(sem crédito e sem acesso à plataforma, que é a regra comercial):</p>` +
            `<ul>${sentSgp.map((s) => `<li>${s}</li>`).join("")}</ul>` +
            `<p>Órfãos do SGP agora: ${summary.sgpOrphans}.</p>`
          : "";
      await sendEmail({
        to,
        subject: `📨 Convites de compra órfã enviados: ${summary.invited + summary.reminded + summary.sgpInvited}`,
        html: `${blocoFastcloner}${blocoSgp}<p>Quem responder cai no suporte@ (a Fast atende).</p>`,
      });
    }
  }
  return summary;
}
