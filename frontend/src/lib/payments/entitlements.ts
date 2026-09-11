/**
 * Concessão/revogação de acesso pago — compartilhado por todos os provedores
 * (hoje só Hotmart; Mercado Pago plugará aqui depois).
 *
 * Fonte da verdade = tabela `entitlements` (1 linha por compra/assinatura).
 * `profiles` guarda um CACHE (plan/access_until/access_source) pra o gate ser
 * rápido (middleware não precisa varrer entitlements a cada request).
 *
 * Mapeamento comprador↔usuário é por e-mail (lowercase). Se o e-mail da compra
 * não casar com nenhum usuário, o entitlement NASCE "órfão" (user_id NULL) e é
 * reconciliado quando o usuário aparecer (reconcileUserEntitlements).
 *
 * ⚠️ Órfã só NASCE órfã: o lookup por e-mail nunca DESVINCULA uma linha que já
 * tem dono (incidente #222 — ver a guarda em `grantAccess` e `vinculo.ts`).
 */
import { getAdmin } from "@/lib/db/admin";
import { donoDoEntitlement } from "@/lib/payments/vinculo";
import {
  entitlementDaPlataforma,
  entitlementValeAcesso,
  produtosDeCurso,
} from "@/lib/payments/acesso-regra";
import type {
  EntitlementStatus,
  EntitlementUpdate,
  Json,
  PaymentProvider,
} from "@/lib/db/types";

type GrantInput = {
  provider: PaymentProvider;
  buyerEmail: string;
  externalId: string; // assinatura (recorrente) OU transação (único)
  productCode?: string | null;
  offerCode?: string | null;
  accessUntil?: string | null; // ISO; NULL = vitalício (pagamento único)
  rawEvent?: unknown;
};

type RevokeInput = {
  provider: PaymentProvider;
  externalId: string;
  status: Exclude<EntitlementStatus, "active">;
  accessUntil?: string | null; // cancelamento recorrente: manter acesso até o fim do período já pago
  rawEvent?: unknown;
};

/** Libera/renova acesso. Idempotente por (provider, external_id). */
export async function grantAccess(input: GrantInput): Promise<void> {
  const admin = getAdmin();
  const email = input.buyerEmail.trim().toLowerCase();

  // ⚠️ O lookup por e-mail só ADICIONA dono, nunca REMOVE (incidente #222).
  //
  // Quando a compra foi feita com um e-mail que não tem perfil (comprou com um
  // e-mail, criou a conta com outro), `findUserIdByEmail` devolve NULL. Sem a
  // guarda abaixo o upsert gravava esse NULL POR CIMA do dono, desligando a
  // compra da conta no próximo evento da Hotmart daquela assinatura — e, como
  // `userId` ficava null, nem `recomputeProfileAccess` era chamado: o aluno
  // perdia o acesso em silêncio. Era isso que fazia o conserto manual desses
  // casos apodrecer sozinho, então a guarda tem que existir ANTES de vincular
  // órfã na mão.
  //
  // Não achar perfil para o e-mail da compra é ausência de informação, não é
  // a informação "esta compra não tem dono". A decisão mora em `vinculo.ts`,
  // sob teste (`vinculo.test.ts`).
  const userIdDoEmail = await findUserIdByEmail(email);
  let userId = userIdDoEmail;
  if (!userIdDoEmail) {
    const { data: atual } = await admin
      .from("entitlements")
      .select("user_id")
      .eq("provider", input.provider)
      .eq("external_id", input.externalId)
      .maybeSingle();
    userId = donoDoEntitlement(userIdDoEmail, atual?.user_id ?? null);
  }

  await admin.from("entitlements").upsert(
    {
      user_id: userId,
      buyer_email: email,
      provider: input.provider,
      product_code: input.productCode ?? null,
      offer_code: input.offerCode ?? null,
      external_id: input.externalId,
      status: "active",
      access_until: input.accessUntil ?? null,
      raw_event: (input.rawEvent ?? null) as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,external_id" },
  );

  if (userId) await recomputeProfileAccess(userId);
}

/**
 * Revoga/suspende acesso. Idempotente.
 * Devolve true se um entitlement foi encontrado e atualizado; false se o
 * externalId não casa com nenhum (revoke antes do grant, OU id extraído
 * errado do payload — o caller decide se isso é erro e registra).
 */
export async function revokeAccess(input: RevokeInput): Promise<boolean> {
  const admin = getAdmin();
  const { data: existing } = await admin
    .from("entitlements")
    .select("id, user_id")
    .eq("provider", input.provider)
    .eq("external_id", input.externalId)
    .maybeSingle();

  if (!existing) return false; // nenhum entitlement com esse external_id

  const patch: EntitlementUpdate = {
    status: input.status,
    raw_event: (input.rawEvent ?? null) as Json,
    updated_at: new Date().toISOString(),
  };
  // só sobrescreve access_until quando o caller especifica (cancelamento recorrente).
  if (input.accessUntil !== undefined) patch.access_until = input.accessUntil;

  await admin.from("entitlements").update(patch).eq("id", existing.id);
  if (existing.user_id) await recomputeProfileAccess(existing.user_id);
  return true;
}

/**
 * Vincula entitlements órfãos (user_id NULL) ao usuário pelo e-mail e
 * recalcula o acesso. Chamar no login/callback ou no fluxo de "reivindicar".
 *
 * ⚠️ NÃO adota linha de produto de CURSO (#2d0509b4). O update era cego a
 * `product_code`: casava TODA órfã do e-mail, e o `recomputeProfileAccess`
 * logo abaixo transformava entitlement de curso em `plan=pro` + `access_until`
 * + crédito. Como os eventos de curso de 09/06 passaram pelo `grantAccess`
 * antes de existir o roteamento por produto, eles nasceram `active` com
 * `access_until` NULL — vitalício —, então quem comprou SÓ o curso ganhava a
 * plataforma PARA SEMPRE no primeiro login. Medido em 08/09: 15 linhas, 12
 * pessoas, 11 delas a um login de distância.
 *
 * A órfã de curso continua órfã de propósito: adotá-la sem contá-la no acesso
 * exigiria mexer no `recomputeProfileAccess`, e aí a próxima recomputação
 * RETIRARIA o vitalício de quem já está usando — que é decisão comercial
 * (honrar ou revogar os 15), não minha. Este conserto só fecha a torneira;
 * ele não mexe em ninguém que já tem acesso hoje.
 */
export async function reconcileUserEntitlements(
  userId: string,
  email: string,
): Promise<void> {
  const admin = getAdmin();
  const e = email.trim().toLowerCase();

  const { data: orfas } = await admin
    .from("entitlements")
    .select("id, product_code")
    .is("user_id", null)
    .ilike("buyer_email", e);

  const cursos = produtosDeCurso();
  const adotaveis = (orfas ?? [])
    .filter((o) => entitlementDaPlataforma(o.product_code, cursos))
    .map((o) => o.id);

  if (adotaveis.length > 0) {
    await admin
      .from("entitlements")
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .in("id", adotaveis);
  }

  await recomputeProfileAccess(userId);
}

// ── helpers internos ────────────────────────────────────────────────────────

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await getAdmin()
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * A regra de "este entitlement dá acesso AGORA?" mora agora em `acesso-regra.ts`
 * — módulo PURO, zero import — e é re-exportada daqui pra ninguém precisar
 * trocar o import (08/09).
 *
 * Motivo da mudança de casa: ESTE arquivo importa `@/lib/db/admin`, o que
 * impedia `node --test` de tocar na regra. A frase mais cara da casa (quem
 * entra, quem tem crédito, quem recebe qual e-mail) era a única sem teste
 * próprio — e ela já foi lida errado duas vezes: em 20/08 (`canceled` perdia o
 * período já pago) e em 08/09 (o convite de compra órfã pulava `canceled`
 * dentro da janela paga). A regra em si NAO mudou: é byte a byte a de antes.
 */
export { entitlementValeAcesso } from "@/lib/payments/acesso-regra";

/**
 * Recalcula o cache de acesso no profile a partir dos entitlements do usuário.
 * Tem acesso quem possui ≥1 entitlement 'active' não expirado
 * (access_until NULL = vitalício).
 */
async function recomputeProfileAccess(userId: string): Promise<void> {
  const admin = getAdmin();
  const nowIso = new Date().toISOString();

  const { data: ents } = await admin
    .from("entitlements")
    .select("provider, status, access_until")
    .eq("user_id", userId);

  const valeAcesso = (e: { status: string; access_until: string | null }) =>
    entitlementValeAcesso(e, nowIso);

  // Entre varios, o melhor: "active" ganha de "canceled"; empatado, a data mais
  // longe (vitalicio = infinito). Sem isto, um entitlement velho poderia
  // encurtar o acesso de quem tem outro mais novo.
  const active = (ents ?? [])
    .filter(valeAcesso)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      const va = a.access_until === null ? Infinity : new Date(a.access_until).getTime();
      const vb = b.access_until === null ? Infinity : new Date(b.access_until).getTime();
      return vb - va;
    })[0];

  await admin
    .from("profiles")
    .update(
      active
        ? {
            plan: "pro",
            access_source: active.provider,
            access_until: active.access_until,
            updated_at: nowIso,
          }
        : {
            plan: "free",
            access_source: null,
            access_until: null,
            updated_at: nowIso,
          },
    )
    .eq("id", userId);
}
