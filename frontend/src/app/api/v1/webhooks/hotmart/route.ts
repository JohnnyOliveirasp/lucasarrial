/**
 * POST /api/v1/webhooks/hotmart
 *
 * Recebe as notificações de compra/assinatura da Hotmart (Webhook 2.0) e
 * libera/revoga acesso na nossa base. Esta é a URL que o produtor cadastra em
 * Ferramentas → Webhook (API e notificações).
 *
 * Segurança: valida o token `hottok` (header X-HOTMART-HOTTOK) contra os tokens
 * do ambiente, em tempo constante — ver @/lib/payments/hottok. São aceitos
 * `HOTMART_HOTTOK` (um token, ou vários separados por vírgula) e o opcional
 * `HOTMART_HOTTOK_SGP`, porque o webhook atende MAIS DE UM produto da mesma
 * conta. Continua sendo lista fechada: quem não está nela toma 401.
 *
 * Idempotência: a Hotmart reenvia o mesmo evento até 5×. Gravamos cada evento
 * em `payment_events` (UNIQUE provider+event_id); só processamos uma vez.
 * Se o processamento falhar, respondemos 500 (sem marcar processed_at) pra a
 * Hotmart reenviar e tentarmos de novo.
 *
 * Modelo do produto: assinatura recorrente mensal (R$ 97), 7 dias de garantia.
 * Payload 2.0: { id, creation_date, event, version, data }.
 */
import type { NextRequest } from "next/server";
import { jsonOk, jsonError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { grantAccess, revokeAccess } from "@/lib/payments/entitlements";
import {
  grantSubscriptionCredits,
  resolveUserIdByEmail,
} from "@/lib/credits/service";
import { zeroSubscriptionCreditsOnRefund } from "@/lib/credits/refund";
import { applyPurchaseCampaignBonus } from "@/lib/campaigns/service";
import { PLAN_MONTHLY_CREDITS } from "@/lib/credits/config";
import { avisarCompraOrfa } from "@/lib/payments/aviso-orfao";
import { canaisDaCasa, estadoDosAvisos } from "@/lib/payments/aviso-orfao-canal";
import { hottokValido, tokensEsperados } from "@/lib/payments/hottok";
import {
  mandarBoasVindasSgp,
  roteamentoDoProduto,
  SGP_PRODUCT_ID_PADRAO,
  type RotaDoProduto,
} from "@/lib/payments/sgp-boas-vindas";
import { canaisDoSgp, estadoDasBoasVindas } from "@/lib/payments/sgp-boas-vindas-canal";
import {
  extractBuyerEmail,
  extractBuyerName,
  extractExternalId,
  extractNextChargeIso,
  extractOfferCode,
  extractProductCode,
  extractProductName,
  extractPurchaseStatus,
  extractSubscriptionStatus,
  extractTransactionId,
  isMoneyReturnedStatus,
  isUnknownExternalId,
  mapRevokeStatus,
  subscriptionIsDead,
} from "@/lib/payments/hotmart-payload";
import type { Json } from "@/lib/db/types";

const PROVIDER = "hotmart" as const;

type HotmartPayload = {
  id?: string;
  event?: string;
  version?: string;
  data?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  // 1. Autenticidade (hottok)
  const headerTok = request.headers.get("x-hotmart-hottok");
  let payload: HotmartPayload;
  try {
    payload = (await request.json()) as HotmartPayload;
  } catch {
    return jsonError("bad_request", "Invalid JSON", 400);
  }
  // o "Enviar teste" da Hotmart às vezes manda o hottok no corpo — aceitamos os dois.
  const bodyTok =
    typeof payload === "object" && payload && "hottok" in payload
      ? String((payload as Record<string, unknown>).hottok)
      : null;
  if (!validHottok(headerTok ?? bodyTok)) return unauthorized();

  const eventType = (payload.event ?? "UNKNOWN").toUpperCase();
  const data = (payload.data ?? {}) as Record<string, unknown>;

  // A conta Hotmart é COMPARTILHADA com outros produtos (ex.: outros cursos do
  // mesmo produtor). Evento de produto que não é nosso → 200 (pra Hotmart parar
  // de reenviar) SEM gravar nada: não liberamos acesso indevido nem guardamos
  // PII de cliente de terceiro.
  //
  // ⚠️ ABERTURA DE 03/09: o SGP (curso do MESMO produtor, entregue por dentro do
  // FastCloner em /sgp) passa a ser aceito — só pra mandar o e-mail que manda o
  // aluno preencher o portal. Ele NÃO ganha acesso, crédito nem entitlement:
  // `processEvent` desvia antes de qualquer coisa disso.
  //
  // Por que isto estava fechado, e por que a "prova" de que a Hotmart não
  // mandava era circular: este descarte subiu em 4688e40 (09/06 18h50Z) e é
  // ANTES do insert em `payment_events`. Os 13 eventos do 7283229 no banco param
  // em 09/06 17h37Z — 73 min antes do commit — e entre eles há 4
  // PURCHASE_APPROVED com status APPROVED. Ou seja: a Hotmart MANDAVA, e quem
  // parou de registrar fomos nós. Procurar o produto em `payment_events` depois
  // de 09/06 só reencontra o efeito deste `return`.
  const ourProduct = process.env.HOTMART_PRODUCT_ID;
  const produtoSgp = process.env.HOTMART_SGP_PRODUCT_ID ?? SGP_PRODUCT_ID_PADRAO;
  const eventProduct = extractProductCode(data);
  const rota = roteamentoDoProduto({ eventProduct, nossoProduto: ourProduct, produtoSgp });
  if (rota === "de_fora") {
    return jsonOk({ handled: "ignored_other_product" });
  }

  const buyerEmail = extractBuyerEmail(data);
  const eventId = payload.id ?? `${eventType}:${extractExternalId(data, eventType)}`;

  const admin = getAdmin();

  // 2. Idempotência — grava o evento (ignora se já existe) e checa se já processado
  await admin.from("payment_events").upsert(
    {
      provider: PROVIDER,
      event_id: eventId,
      event_type: eventType,
      buyer_email: buyerEmail,
      payload: payload as unknown as Json,
    },
    { onConflict: "provider,event_id", ignoreDuplicates: true },
  );
  const { data: evRow } = await admin
    .from("payment_events")
    .select("id, processed_at")
    .eq("provider", PROVIDER)
    .eq("event_id", eventId)
    .maybeSingle();

  if (!evRow) return jsonError("server_error", "could not record event", 500);
  if (evRow.processed_at) return jsonOk({ handled: "duplicate" });

  // 3. Processa o evento
  try {
    const { handled, processError } = await processEvent(eventType, data, buyerEmail, rota);
    // processError ≠ exceção: o evento é marcado como processado (200 → a
    // Hotmart para de reenviar; reenviar não resolveria), mas o erro fica
    // REGISTRADO em payment_events.error em vez de sumir como sucesso limpo.
    // Caso típico: revogação cujo externalId não casa com nenhum entitlement.
    await admin
      .from("payment_events")
      .update({ processed_at: new Date().toISOString(), error: processError })
      .eq("id", evRow.id);
    return jsonOk({ handled });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from("payment_events")
      .update({ error: msg.slice(0, 500) })
      .eq("id", evRow.id);
    // 500 → Hotmart reenvia; processed_at segue NULL, reprocessamos no retry.
    return jsonError("processing_error", "failed to process event", 500);
  }
}

// Status de transação (Hotmart) que contam como PAGO de verdade.
const PAID_STATUSES = new Set(["APPROVED", "COMPLETE", "COMPLETED"]);
// Pagamento assíncrono GERADO mas ainda não pago (Pix/boleto) → "aguardando".
const AWAITING_STATUSES = new Set([
  "BILLET_PRINTED",
  "PRINTED_BILLET",
  "WAITING_PAYMENT",
  "PROCESSING_TRANSACTION",
  "UNDER_ANALISYS",
  "UNDER_ANALYSIS",
]);

/** Marca (at=ISO) ou limpa (at=null) "pagamento pendente" no perfil, casando por e-mail. */
async function setPendingPayment(buyerEmail: string | null, at: string | null): Promise<void> {
  if (!buyerEmail) return;
  await getAdmin().from("profiles").update({ pending_payment_at: at }).eq("email", buyerEmail);
}

type ProcessResult = {
  handled: string;
  /** erro NÃO-fatal: o evento é marcado processado, mas isto vai pra payment_events.error */
  processError: string | null;
};

const ok = (handled: string): ProcessResult => ({ handled, processError: null });

/** Mapeia o evento da Hotmart para liberar/revogar acesso. */
async function processEvent(
  eventType: string,
  data: Record<string, unknown>,
  buyerEmail: string | null,
  rota: RotaDoProduto,
): Promise<ProcessResult> {
  const externalId = extractExternalId(data, eventType);
  const productCode = extractProductCode(data);
  const purchaseStatus = extractPurchaseStatus(data);

  // SGP: CURSO, não assinatura. Desvia ANTES de tudo — nada abaixo desta linha
  // pode rodar pra ele. Regra do Lucas (31/08): comprar o SGP não dá o
  // FastCloner; quem quiser a plataforma assina à parte. Um `grantAccess` aqui
  // entregaria o produto pago de graça pra 129 pessoas por semana.
  if (rota === "sgp") {
    return await processarCompraSgp(eventType, data, buyerEmail, productCode, externalId);
  }

  // libera/renova
  // Na Hotmart fica SÓ a assinatura recorrente. Os créditos avulsos são vendidos
  // pelo Stripe (ver /api/v1/webhooks/stripe). Aqui, toda aprovação = assinatura.
  if (eventType === "PURCHASE_APPROVED" || eventType === "PURCHASE_COMPLETE") {
    if (!buyerEmail) throw new Error("missing buyer email on approval");

    // GUARD: só libera se o pagamento estiver REALMENTE confirmado. O Webhook 2.0
    // pode mandar PURCHASE_APPROVED já com o QR do Pix em status de espera
    // (WAITING_PAYMENT etc.). Nesse caso NÃO liberamos — marcamos como pendente.
    if (purchaseStatus && !PAID_STATUSES.has(purchaseStatus)) {
      await setPendingPayment(buyerEmail, new Date().toISOString());
      return ok(`pending:${purchaseStatus}`);
    }

    // Assinatura: libera o acesso + credita o bolsão do ciclo (acumula).
    const grant = await grantAccess({
      provider: PROVIDER,
      buyerEmail,
      externalId,
      productCode,
      offerCode: extractOfferCode(data),
      accessUntil: extractNextChargeIso(data), // recorrente: acesso até a próxima cobrança; NULL se único
      rawEvent: data,
      // Só o APPROVED é dinheiro NOVO. O COMPLETE é o eco da MESMA cobrança
      // ~7,8 dias depois e não pode ressuscitar um entitlement estornado /
      // contestado (caso Marlon, 28/08 — ver entitlement-status.ts).
      newPayment: eventType === "PURCHASE_APPROVED",
    });

    // #161 (27/08): a ASSINATURA pode já estar morta dentro de um evento de
    // COMPRA. A Hotmart manda o COMPLETE ~7,8 dias depois do APPROVED; quem
    // cancelou nesse meio recebe o COMPLETE com subscription.status=CANCELED
    // e NENHUM SUBSCRIPTION_CANCELLATION separado. Até hoje isso regravava o
    // entitlement como `active` (190 casos: o Cassio seguiu recebendo "seus
    // créditos te esperam" depois de cancelar; o #66 fechado voltou a active
    // por um COMPLETE de 24/08). O grant acima continua valendo — ele é quem
    // traz a data de renovação e o período PAGO fica preservado no
    // access_until (regra 9: canceled com data futura mantém o acesso). Só o
    // STATUS deixa de mentir. Crédito não muda: o pagamento aconteceu.
    const subscriptionStatus = extractSubscriptionStatus(data);
    let handledSuffix = "";
    if (grant.terminalPreservado) {
      // Já havia estorno/contestação: o grant não escreveu nada e o revoke
      // abaixo seria ignorado do mesmo jeito — pulamos a query.
      handledSuffix = `:mantido_${grant.statusFinal}`;
    } else if (subscriptionIsDead(subscriptionStatus)) {
      const rev = await revokeAccess({
        provider: PROVIDER,
        externalId,
        status: subscriptionStatus === "EXPIRED" ? "expired" : "canceled",
        accessUntil: extractNextChargeIso(data),
        rawEvent: data,
      });
      handledSuffix = rev.terminalPreservado
        ? `:mantido_${rev.statusFinal}`
        : `:subscription_${subscriptionStatus.toLowerCase()}`;
    }
    const userId = await resolveUserIdByEmail(buyerEmail);
    if (userId) {
      // CRÉDITO SÓ NO APPROVED (10/08). A Hotmart avisa a MESMA cobrança duas
      // vezes: APPROVED quando o dinheiro entra e COMPLETE ~7,8 dias depois,
      // quando vence a garantia. Creditar nos dois dava 2 lotes por pagamento —
      // inofensivo enquanto a recarga era um reset, mas agora ela SOMA, e
      // seriam 200.000 por R$97 (medido: 484 cobranças com crédito em dobro).
      // O COMPLETE segue passando pelo grantAccess acima, porque é ele que
      // traz a data de renovação atualizada; só não gera crédito novo.
      if (eventType === "PURCHASE_APPROVED") {
        await grantSubscriptionCredits({
          userId,
          amount: PLAN_MONTHLY_CREDITS,
          refType: "payment_event",
          // A chave é a TRANSAÇÃO, não o externalId: na assinatura o externalId
          // é o código do assinante e é o MESMO em toda renovação — usá-lo como
          // trava faria a cobrança de setembro parecer repetição da de julho e
          // o aluno pagaria sem receber nada.
          refId: extractTransactionId(data) ?? externalId,
        });
      }
      // Bônus de campanha de lançamento (feature À PARTE): se a compra cair na
      // janela de uma campanha ativa, credita o bônus no saldo extra. No-op se
      // não houver campanha; idempotente (não dá bônus 2x na renovação).
      await applyPurchaseCampaignBonus(userId, externalId);
    }
    let avisoError: string | null = null;
    if (!userId) {
      // Compra aprovada SEM conta correspondente: o entitlement fica órfão e o
      // login resgata sozinho quando a conta nascer com ESTE e-mail (claim.ts).
      // Se a pessoa criar a conta com OUTRO e-mail (caso Juliano 13/07, caso
      // Tiago #239 em 02/09), só um humano resolve — então avisamos na hora.
      const aviso = await avisarCompraOrfa(
        {
          eventType,
          buyerEmail,
          buyerName: extractBuyerName(data),
          productCode,
          productName: extractProductName(data),
          transaction: extractTransactionId(data),
          externalId,
        },
        process.env.HOTMART_PRODUCT_ID ?? null,
        estadoDosAvisos(),
        canaisDaCasa(),
        new Date().toISOString(),
      );
      // #239: o aviso antigo descartava o resultado do envio, então "não avisou
      // ninguém" e "avisou" eram a MESMA coisa vista de fora — 46 aprovações
      // órfãs em 29 dias e zero e-mails, sem uma linha em lugar nenhum. Agora,
      // aviso novo que não entrou em NENHUM canal vira erro registrado em
      // `payment_events.error` (HTTP segue 200: reenvio da Hotmart não resolve).
      if (aviso.avisou && aviso.canais.length === 0) {
        avisoError = `compra órfã sem canal de aviso: ${buyerEmail} [${externalId}]`;
      }
    }
    await setPendingPayment(buyerEmail, null); // pagou → limpa o pendente
    return { handled: "granted" + handledSuffix, processError: avisoError };
  }

  // aguardando pagamento: Pix/boleto GERADO mas ainda não pago → banner no app.
  if (eventType === "PURCHASE_BILLET_PRINTED" || AWAITING_STATUSES.has(purchaseStatus)) {
    if (buyerEmail) await setPendingPayment(buyerEmail, new Date().toISOString());
    return ok("pending");
  }

  // revoga
  const revokeStatus = mapRevokeStatus(eventType);
  if (revokeStatus) {
    // cancelamento de assinatura mantém o acesso até o fim do período já pago
    const keepUntil =
      eventType === "SUBSCRIPTION_CANCELLATION"
        ? extractNextChargeIso(data)
        : null;
    const revoke = await revokeAccess({
      provider: PROVIDER,
      externalId,
      status: revokeStatus,
      accessUntil: keepUntil,
      rawEvent: data,
    });

    const errors: string[] = [];
    if (!revoke.found) {
      // Uma revogação que não encontrou dono é ERRO, não no-op (bug de 18/08:
      // 185 cancelamentos viraram "revoked:canceled" limpos sem tocar em nada).
      // HTTP continua 200 (reenvio da Hotmart não resolveria), mas o erro fica
      // gravado em payment_events.error pra auditoria/alerta enxergar.
      const why = isUnknownExternalId(externalId, eventType)
        ? "externalId não extraído do payload (caiu no fallback unknown)"
        : "externalId não casa com nenhum entitlement";
      errors.push(`${why}: ${externalId} [buyer: ${buyerEmail ?? "?"}]`);
    }

    // ESTORNO/CHARGEBACK/PROTESTO: o dinheiro voltou → o crédito de mensalidade
    // vai junto (regra do Johnny 18/08; mig 108). SÓ nesses três — cancelamento
    // de quem pagou ('canceled') e expiração ('expired') MANTÊM o saldo.
    // credits_extra nunca é tocado (dívida nossa com o aluno). A função no
    // banco é idempotente por transação: reentrega não lança 2x, e recompra
    // depois do estorno não é apagada por reprocessamento do evento antigo.
    //
    // ⚠️ ISTO RODA MESMO COM `terminalPreservado` — e é de propósito. Os dois
    // fixes deste PR nasceram separados e, juntados de forma ingênua, o retorno
    // antecipado do "status terminal preservado" PULAVA a zeragem: um
    // PURCHASE_REFUNDED chegando depois de um PURCHASE_PROTEST não reescreve o
    // status (chargeback é mais forte que refunded), mas continua sendo dinheiro
    // devolvido e pode ser uma TRANSAÇÃO DIFERENTE da já lançada. Status do
    // entitlement e saldo de crédito são dois efeitos independentes; quem
    // decide a zeragem é o `refId`, e a trava de repetição mora no banco.
    // Pular aqui deixaria crédito na mão de quem estornou — o bug original.
    if (isMoneyReturnedStatus(revokeStatus)) {
      // preferimos o dono do ENTITLEMENT (mesma pessoa da compra estornada);
      // sem match (órfão/unmatched), caímos pro e-mail do comprador.
      const userId =
        revoke.userId ?? (buyerEmail ? await resolveUserIdByEmail(buyerEmail) : null);
      if (!userId) {
        errors.push(
          `estorno sem usuário identificável — crédito NÃO zerado [buyer: ${buyerEmail ?? "?"}]`,
        );
      } else {
        // chave de idempotência = a transação estornada (o externalId da
        // assinatura é o código do assinante, igual em toda renovação).
        const refId = extractTransactionId(data) ?? externalId;
        // Falha transitória de RPC LANÇA → 500 → Hotmart reenvia (seguro:
        // idempotente). A migration 108 ainda NÃO aplicada é a exceção: vira
        // ok:false registrado, senão todo estorno viraria 500 em laço eterno.
        const zeroed = await zeroSubscriptionCreditsOnRefund({ userId, refId, eventType });
        if (!zeroed.ok) {
          errors.push(`crédito NÃO zerado (${zeroed.reason}) [user: ${userId}]`);
        }
      }
    }

    // O `handled` conta as TRÊS saídas possíveis sem esconder nenhuma:
    //   revoke_unmatched: — não achou entitlement (erro, já em `errors`)
    //   revoke_ignored:   — achou, mas o status pedido era mais fraco que o
    //                       atual e foi descartado de propósito (a marca de
    //                       estorno/contestação fica de pé)
    //   revoked:          — gravou o status pedido
    const handled = !revoke.found
      ? `revoke_unmatched:${revokeStatus}`
      : revoke.terminalPreservado
        ? `revoke_ignored:${revokeStatus}_mantido_${revoke.statusFinal}`
        : `revoked:${revokeStatus}`;

    return {
      handled,
      processError: errors.length > 0 ? errors.join("; ") : null,
    };
  }

  return ok("ignored");
}

/**
 * Compra do SGP (curso). Dois efeitos, e SÓ estes dois: CRIA A CONTA do
 * comprador e manda o e-mail de boas-vindas — que leva o link do portal /sgp e,
 * quando a conta acabou de nascer, o link pra ele definir a senha.
 *
 * Continua SEM acesso, SEM crédito e SEM entitlement: criar a conta não é
 * liberar a plataforma (regra do Lucas, 31/08). A conta nasce com
 * `credits_subscription`/`credits_extra` em 0 e `access_until` NULL, porque a
 * única coisa que roda é o `createUser` + o trigger `on_auth_user_created`.
 *
 * O evento fica gravado em `payment_events` (o insert já rodou no POST): é ele
 * que dá a idempotência do reenvio da Hotmart e, de quebra, devolve à casa a
 * visibilidade de compra de curso que se perdeu em 09/06.
 *
 * Nenhuma falha daqui derruba o webhook: e-mail que não sai vira
 * `payment_events.error` e uma linha `ok=false` em `avisos_enviados`. Devolver
 * 500 faria a Hotmart reenviar, e reenviar não conserta SMTP fora do ar.
 */
async function processarCompraSgp(
  eventType: string,
  data: Record<string, unknown>,
  buyerEmail: string | null,
  productCode: string | null,
  externalId: string,
): Promise<ProcessResult> {
  if (!buyerEmail) return ok("sgp:sem_email");

  const produtoSgp = process.env.HOTMART_SGP_PRODUCT_ID ?? SGP_PRODUCT_ID_PADRAO;
  try {
    const r = await mandarBoasVindasSgp(
      {
        eventType,
        buyerEmail,
        buyerName: extractBuyerName(data),
        productCode,
        productName: extractProductName(data),
        transaction: extractTransactionId(data),
        externalId,
        purchaseStatus: extractPurchaseStatus(data),
      },
      produtoSgp,
      estadoDasBoasVindas(),
      canaisDoSgp(),
      new Date().toISOString(),
    );
    // Enviou mas nenhum canal aceitou = o aluno NÃO recebeu. Vira erro
    // registrado (HTTP segue 200: reenvio da Hotmart não conserta isso).
    // A conta que não nasceu é registrada JUNTO, e não no lugar: o e-mail pode
    // ter saído perfeitamente e a conta ter falhado, e vice-versa — as duas
    // falhas são independentes e some uma se só reportarmos a outra.
    const falhas = [
      r.enviou && r.canais.length === 0
        ? `boas-vindas do SGP não saíram: ${buyerEmail} [${externalId}]`
        : null,
      r.contaErro ? `conta do SGP não criada (${r.conta}): ${buyerEmail} — ${r.contaErro}` : null,
    ].filter((x): x is string => x !== null);
    // `conta` no handled deixa a decomposição visível direto na listagem de
    // eventos: sgp:enviado:criada, sgp:enviado:ja_tinha, sgp:enviado:falhou.
    const sufixoConta = r.conta ? `:${r.conta}` : "";
    return {
      handled: `sgp:${r.motivo}${sufixoConta}`,
      processError: falhas.length ? falhas.join(" · ").slice(0, 500) : null,
    };
  } catch (e) {
    // Blindagem: o orquestrador já trata o throw do envio, mas um erro
    // inesperado (Supabase fora) não pode transformar compra de curso em 500.
    return {
      handled: "sgp:erro",
      processError: `boas-vindas do SGP falharam: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// O aviso de compra órfã saiu daqui: decisão e texto em @/lib/payments/aviso-orfao
// (puro, testado em aviso-orfao.test.ts), canais em aviso-orfao-canal.ts. A versão
// antiga era só e-mail, descartava o resultado do envio e engolia exceção — por
// isso nunca chegou em ninguém e ninguém percebeu (incidente #239).

// ── extração defensiva do payload 2.0 + mapRevokeStatus/isMoneyReturnedStatus:
//    ver @/lib/payments/hotmart-payload (módulo puro, testável com node --test)

// A comparação em si mora em @/lib/payments/hottok (pura e testada em
// hottok.test.ts). Aqui fica só a leitura do ambiente, que não é testável.
// NUNCA logar `received` nem os esperados: é o segredo que autentica o webhook.
function validHottok(received: string | null): boolean {
  return hottokValido(received, tokensEsperados(process.env));
}
