/**
 * BACKLOG da varredura desligada — versão 2. SOMENTE LEITURA.
 *
 * A v1 (`2026-08-26_confere_cancelamentos_25.cjs`, bloco 3) devolveu
 * "0 pessoas, 0 cr" e 63 sem classificar. O motivo: o payload de
 * SUBSCRIPTION_CANCELLATION **não tem** `accession_date` — nem em
 * `data.subscription`, nem na raiz. Conferido no payload cru. Aquele zero
 * teria virado "nada vazando" se eu não tivesse impresso os não-classificados.
 * (A ferramenta oficial acerta porque pega a adesão na API da Hotmart.)
 *
 * Aqui a data sai do NOSSO banco: o início do trial é o evento de compra
 * com `recurrence_number = 1` e `price.value = 0`.
 *
 * Critério de PAGOU = filtro FORTE do `pagou_de_verdade.cjs` / churn de 18/08:
 *   event_type ∈ {PURCHASE_APPROVED, PURCHASE_COMPLETE}
 *   E price.value > 0
 *   E purchase.status ∈ {APPROVED, COMPLETE, COMPLETED}
 * OVERDUE/DELAYED não é pagamento (armadilha 1, custou 1.356.554 cr em 18/08).
 */
const { supa } = require("./_comum.cjs");

const D = 86400000;
const TIPO_PAGO = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
const STATUS_PAGO = new Set(["APPROVED", "COMPLETE", "COMPLETED"]);
const PRODUTO = "7851642";

(async () => {
  const db = supa();

  // ---- todos os eventos de compra e de cancelamento ----
  const evs = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("payment_events")
      .select("event_type,received_at,payload")
      .range(de, de + 999);
    if (error) throw new Error(`payment_events: ${error.message}`);
    evs.push(...data);
    if (data.length < 1000) break;
  }
  console.log(`eventos lidos: ${evs.length} (controle: a consulta respondeu)`);

  const porPessoa = new Map(); // email -> { trialIni, pagou, cancelou }
  for (const e of evs) {
    const d = e.payload?.data ?? {};
    const pid = String(d.product?.id ?? "");
    if (pid && pid !== PRODUTO) continue;
    const email = String(d.subscriber?.email ?? d.buyer?.email ?? "").toLowerCase().trim();
    if (!email) continue;
    const p = porPessoa.get(email) ?? { email, trialIni: null, pagou: false, cancelou: null };

    if (e.event_type === "SUBSCRIPTION_CANCELLATION") {
      const q = d.cancellation_date ?? Date.parse(e.received_at);
      if (!p.cancelou || q > p.cancelou) p.cancelou = q;
    }
    const pu = d.purchase;
    if (pu) {
      const valor = pu.price?.value ?? 0;
      const rec = pu.recurrence_number ?? pu.recurrency_number ?? null;
      const quando = pu.approved_date ?? pu.order_date ?? Date.parse(e.received_at);
      if (TIPO_PAGO.has(e.event_type) && valor > 0 && STATUS_PAGO.has(pu.status)) p.pagou = true;
      if (TIPO_PAGO.has(e.event_type) && rec === 1 && valor === 0) {
        if (!p.trialIni || quando < p.trialIni) p.trialIni = quando;
      }
    }
    porPessoa.set(email, p);
  }

  const comTrial = [...porPessoa.values()].filter((p) => p.trialIni);
  const cancelados = [...porPessoa.values()].filter((p) => p.cancelou);
  console.log(`pessoas com inicio de trial identificado: ${comTrial.length}`);
  console.log(`pessoas com cancelamento: ${cancelados.length}`);
  console.log(`destas, PAGARAM de verdade (filtro FORTE): ${[...porPessoa.values()].filter((p) => p.pagou).length}`);

  // ---- allowlist da equipe: nunca entra em conta de vazamento ----
  const { data: eq } = await db.from("profiles").select("email").eq("bypasses_billing", true);
  const equipe = new Set((eq || []).map((r) => String(r.email).toLowerCase()));
  console.log(`allowlist da equipe (bypasses_billing): ${equipe.size}`);

  const { data: marcas } = await db.from("trial_credit_expirations").select("email,outcome");
  const marcaDe = new Map((marcas || []).map((m) => [String(m.email).toLowerCase(), m.outcome]));

  // ---- quem cancelou, nunca pagou, e ainda tem credito de mensalidade ----
  const linhas = [];
  for (const p of cancelados) {
    if (p.pagou) continue;                       // assinante: regra 9 manda MANTER
    if (equipe.has(p.email)) continue;
    if (marcaDe.get(p.email) === "paid") continue;
    const { data: perfil } = await db.from("profiles")
      .select("credits_subscription").ilike("email", p.email).maybeSingle();
    if (!perfil || !(perfil.credits_subscription > 0)) continue;
    if (!p.trialIni) { linhas.push({ email: p.email, cr: perfil.credits_subscription, dia10: null }); continue; }
    const dia10 = p.trialIni + 10 * D;
    linhas.push({
      email: p.email,
      cr: perfil.credits_subscription,
      adesao: new Date(p.trialIni).toISOString().slice(0, 10),
      dia10: new Date(dia10).toISOString().slice(0, 10),
      venceu: dia10 < Date.now(),
      cancelou: new Date(p.cancelou).toISOString().slice(0, 10),
    });
  }

  const soma = (a) => a.reduce((s, l) => s + l.cr, 0);
  const venceu = linhas.filter((l) => l.venceu === true);
  const prazo = linhas.filter((l) => l.venceu === false);
  const semData = linhas.filter((l) => l.dia10 === null);

  console.log(`\n=== JA VENCEU (passou do dia 10, credito ainda la): ${venceu.length} pessoas, ${soma(venceu)} cr ===`);
  for (const l of venceu.sort((a, b) => a.dia10.localeCompare(b.dia10)))
    console.log(`   dia10 ${l.dia10}  ${String(l.cr).padStart(7)} cr  ${l.email}  (adesao ${l.adesao}, cancelou ${l.cancelou})`);

  console.log(`\n=== AINDA NO PRAZO (mas nao existe maquina pra cumprir o prazo): ${prazo.length} pessoas, ${soma(prazo)} cr ===`);
  for (const l of prazo.sort((a, b) => a.dia10.localeCompare(b.dia10)))
    console.log(`   dia10 ${l.dia10}  ${String(l.cr).padStart(7)} cr  ${l.email}  (adesao ${l.adesao}, cancelou ${l.cancelou})`);

  if (semData.length) {
    console.log(`\n=== SEM INICIO DE TRIAL no nosso banco (nao classificado): ${semData.length}, ${soma(semData)} cr ===`);
    for (const l of semData) console.log(`   ${l.email} ${l.cr} cr`);
  }
  console.log(`\nTOTAL parado por causa da varredura desligada: ${linhas.length} pessoas, ${soma(linhas)} cr`);
})();
