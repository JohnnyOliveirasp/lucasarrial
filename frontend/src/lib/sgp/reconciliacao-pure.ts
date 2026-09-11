/**
 * SGP — a decisão "a compra deste aluno NÃO entrou na conta dele?" (incidente #282).
 *
 * POR QUE ESTE ARQUIVO EXISTE. No lote de 04/09 (~349 contas), 7 pessoas com
 * assinatura ATIVA e PAGA ficaram com `entitlements.user_id` NULL, `plan=free`
 * e `access_until` NULL: pagaram e não receberam nada. O acesso delas foi
 * devolvido na mão em 06/09 — mas até hoje **ninguém sabe POR QUÊ não casou**,
 * porque `processar.ts` chamava o resgate assim:
 *
 *     await claimPurchasesOnLogin(userId, email).catch(() => {});
 *
 * O `.catch(() => {})` era quase decorativo: `claimPurchasesOnLogin` já engole
 * as próprias exceções por dentro (payments/claim.ts, "best-effort: login nunca
 * pode falhar"). Ou seja, o modo de falha que produziu os 7 **não é exceção**:
 * a função retorna normalmente e simplesmente não vincula nada. Um catch, por
 * melhor que fosse, nunca ia ver isso.
 *
 * Daí as DUAS perguntas que este módulo responde, e a segunda é a que importa:
 *   1. o resgate explodiu? (raro — só `claimCourtesyOnLogin` escapa do try)
 *   2. o resgate voltou em silêncio e MESMO ASSIM sobrou compra paga órfã?
 *
 * É só observabilidade: aqui não se vincula compra, não se dá crédito e não se
 * mexe em acesso. A função devolve o chamado a abrir — quem grava é
 * `reconciliacao.ts`, e quem conserta é gente.
 *
 * Puro de propósito (zero imports, igual `previa-pure.ts`): roda em
 *   node --test src/lib/sgp/reconciliacao-pure.test.ts
 */

/** Linha órfã de `entitlements` — só os campos que esta conta lê. */
export type EntitlementOrfa = {
  external_id: string | null;
  status: string | null;
  access_until: string | null;
  buyer_email: string | null;
  /** Payload da Hotmart (o `data` do webhook): `raw_event.purchase.price.value`. */
  raw_event: unknown;
  /**
   * Produto da compra. Opcional porque só o leitor de I/O o traz; a decisão
   * pura não usa (a régua de produto é aplicada na leitura, junto com a de
   * acesso, pra o detector enxergar o MESMO conjunto que o reconcile — ver
   * `reconciliacao.ts`).
   */
  product_code?: string | null;
};

export type EntradaDiagnostico = {
  /** E-mail da conta, já em minúsculas (o mesmo que foi ao `claimPurchasesOnLogin`). */
  email: string;
  userId: string;
  /** A conta nasceu agora neste envio, ou já era do FastCloner? */
  contaCriada: boolean;
  /** O que o resgate LANÇOU, se lançou. `null`/`undefined` = não lançou. */
  erro: unknown;
  /**
   * Órfãs (`user_id IS NULL`) com o e-mail desta conta que AINDA DÃO ACESSO.
   * O filtro de acesso é aplicado por quem chama, com a régua compartilhada
   * `entitlementValeAcesso` — não se copia regra de acesso aqui.
   */
  orfas: readonly EntitlementOrfa[];
};

/** O chamado a abrir, no formato que `abrirChamadoReportado` já consome. */
export type DiagnosticoClaim = {
  signature: string;
  title: string;
  description: string;
  sampleError: string | null;
  affectedEmails: string[];
  categoria: "tecnico";
};

/**
 * Status de compra que NÃO são pagamento.
 *
 * A régua é a do `pagou_de_verdade.cjs` e a do webhook (`PAID_STATUSES`, em
 * api/v1/webhooks/hotmart/route.ts): **valor > 0 não é sinônimo de pago**. A
 * Hotmart emite mensalidade OVERDUE, boleto impresso e Pix aguardando com
 * `price.value` cheio para quem nunca pagou — foi confundir os dois que
 * devolveu 1.356.554 créditos a 14 pessoas em 18/08.
 *
 * É uma lista do que NÃO conta, e não do que conta, de propósito: aqui um falso
 * NEGATIVO é o defeito que este arquivo veio consertar (o aluno pagou, ninguém
 * ficou sabendo). Status desconhecido, portanto, entra como suspeita e vai
 * ESCRITO na descrição, para uma pessoa julgar — em vez de sumir calado.
 */
const STATUS_NAO_PAGOS = new Set([
  "BILLET_PRINTED",
  "PRINTED_BILLET",
  "WAITING_PAYMENT",
  "PROCESSING_TRANSACTION",
  "UNDER_ANALISYS",
  "UNDER_ANALYSIS",
  "STARTED",
  "OVERDUE",
  "EXPIRED",
  "CANCELED",
  "CANCELLED",
  "REFUNDED",
  "CHARGEBACK",
  "DISPUTE",
  "BLOCKED",
]);

function objeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

/** `raw_event.purchase` — o webhook grava o `data` do evento (route.ts:227). */
function compraDo(rawEvent: unknown): Record<string, unknown> | null {
  return objeto(objeto(rawEvent)?.purchase);
}

/** Valor da compra (`purchase.price.value`), ou null se o payload não disser. */
export function valorDaCompra(rawEvent: unknown): number | null {
  const v = objeto(compraDo(rawEvent)?.price)?.value;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** `purchase.status` em maiúsculas, ou null. */
export function statusDaCompra(rawEvent: unknown): string | null {
  const s = compraDo(rawEvent)?.status;
  return typeof s === "string" && s.trim() ? s.trim().toUpperCase() : null;
}

/** Transação (`purchase.transaction`) — a chave que o crédito usa. */
export function transacaoDaCompra(rawEvent: unknown): string | null {
  const t = compraDo(rawEvent)?.transaction;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

/** Dinheiro entrou? Valor > 0 E status que não seja um "ainda não pagou". */
export function entitlementFoiPago(rawEvent: unknown): boolean {
  const valor = valorDaCompra(rawEvent);
  if (valor === null || valor <= 0) return false;
  const status = statusDaCompra(rawEvent);
  return !(status && STATUS_NAO_PAGOS.has(status));
}

/**
 * O erro cru, legível: mensagem + `code`/`details`/`hint` quando o Supabase
 * manda (é neles que mora o motivo real de um update recusado).
 */
export function detalheDoErro(erro: unknown): string | null {
  if (erro === null || erro === undefined) return null;
  const o = objeto(erro);
  const partes: string[] = [];
  const msg = erro instanceof Error ? erro.message : typeof o?.message === "string" ? o.message : String(erro);
  if (msg) partes.push(msg);
  for (const campo of ["code", "details", "hint"] as const) {
    const v = o?.[campo];
    if (typeof v === "string" && v.trim()) partes.push(`${campo}=${v.trim()}`);
    else if (typeof v === "number") partes.push(`${campo}=${v}`);
  }
  const texto = partes.join(" · ").trim();
  return texto || String(erro);
}

function linhaDaOrfa(o: EntitlementOrfa): string {
  const valor = valorDaCompra(o.raw_event);
  return [
    `external_id=${o.external_id ?? "?"}`,
    `status=${o.status ?? "?"}`,
    `access_until=${o.access_until ?? "NULL (vitalício)"}`,
    `buyer_email=${o.buyer_email ?? "?"}`,
    `valor=${valor === null ? "?" : valor}`,
    `purchase.status=${statusDaCompra(o.raw_event) ?? "?"}`,
    `transacao=${transacaoDaCompra(o.raw_event) ?? "?"}`,
  ].join(" · ");
}

/**
 * Devolve o chamado a abrir, ou `null` quando não há nada a relatar — que é o
 * caso normal e esmagadoramente mais comum: o aluno do SGP que simplesmente não
 * assina o FastCloner NÃO gera chamado nenhum aqui.
 *
 * ⚠️ ISSO É DE PROPÓSITO. Comprar o SGP não dá a plataforma (regra do Lucas,
 * 31/08): conta nova sem entitlement é o esperado, não é falha. Se este
 * diagnóstico disparasse por "ficou sem acesso", ele abriria ~349 chamados
 * falsos por lote e enterraria os 7 verdadeiros. O gatilho é estreito por
 * necessidade: **sobrou compra PAGA sem dono** (ou o resgate explodiu).
 */
export function diagnosticarClaim(e: EntradaDiagnostico): DiagnosticoClaim | null {
  const pagas = e.orfas.filter((o) => entitlementFoiPago(o.raw_event));
  const erro = detalheDoErro(e.erro);
  if (!pagas.length && !erro) return null;

  const origem = e.contaCriada ? "conta criada agora neste envio" : "conta já existia antes do SGP";

  const oQueFazer = pagas.length
    ? [
        "O QUE FAZER",
        "",
        `1. Esta pessoa (${e.email}) pagou o FastCloner e a compra NÃO entrou na conta dela. ` +
          "Na prática, ela está pagando e sem a plataforma. Trate como urgente.",
        "2. Não é preciso ela fazer nada, e não peça pra ela comprar de novo nem criar outra conta: " +
          "a compra existe, só não foi ligada à conta.",
        "3. Isso depende do time técnico ligar a compra na conta — você não resolve pelo painel. " +
          "Diga ao aluno que a compra dele foi localizada e já está sendo ligada à conta, sem prazo prometido.",
        "4. Se ele perguntar de crédito: o crédito entra junto com o acesso, no mesmo conserto. " +
          "Não prometa estorno nem valor nenhum.",
        "",
        "(quem resolve: time técnico)",
      ]
    : [
        "O QUE FAZER",
        "",
        `1. O sistema deu erro ao ligar as compras de ${e.email} na conta, no momento em que a conta do SGP foi criada.`,
        "2. NÃO encontramos compra paga solta no nome dela, então provavelmente ela não ficou sem nada — " +
          "mas o erro precisa ser olhado, porque ele pode ter atingido outras pessoas do mesmo lote.",
        "3. Se o aluno reclamar que pagou e não tem acesso, este chamado é a pista: encaminhe ao time técnico.",
        "",
        "(quem resolve: time técnico)",
      ];

  const tecnico = [
    "TÉCNICO",
    "",
    `email=${e.email} · user_id=${e.userId} · ${origem}`,
    `Origem: frontend/src/lib/sgp/processar.ts → claimPurchasesOnLogin (lib/payments/claim.ts).`,
    "",
    erro
      ? `Exceção do resgate: ${erro}`
      : "O resgate NÃO lançou exceção — voltou normal e mesmo assim não vinculou. " +
        "Este é o modo de falha do lote de 04/09 (incidente #282); `claimPurchasesOnLogin` " +
        "engole os próprios erros no try interno, então o motivo não sobe por exceção.",
    "",
    pagas.length
      ? [
          `Sobraram ${pagas.length} entitlement(s) PAGO(s) com user_id NULL depois do resgate:`,
          ...pagas.map((o) => `  - ${linhaDaOrfa(o)}`),
          "",
          "Suspeito nº 1: o UPDATE de reconcileUserEntitlements (payments/entitlements.ts) " +
            "não pegou a linha ou foi recusado. Confira RLS/erro do update — ele é gravado sem checar `error`.",
        ].join("\n")
      : "Nenhum entitlement pago órfão para este e-mail no momento da checagem.",
    "",
    "⚠️ LIMITE DESTA CHECAGEM: ela só enxerga órfãs cujo `buyer_email` casa com o e-mail da " +
      "conta (mesmo `ilike` do reconcile). Compra feita com OUTRO e-mail — inclusive variação de " +
      "ponto no Gmail — não aparece aqui e continua invisível.",
  ].join("\n");

  const title = (
    pagas.length
      ? `SGP: compra paga não entrou na conta de ${e.email}`
      : `SGP: erro ao resgatar compras de ${e.email}`
  ).slice(0, 120);

  return {
    // Namespace próprio: NÃO pode colidir com `sgp:tec:<email>` / `help:*`, que
    // são a conversa do aluno. Colidir sobrescreveria título e descrição de um
    // atendimento vivo (foi o estrago do #213).
    signature: `sgp:claim:${e.email}`,
    title,
    description: [...oQueFazer, "", tecnico].join("\n"),
    sampleError: (erro ?? (pagas.length ? linhaDaOrfa(pagas[0]) : null))?.slice(0, 1000) ?? null,
    affectedEmails: [e.email],
    categoria: "tecnico",
  };
}
