#!/usr/bin/env node
/**
 * backfill_acesso_pago.cjs — restaura em `profiles` o período JÁ PAGO que o bug
 * corrigido no `a9e33ae` apagou.
 *
 * POR QUE EXISTE. Até 20/08 o `recomputeProfileAccess()` só considerava
 * entitlement `active`; entitlement `canceled` com data futura (= período pago
 * que o webhook grava de propósito) era jogado fora e `profiles.access_until`
 * virava NULL. O `a9e33ae` consertou a CAUSA, mas `recomputeProfileAccess()` só
 * roda quando chega evento novo de webhook — e quem já cancelou não recebe mais
 * evento nenhum. Sem backfill, os divergentes ficam divergentes até o período
 * pago vencer, e aí não há mais o que restaurar. Incidente `c3893803`.
 *
 * O QUE ELE NÃO FAZ, de propósito:
 *  - NÃO concede acesso a ninguém. Só copia para o profile o `access_until` que
 *    JÁ ESTÁ no entitlement, quando a regra do `a9e33ae` diz que ele vale.
 *  - NÃO revoga nada. Perfil com data no passado já lê como "sem acesso" no
 *    `hasActiveAccess()` (compara com agora), então não é dano e não se mexe.
 *  - NÃO toca em crédito, não cobra, não gasta GPU, não escreve para aluno.
 *
 * A regra é a MESMA de `frontend/src/lib/payments/entitlements.ts` (valeAcesso +
 * desempate). Se aquele arquivo mudar, este tem que mudar junto.
 *
 * Uso:
 *   node _frank/ferramentas/backfill_acesso_pago.cjs               # ENSAIO (não grava)
 *   node _frank/ferramentas/backfill_acesso_pago.cjs --confirmar   # grava
 *
 * Idempotente: rodar de novo depois de aplicado não acha divergência nenhuma.
 */
const { supa, fechamento } = require("./_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");
const db = supa();

/** Lê a tabela inteira PAGINADA — a consulta do Supabase corta em 1000. */
async function tudo(tabela, colunas) {
  const out = [];
  for (let de = 0; ; de += 500) {
    const r = await db.from(tabela).select(colunas).range(de, de + 499);
    if (r.error) {
      console.error(`ERRO ao ler ${tabela}[${de}]:`, JSON.stringify(r.error));
      process.exit(1);
    }
    out.push(...(r.data ?? []));
    if ((r.data ?? []).length < 500) break;
  }
  return out;
}

/** Cópia fiel de valeAcesso() do entitlements.ts (a9e33ae). */
function valeAcesso(e, nowIso) {
  if (e.status === "active") return e.access_until === null || e.access_until > nowIso;
  if (e.status === "canceled") return e.access_until !== null && e.access_until > nowIso;
  return false; // refunded / chargeback / expired
}

/** Melhor entitlement: "active" ganha de "canceled"; empatado, a data mais longe. */
function melhor(a, b) {
  if (!a) return b;
  if (a.status !== b.status) return a.status === "active" ? a : b;
  const va = a.access_until === null ? Infinity : new Date(a.access_until).getTime();
  const vb = b.access_until === null ? Infinity : new Date(b.access_until).getTime();
  return vb > va ? b : a;
}

(async () => {
  const nowIso = new Date().toISOString();
  console.log(`# backfill_acesso_pago — ${CONFIRMAR ? "APLICANDO" : "ENSAIO (nada será gravado)"}`);
  console.log(`# agora = ${nowIso}\n`);

  const ents = await tudo("entitlements", "user_id, buyer_email, provider, status, access_until");
  const profs = await tudo("profiles", "id, email, plan, access_until, access_source, credits_subscription, credits_extra");
  console.log(`entitlements = ${ents.length} | profiles = ${profs.length}  (ambos paginados)`);

  const porUser = new Map();
  for (const e of ents) {
    if (!e.user_id || !valeAcesso(e, nowIso)) continue;
    porUser.set(e.user_id, melhor(porUser.get(e.user_id), e));
  }

  const pMap = new Map(profs.map((p) => [p.id, p]));
  const alvos = [];
  for (const [uid, e] of porUser) {
    const p = pMap.get(uid);
    if (!p) continue; // sem profile: não é backfill, é outro problema
    if (p.access_until === e.access_until) continue; // já certo
    alvos.push({ uid, email: p.email ?? e.buyer_email, de: p.access_until, para: e.access_until, plan_de: p.plan, provider: e.provider, status_ent: e.status });
  }
  alvos.sort((a, b) => String(a.para).localeCompare(String(b.para)));

  console.log(`\n=== DIVERGENTES = ${alvos.length} ===`);
  for (const a of alvos) {
    const h = ((new Date(a.para).getTime() - Date.now()) / 3600000).toFixed(1);
    console.log(`  ${a.email}\n     profile.access_until ${a.de ?? "NULL"} -> ${a.para}  (vence em ${h}h)  plan ${a.plan_de} -> pro  [ent ${a.status_ent}/${a.provider}]`);
  }
  if (alvos.length === 0) {
    console.log("  nada a fazer — profiles já batem com os entitlements.");
    return;
  }

  if (!CONFIRMAR) {
    console.log(`\n# ENSAIO. Nada foi gravado. Para aplicar: --confirmar`);
    return;
  }

  console.log(`\n=== GRAVANDO ===`);
  let ok = 0;
  const falhas = [];
  for (const a of alvos) {
    const r = await db
      .from("profiles")
      .update({ plan: "pro", access_source: a.provider, access_until: a.para, updated_at: new Date().toISOString() })
      .eq("id", a.uid)
      .select("id, email, plan, access_until"); // .select() => sabemos QUANTAS linhas foram afetadas
    const n = (r.data ?? []).length;
    if (r.error || n !== 1) {
      falhas.push({ email: a.email, erro: JSON.stringify(r.error), linhas: n });
      console.log(`  ✗ ${a.email} — linhas afetadas = ${n} | erro = ${JSON.stringify(r.error)}`);
      continue;
    }
    ok++;
    console.log(`  ✓ ${a.email} — 1 linha | gravado access_until=${r.data[0].access_until} plan=${r.data[0].plan}`);
  }
  console.log(`\ngravados = ${ok} | falhas = ${falhas.length}`);

  // RELEITURA INDEPENDENTE: não acredite no retorno do update, leia de novo.
  console.log(`\n=== RELEITURA INDEPENDENTE (fonte: banco, depois de gravar) ===`);
  const depois = await tudo("profiles", "id, email, plan, access_until");
  const dMap = new Map(depois.map((p) => [p.id, p]));
  let conferidos = 0;
  for (const a of alvos) {
    const p = dMap.get(a.uid);
    const bate = p && p.access_until === a.para && p.plan === "pro";
    if (bate) conferidos++;
    else console.log(`  ✗ NÃO BATE ${a.email}: esperado ${a.para}, no banco ${p?.access_until ?? "SEM PROFILE"}`);
  }
  console.log(`conferidos no banco = ${conferidos}/${alvos.length}`);
  if (conferidos !== alvos.length) process.exitCode = 1;
})();
