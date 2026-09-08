/**
 * Rodada 08/09 — armadilha da Eliane (06/09): "TRIAL na Hotmart" nao quer dizer
 * "nunca pagou nada". Ela era trial na assinatura e tinha comprado pacote
 * avulso pelo Stripe — dinheiro de verdade. A regra 9 olha a ORIGEM do credito,
 * nunca o saldo existir.
 *
 * Aqui se lista, para cada trial que cancelou em 07/09, TODOS os lancamentos
 * POSITIVOS de credito: se houver algum `extra_purchase`/`stripe_session`, a
 * pessoa pagou e nao pode ser tratada como "trial que saiu".
 * SOMENTE LEITURA.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const TRIALS = [
  "hytallon.957327001@gmail.com",
  "leandromedsouza@hotmail.com",
  "aroldogg@gmail.com",
  // viniciusjc1903@gmail.com nao tem conta — nao ha credito pra olhar
];

(async () => {
  const db = supa();
  for (const email of TRIALS) {
    console.log("=".repeat(70));
    const { data: p, error } = await db.from("profiles")
      .select("id,email,full_name,credits_subscription,credits_extra,access_until,created_at")
      .ilike("email", email).maybeSingle();
    if (error) { console.log(`${email} ERRO: ${error.message}`); continue; }
    if (!p) { console.log(`${email}: sem conta`); continue; }
    console.log(`${email} (${p.full_name})`);
    console.log(`  saldo hoje: mensalidade ${p.credits_subscription} | extra ${p.credits_extra} | acesso ate ${p.access_until?.slice(0, 10)}`);

    const { data: tx, error: e2 } = await db.from("credit_transactions")
      .select("created_at,kind,amount,ref_type,ref_id,note")
      .eq("user_id", p.id).gt("amount", 0)
      .order("created_at", { ascending: true });
    if (e2) { console.log(`  ERRO credit_transactions: ${e2.message}`); continue; }
    console.log(`  ${tx.length} lancamento(s) POSITIVO(s):`);
    for (const t of tx) {
      console.log(`    ${t.created_at?.slice(0, 16)} +${String(t.amount).padStart(7)} ${String(t.kind).padEnd(20)} ${t.ref_type ?? "-"} ${t.note ?? ""}`);
    }
    const pagou = tx.filter((t) => /extra_purchase|stripe/i.test(`${t.kind} ${t.ref_type}`));
    console.log(`  >>> ${pagou.length ? "ATENCAO: tem credito de COMPRA (pagou por fora) — nao e trial puro" : "so credito de trial/grant — nunca pagou"}`);
  }
})();
