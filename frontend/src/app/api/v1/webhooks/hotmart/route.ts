/**
 * POST /api/v1/webhooks/hotmart
 *
 * Recebe as notificações de compra/assinatura da Hotmart (Webhook 2.0) e
 * libera/revoga acesso na nossa base. Esta é a URL que o produtor cadastra em
 * Ferramentas → Webhook (API e notificações).
 *
 * Segurança: valida o token `hottok` (header X-HOTMART-HOTTOK) contra
 * HOTMART_HOTTOK do ambiente, em tempo constante.
 *
 * Idempotência: a Hotmart reenvia o mesmo evento até 5×. Gravamos cada evento
 * em `payment_events` (UNIQUE provider+event_id); só processamos uma vez.
 * Se o processamento falhar, respondemos 500 (sem marcar processed_at) pra a
 * Hotmart reenviar e tentarmos de novo.
 *
 * Modelo do produto: assinatura recorrente mensal (R$ 97), 7 dias de garantia.
 * Payload 2.0: { id, creation_date, event, version, data }.
 */
import { timingSafeEqual } from "node:crypto";
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
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";
import {
  extractBuyerEmail,
  extractExternalId,
  extractNextChargeIso,
  extractOfferCode,
  extractProductCode,
  extractPurchaseStatus,
  extractTransactionId,
  isMoneyReturnedStatus,
  isUnknownExternalId,
  mapRevokeStatus,
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
  // mesmo produtor). Só processamos o NOSSO produto (HOTMART_PRODUCT_ID). Evento
  // de outro produto → 200 (pra Hotmart parar de reenviar) SEM gravar nada:
  // não liberamos acesso indevido nem guardamos PII de cliente de terceiro.
  const ourProduct = process.env.HOTMART_PRODUCT_ID;
  const eventProduct = extractProductCode(data);
  if (ourProduct && eventProduct && eventProduct !== ourProduct) {
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
    const { handled, processError } = await processEvent(eventType, data, buyerEmail);
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
): Promise<ProcessResult> {
  const externalId = extractExternalId(data, eventType);
  const productCode = extractProductCode(data);
  const purchaseStatus = extractPurchaseStatus(data);

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
    await grantAccess({
      provider: PROVIDER,
      buyerEmail,
      externalId,
      productCode,
      offerCode: extractOfferCode(data),
      accessUntil: extractNextChargeIso(data), // recorrente: acesso até a próxima cobrança; NULL se único
      rawEvent: data,
    });
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
    } else {
      // Compra aprovada SEM conta correspondente: o entitlement fica órfão e o
      // login resgata sozinho quando a conta nascer com ESTE e-mail (claim.ts).
      // Se a pessoa criar a conta com OUTRO e-mail (caso Juliano 2026-07-13),
      // só um humano resolve — então avisamos a equipe na hora.
      await alertOrphanPurchase(buyerEmail, externalId);
    }
    await setPendingPayment(buyerEmail, null); // pagou → limpa o pendente
    return ok("granted");
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
    // vai junto (regra do Johnny 18/08; mig 82). SÓ nesses três — cancelamento
    // de quem pagou ('canceled') e expiração ('expired') MANTÊM o saldo.
    // credits_extra nunca é tocado (dívida nossa com o aluno). A função no
    // banco é idempotente por transação: reentrega não lança 2x, e recompra
    // depois do estorno não é apagada por reprocessamento do evento antigo.
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
        // falha de RPC LANÇA → 500 → Hotmart reenvia (seguro: idempotente)
        const zeroed = await zeroSubscriptionCreditsOnRefund({ userId, refId, eventType });
        if (!zeroed.ok) {
          errors.push(`crédito NÃO zerado (${zeroed.reason}) [user: ${userId}]`);
        }
      }
    }

    return {
      handled: revoke.found ? `revoked:${revokeStatus}` : `revoke_unmatched:${revokeStatus}`,
      processError: errors.length > 0 ? errors.join("; ") : null,
    };
  }

  return ok("ignored");
}

/**
 * Aprovação sem conta na plataforma → e-mail pra equipe (best-effort).
 * O acesso em si NÃO se perde (entitlement órfão + resgate no login); o aviso
 * existe pro caso do e-mail da compra ≠ e-mail da conta, que exige humano.
 */
async function alertOrphanPurchase(buyerEmail: string, externalId: string): Promise<void> {
  try {
    const admin = getAdmin();
    const to = new Set<string>([SUPPORT_EMAIL]);
    const { data } = await admin.from("admin_emails").select("email");
    for (const r of (data ?? []) as { email: string | null }[]) {
      if (r.email) to.add(r.email.toLowerCase());
    }
    await sendEmail({
      to: [...to],
      subject: `⚠️ Compra aprovada SEM conta na plataforma: ${buyerEmail}`,
      html:
        `<p>A Hotmart aprovou uma compra, mas não existe conta na plataforma com o e-mail do comprador — os créditos ficam pendentes.</p>` +
        `<ul>` +
        `<li><strong>E-mail da compra:</strong> ${escapeHtml(buyerEmail)}</li>` +
        `<li><strong>Assinatura/transação:</strong> ${escapeHtml(externalId)}</li>` +
        `</ul>` +
        `<p>Se a pessoa criar a conta com ESTE e-mail, o sistema credita sozinho no primeiro login. ` +
        `Se ela usar outro e-mail (ex.: login Google diferente do e-mail do checkout), é preciso vincular manualmente — confirme com o aluno qual e-mail ele usa pra logar.</p>`,
    });
  } catch {
    /* aviso é best-effort; nunca derruba o webhook */
  }
}

// ── extração defensiva do payload 2.0 + mapRevokeStatus/isMoneyReturnedStatus:
//    ver @/lib/payments/hotmart-payload (módulo puro, testável com node --test)

function validHottok(received: string | null): boolean {
  const expected = process.env.HOTMART_HOTTOK ?? "";
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
