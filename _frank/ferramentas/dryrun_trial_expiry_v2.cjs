/**
 * DRY-RUN SECO da expire_trial_credits v2 (scripts/85_trial_expiry_v2.sql).
 *
 * Reproduz EXATAMENTE a decisão da função nova, em modo SOMENTE LEITURA:
 * lista nominal de quem seria zerado e quanto, quem seria marcado paid, quem
 * seria pulado e por quê. NÃO zera ninguém, NÃO marca ninguém, NÃO escreve
 * nada — regra 9-A: detector propõe, não executa.
 *
 * A lógica de classificação é pura e exportada (testes em
 * dryrun_trial_expiry_v2.test.cjs rodam sem banco: `node --test`).
 *
 * ⚠️ As duas armadilhas que este arquivo carrega de propósito:
 * 1. GRAFIA: o webhook grava `recurrence_number`; a API REST devolve
 *    `recurrency_number`. Aqui só se lê payment_events (webhook) → grafia
 *    `recurrence_number`, confirmada em produção 20/08 (2.516 vs 0).
 * 2. PAGINAÇÃO: consulta Supabase sem .range() trunca em 1000 linhas EM
 *    SILÊNCIO (incidente do PR #13). Tudo aqui pagina.
 *
 * Uso:  node _frank/ferramentas/dryrun_trial_expiry_v2.cjs [--grace 10]
 */
const PAGO_EVENTOS = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
const DIA_MS = 24 * 60 * 60 * 1000;

/** Allowlist da equipe — espelho de bypassesBilling (lib/credits/access.ts). */
function allowlistDoEnv(env = process.env) {
  const comp = (env.COMP_ACCESS_EMAILS ??
    "johnny.oliveirasp@gmail.com,lucas.m.arrial@gmail.com,eduardo@lucasarrial.com");
  const admin = env.ADMIN_EMAILS ?? "";
  return new Set(
    `${comp},${admin}`.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
}

/** Pagamento de verdade DA ASSINATURA num evento de WEBHOOK (payment_events). */
function ehPagamento(ev) {
  if (!PAGO_EVENTOS.has(ev.event_type)) return false;
  const pu = ev.payload?.data?.purchase;
  if (!pu) return false;
  const valor = Number(pu.price?.value ?? 0);
  // grafia do WEBHOOK; `recurrency_number` (REST) NÃO conta aqui de propósito —
  // se aparecer, é sinal de dado fora do lugar, não de pagamento.
  return valor > 0 && pu.recurrence_number != null;
}

/** Trial = critério do painel (mig 63): APPROVED, rec 1, valor 0. */
function ehTrial(ev) {
  if (ev.event_type !== "PURCHASE_APPROVED") return false;
  const pu = ev.payload?.data?.purchase;
  if (!pu) return false;
  return Number(pu.price?.value ?? 0) === 0 && Number(pu.recurrence_number) === 1;
}

/** {trials: Map(email→trial_start ISO), pagos: Set(email)} a partir dos eventos. */
function montarConjuntos(eventos) {
  const trials = new Map(), pagos = new Set();
  for (const ev of eventos) {
    const email = (ev.payload?.data?.buyer?.email ?? "").toLowerCase();
    if (!email) continue;
    if (ehTrial(ev)) {
      const atual = trials.get(email);
      if (!atual || ev.received_at < atual) trials.set(email, ev.received_at);
    }
    if (ehPagamento(ev)) pagos.add(email);
  }
  return { trials, pagos };
}

/** Entitlement que protege (guarda ALARGADA da v2). Devolve o motivo ou null.
 *  Comparação por época, nunca por string: os formatos divergem (+00:00 vs Z). */
function guardaEntitlement(ents, agora) {
  const agoraMs = Date.parse(agora);
  for (const en of ents) {
    if (en.status === "active" && (en.access_until == null || Date.parse(en.access_until) > agoraMs)) {
      return "entitlement_ativo";
    }
  }
  for (const en of ents) {
    if (en.status === "canceled" && en.access_until != null && Date.parse(en.access_until) > agoraMs) {
      return "canceled_vigente";
    }
  }
  return null;
}

/**
 * A decisão da v2 para UMA pessoa, na MESMA ORDEM do SQL.
 * Devolve { decisao, debito } — decisao ∈ fora_do_prazo | ja_resolvido |
 * allowlist | marcaria_paid | sem_conta | pulado_entitlement_ativo |
 * pulado_canceled_vigente | zeraria | marcaria_zeroed_sem_saldo.
 */
function classificar({ email, trialStart, agora, graceDays, allowSet, pagos, resolvidos, perfil, ents }) {
  const limiteMs = Date.parse(agora) - graceDays * DIA_MS;
  if (Date.parse(trialStart) > limiteMs) return { decisao: "fora_do_prazo", debito: 0 };
  if (resolvidos.has(email)) return { decisao: "ja_resolvido", debito: 0 };
  if (allowSet.has(email)) return { decisao: "allowlist", debito: 0 };
  if (pagos.has(email)) return { decisao: "marcaria_paid", debito: 0 };
  if (!perfil) return { decisao: "sem_conta", debito: 0 };
  const guarda = guardaEntitlement(ents ?? [], agora);
  if (guarda === "entitlement_ativo") return { decisao: "pulado_entitlement_ativo", debito: 0 };
  if (guarda === "canceled_vigente") return { decisao: "pulado_canceled_vigente", debito: 0 };
  const sub = Math.max(Number(perfil.credits_subscription ?? 0), 0);
  if (sub > 0) return { decisao: "zeraria", debito: sub };
  return { decisao: "marcaria_zeroed_sem_saldo", debito: 0 };
}

/** Teto da v2: vale sobre DÉBITOS REAIS, não sobre marcadores de saldo zero. */
function estouraTeto(debitosReais, teto) {
  return debitosReais > teto;
}

module.exports = { allowlistDoEnv, ehPagamento, ehTrial, montarConjuntos, guardaEntitlement, classificar, estouraTeto };

// ── execução: só leitura contra produção ─────────────────────────────────────
if (require.main === module) (async () => {
  const { supa } = require("./_comum.cjs");
  const db = supa();
  const graceDays = Number(process.argv.includes("--grace")
    ? process.argv[process.argv.indexOf("--grace") + 1] : 10);
  const agora = new Date().toISOString();

  // paginação SEMPRE (armadilha 2 do cabeçalho)
  async function tudo(tabela, colunas, filtro) {
    const page = 1000; let from = 0; const linhas = [];
    for (;;) {
      let q = db.from(tabela).select(colunas).range(from, from + page - 1);
      if (filtro) q = filtro(q);
      const { data, error } = await q;
      if (error) throw new Error(`${tabela}: ${error.message}`);
      linhas.push(...(data ?? []));
      if (!data || data.length < page) break;
      from += page;
    }
    return linhas;
  }

  const eventos = await tudo("payment_events", "event_type,payload,received_at",
    (q) => q.eq("provider", "hotmart").in("event_type", [...PAGO_EVENTOS]).order("received_at", { ascending: true }));
  const marcas = await tudo("trial_credit_expirations", "email,outcome",
    (q) => q.order("email", { ascending: true }));
  const perfis = await tudo("profiles", "id,email,credits_subscription,credits_extra,access_until",
    (q) => q.order("id", { ascending: true }));
  const entitlements = await tudo("entitlements", "user_id,status,access_until",
    (q) => q.order("user_id", { ascending: true }));

  const { trials, pagos } = montarConjuntos(eventos);
  const resolvidos = new Set(marcas.map((m) => m.email.toLowerCase()));
  const allowSet = allowlistDoEnv();
  const perfilPorEmail = new Map(perfis.filter((p) => p.email).map((p) => [p.email.toLowerCase(), p]));
  const entsPorUser = new Map();
  for (const en of entitlements) {
    if (!entsPorUser.has(en.user_id)) entsPorUser.set(en.user_id, []);
    entsPorUser.get(en.user_id).push(en);
  }

  const porDecisao = {};
  const zeraria = [];
  for (const [email, trialStart] of trials) {
    const perfil = perfilPorEmail.get(email) ?? null;
    const r = classificar({
      email, trialStart, agora, graceDays, allowSet, pagos, resolvidos,
      perfil, ents: perfil ? entsPorUser.get(perfil.id) ?? [] : [],
    });
    porDecisao[r.decisao] = (porDecisao[r.decisao] ?? 0) + 1;
    if (r.decisao === "zeraria") zeraria.push({ email, trialStart, debito: r.debito, extra: Number(perfil.credits_extra ?? 0) });
  }
  zeraria.sort((a, b) => b.debito - a.debito);
  const totalDebito = zeraria.reduce((s, z) => s + z.debito, 0);

  console.log(`DRY-RUN expire_trial_credits v2 — ${agora} — grace ${graceDays} dias — SOMENTE LEITURA, nada foi alterado`);
  console.log(`eventos lidos: ${eventos.length} | trials distintos: ${trials.size} | pagos distintos: ${pagos.size} | marcadores existentes: ${marcas.length}`);
  console.log(`\nresumo por decisão:`);
  for (const [k, v] of Object.entries(porDecisao).sort()) console.log(`  ${k.padEnd(28)} ${v}`);
  console.log(`\nSERIAM ZERADOS (debito real): ${zeraria.length} pessoas / ${totalDebito.toLocaleString("pt-BR")} créditos`);
  console.log(`teto da v2 (default 20 débitos reais): ${estouraTeto(zeraria.length, 20) ? "ESTOURA — a rodada abortaria inteira" : "não estoura"}`);
  console.log(`\n${"e-mail".padEnd(45)} ${"trial_start".padEnd(12)} ${"zeraria".padStart(10)} ${"extra(intocado)".padStart(16)}`);
  for (const z of zeraria) {
    console.log(`${z.email.padEnd(45)} ${z.trialStart.slice(0, 10).padEnd(12)} ${z.debito.toLocaleString("pt-BR").padStart(10)} ${z.extra.toLocaleString("pt-BR").padStart(16)}`);
  }
  console.log(`\nconfirmação individual antes de religar (regra 9-A):`);
  console.log(`node _frank/ferramentas/pagou_de_verdade.cjs ${zeraria.map((z) => z.email).join(" ")}`);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
