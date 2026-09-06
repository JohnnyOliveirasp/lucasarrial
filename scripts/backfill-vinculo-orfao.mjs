#!/usr/bin/env node
/**
 * RELIGAÇÃO MANUAL de entitlements órfãos cuja conta JÁ EXISTE.
 * ============================================================
 * NÃO RODA SOZINHO E NÃO ESTÁ EM NENHUM CRON. Exige `--confirmar` para
 * escrever qualquer coisa; sem ele é DRY-RUN e só imprime o plano.
 *
 * Casos que motivaram (medidos em 06/09/2026): 8 pessoas com conta em
 * `profiles`, entitlement `active` com `access_until` futuro e
 * `entitlements.user_id` NULL → plano free, acesso NULL, ZERO créditos.
 * A causa está documentada em `frontend/src/lib/payments/vinculo-quebrado.ts`:
 * a carga de 04/09 criou 349 contas sem chamar `claimPurchasesOnLogin`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * AUTORIZAÇÃO
 * ─────────────────────────────────────────────────────────────────────────
 * São ~100.000 créditos POR PESSOA (PLAN_MONTHLY_CREDITS). A decisão de
 * liberar é do Johnny/Lucas — este script existe para que, quando o "sim"
 * vier, a execução seja conferível e reversível, não improvisada no psql.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ANÁLISE DE RISCO
 * ─────────────────────────────────────────────────────────────────────────
 * 1. CRÉDITO EM DOBRO (o risco caro). `grant_subscription_credits` RESETA o
 *    saldo da assinatura; chamar duas vezes para o mesmo ciclo devolve
 *    créditos que a pessoa já gastou. Mitigação: antes de creditar, o script
 *    checa `credit_transactions` por `kind='subscription_grant'` nas DUAS
 *    chaves possíveis (a transação do `raw_event` E o `external_id`), que é
 *    exatamente a trava do `claim.ts`. Se qualquer uma já creditou, ele
 *    VINCULA e PULA o crédito. Sem a checagem nas duas chaves, uma compra já
 *    creditada pelo webhook (chave = transação) seria creditada de novo aqui
 *    (chave = assinante).
 * 2. VINCULAR A COMPRA NA CONTA ERRADA. Só religa quando `buyer_email` e
 *    `profiles.email` são IGUAIS depois de trim+lowercase. Casar por nome ou
 *    por prefixo é chute, e chute aqui dá produto pago a quem não pagou.
 * 3. ROUBAR COMPRA DE OUTRO DONO. Só toca linhas com `user_id` IS NULL
 *    (mesma guarda do incidente #222: o vínculo só ADICIONA dono, nunca
 *    substitui). A condição vai no próprio UPDATE, não só no filtro em
 *    memória, então uma corrida com o claim do login não sobrescreve nada.
 * 4. LIBERAR CURSO COMO SE FOSSE ASSINATURA. Só processa `product_code`
 *    igual ao produto da plataforma (7851642). SGP e FCI NÃO dão FastCloner
 *    (regra do Lucas, 31/08); liberar em cima de curso é dar o produto de
 *    graça.
 * 5. ACESSO EXPIRADO. Ignora quem não tem acesso vigente (`access_until` no
 *    passado): isso é churn com crédito sobrando, não dinheiro presente.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ROLLBACK
 * ─────────────────────────────────────────────────────────────────────────
 * Antes de escrever, grava `backfill-vinculo-<timestamp>.json` com o estado
 * ANTERIOR de cada linha (entitlement.user_id, profile.plan/access_until/
 * saldos). Para desfazer:
 *     node scripts/backfill-vinculo-orfao.mjs --rollback <arquivo.json> --confirmar
 * O rollback devolve `user_id` para NULL e o profile ao plano/acesso/saldo
 * anteriores. ATENÇÃO: ele NÃO desfaz consumo — se a pessoa já gastou os
 * créditos liberados, o saldo volta ao valor antigo e a diferença fica como
 * prejuízo aceito. Por isso o dry-run existe: confira a lista ANTES.
 *
 * USO
 *   node scripts/backfill-vinculo-orfao.mjs                    # dry-run
 *   node scripts/backfill-vinculo-orfao.mjs --confirmar        # executa
 *   node scripts/backfill-vinculo-orfao.mjs --so max@x.com     # um e-mail só
 *   node scripts/backfill-vinculo-orfao.mjs --rollback f.json --confirmar
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

// A raiz do repo NÃO tem node_modules (só `frontend/` tem), então import bare
// daqui quebra com ERR_MODULE_NOT_FOUND. Mesma solução do _frank/ferramentas/
// _comum.cjs: resolver as dependências a partir de `frontend/`, seja qual for
// o diretório de onde o script foi chamado.
const req = createRequire(new URL("../frontend/package.json", import.meta.url));
const { createClient } = req("@supabase/supabase-js");
req("dotenv").config({ path: new URL("../frontend/.env.local", import.meta.url).pathname });

const PRODUTO_PLATAFORMA = "7851642";
const PLAN_MONTHLY_CREDITS = 100_000;

const args = process.argv.slice(2);
const CONFIRMAR = args.includes("--confirmar");
const so = args.indexOf("--so") >= 0 ? args[args.indexOf("--so") + 1] : null;
const rollbackFile = args.indexOf("--rollback") >= 0 ? args[args.indexOf("--rollback") + 1] : null;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("credenciais ausentes em frontend/.env.local");
  process.exit(1);
}
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = class { constructor() { throw new Error("realtime nao usado"); } };
}
const db = createClient(url, key);

const norm = (e) => (e ?? "").trim().toLowerCase();

/** Número da cobrança guardado no raw_event (mesma leitura do claim.ts). */
function transacaoDe(raw) {
  const t = raw?.purchase?.transaction;
  return typeof t === "string" && t ? t : null;
}

async function rollback(arquivo) {
  const estado = JSON.parse(readFileSync(arquivo, "utf8"));
  console.log(`ROLLBACK de ${estado.casos.length} caso(s) a partir de ${arquivo}`);
  for (const c of estado.casos) {
    console.log(`  ${c.email}: user_id→NULL, plan→${c.antes.plan}, acesso→${c.antes.access_until}`);
    if (!CONFIRMAR) continue;
    await db.from("entitlements").update({ user_id: null }).eq("id", c.entitlementId);
    await db
      .from("profiles")
      .update({
        plan: c.antes.plan,
        access_until: c.antes.access_until,
        access_source: c.antes.access_source,
        credits_subscription: c.antes.credits_subscription,
      })
      .eq("id", c.userId);
  }
  console.log(CONFIRMAR ? "rollback aplicado." : "DRY-RUN (use --confirmar).");
}

async function main() {
  if (rollbackFile) return rollback(rollbackFile);

  const agora = new Date().toISOString();

  // Órfãos ativos do produto da plataforma (paginado — o teto de 1000 do
  // PostgREST esconderia justamente os mais antigos).
  const orfaos = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("entitlements")
      .select("id, external_id, buyer_email, status, access_until, product_code, raw_event")
      .is("user_id", null)
      .eq("status", "active")
      .range(de, de + 999);
    if (error) throw new Error(`entitlements: ${error.message}`);
    orfaos.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const candidatos = orfaos.filter(
    (e) =>
      e.product_code === PRODUTO_PLATAFORMA && // risco 4
      (e.access_until === null || e.access_until > agora) && // risco 5
      (!so || norm(e.buyer_email) === norm(so)),
  );

  const casos = [];
  for (const e of candidatos) {
    const email = norm(e.buyer_email);
    const { data: p } = await db
      .from("profiles")
      .select("id, email, plan, access_until, access_source, credits_subscription, credits_extra")
      .eq("email", email) // risco 2: igualdade exata, já normalizada
      .maybeSingle();
    if (!p) continue; // sem conta = caso do convite, não deste script

    // risco 1: já creditaram este ciclo por QUALQUER uma das duas chaves?
    const trx = transacaoDe(e.raw_event);
    const chaves = [...new Set([trx, e.external_id].filter(Boolean))];
    const { data: tx } = await db
      .from("credit_transactions")
      .select("id")
      .eq("user_id", p.id)
      .eq("kind", "subscription_grant")
      .in("ref_id", chaves)
      .limit(1)
      .maybeSingle();

    casos.push({
      email,
      entitlementId: e.id,
      externalId: e.external_id,
      userId: p.id,
      refId: trx ?? e.external_id,
      jaCreditado: Boolean(tx),
      antes: {
        plan: p.plan,
        access_until: p.access_until,
        access_source: p.access_source,
        credits_subscription: p.credits_subscription,
        credits_extra: p.credits_extra,
      },
      accessUntil: e.access_until,
    });
  }

  console.log(`órfãos ativos: ${orfaos.length} | candidatos do produto: ${candidatos.length}`);
  console.log(`COM conta (religáveis): ${casos.length}\n`);
  for (const c of casos) {
    console.log(
      `  ${c.email.padEnd(34)} ent=${c.externalId} | vincular=SIM | creditar=${
        c.jaCreditado ? "NÃO (já creditado)" : `SIM (${PLAN_MONTHLY_CREDITS})`
      } | acesso→${c.accessUntil}`,
    );
  }
  const aCreditar = casos.filter((c) => !c.jaCreditado).length;
  console.log(
    `\nTOTAL: ${casos.length} vínculo(s), ${aCreditar} crédito(s) de ${PLAN_MONTHLY_CREDITS} = ${
      aCreditar * PLAN_MONTHLY_CREDITS
    } créditos`,
  );

  if (!CONFIRMAR) {
    console.log("\nDRY-RUN. Nada foi escrito. Use --confirmar para executar.");
    return;
  }

  const arquivo = `backfill-vinculo-${agora.replace(/[:.]/g, "-")}.json`;
  writeFileSync(arquivo, JSON.stringify({ at: agora, casos }, null, 2));
  console.log(`\nestado anterior salvo em ${arquivo} (use --rollback)`);

  for (const c of casos) {
    // risco 3: a condição user_id IS NULL vai no próprio UPDATE.
    const { error: errVinculo } = await db
      .from("entitlements")
      .update({ user_id: c.userId, updated_at: new Date().toISOString() })
      .eq("id", c.entitlementId)
      .is("user_id", null);
    if (errVinculo) {
      console.error(`  ${c.email}: FALHOU no vínculo — ${errVinculo.message}`);
      continue;
    }
    if (!c.jaCreditado) {
      const { data, error } = await db.rpc("grant_subscription_credits", {
        p_user_id: c.userId,
        p_amount: PLAN_MONTHLY_CREDITS,
        p_ref_type: "payment_event",
        p_ref_id: c.refId,
      });
      if (error) console.error(`  ${c.email}: crédito FALHOU — ${error.message}`);
      else console.log(`  ${c.email}: creditado (saldo=${data?.balance})`);
    }
    // propaga o acesso do entitlement para o cache do profile
    await db
      .from("profiles")
      .update({
        plan: "pro",
        access_source: "hotmart",
        access_until: c.accessUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", c.userId);
    console.log(`  ${c.email}: vinculado e acesso propagado`);
  }
  console.log("\nconcluído. Confira com _frank/ferramentas/aluno.cjs <email>.");
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
