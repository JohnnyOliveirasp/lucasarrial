/**
 * RAIO-X DE UM ALUNO — a primeira coisa a rodar quando alguém reclama.
 * Só leitura. Mostra conta, compra, créditos, vozes, gerações e erros.
 *
 *   node _frank/ferramentas/aluno.cjs joao@exemplo.com
 */
const { supa, listar, BUCKETS, minutos } = require("./_comum.cjs");

const EMAIL = (process.argv[2] || "").trim().toLowerCase();
if (!EMAIL) {
  console.error("uso: node aluno.cjs <email>");
  process.exit(1);
}

(async () => {
  const db = supa();
  const { data: p } = await db
    .from("profiles")
    .select("id, email, display_name, access_until, credits_subscription, credits_extra, image_ref_key, created_at")
    .ilike("email", EMAIL)
    .maybeSingle();

  if (!p) {
    console.log(`❌ Nenhuma conta com ${EMAIL}.`);
    // Pode ser o caso "duas contas": procura por parte do e-mail e por compra.
    const raiz = EMAIL.split("@")[0].slice(0, 6);
    const { data: parecidos } = await db
      .from("profiles")
      .select("email, created_at")
      .ilike("email", `%${raiz}%`)
      .limit(5);
    if (parecidos?.length) {
      console.log("   Contas com e-mail parecido:", parecidos.map((x) => x.email).join(", "));
    }
    const { data: compras } = await db
      .from("entitlements")
      .select("buyer_email, status, created_at")
      .ilike("buyer_email", `%${raiz}%`)
      .limit(5);
    if (compras?.length) {
      console.log("   Compras com e-mail parecido:", JSON.stringify(compras));
    }
    console.log("   ➡️ Playbook G (aluno diz que pagou e não tem crédito).");
    return;
  }

  const saldo = (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
  const ativo = p.access_until && new Date(p.access_until) > new Date();
  console.log(`\n👤 ${p.display_name ?? "(sem nome)"} <${p.email}>`);
  console.log(`   id ${p.id} · conta desde ${p.created_at.slice(0, 10)}`);
  console.log(`   acesso: ${ativo ? `ATIVO até ${p.access_until.slice(0, 10)}` : "SEM ACESSO"}`);
  console.log(`   créditos: ${saldo.toLocaleString("pt-BR")}`);

  const { data: ents } = await db
    .from("entitlements")
    .select("status, access_until, created_at")
    .eq("user_id", p.id)
    .order("created_at", { ascending: false })
    .limit(3);
  console.log(`   compras: ${ents?.length ? ents.map((e) => `${e.created_at.slice(0, 10)} ${e.status}`).join(" · ") : "NENHUMA"}`);

  // Vozes — o coração do produto
  const { data: vs } = await db
    .from("voices")
    .select("id, name, status, duration_seconds, error_message, created_at")
    .eq("user_id", p.id)
    .order("created_at", { ascending: true });
  console.log(`\n🎙️  VOZES (${vs?.length ?? 0})`);
  for (const v of vs ?? []) {
    let extra = "";
    if (v.status === "uploading") {
      const arq = await listar(BUCKETS.vozes(), `${p.id}/${v.id}/`);
      extra = arq.length
        ? `  ← 🔧 ${arq.length} áudio(s) no R2: RESGATÁVEL (playbook A)`
        : "  ← sem áudio no R2 (envio não começou)";
    }
    console.log(
      `   ${v.created_at.slice(0, 16)} "${v.name}" [${v.status}] ${minutos(v.duration_seconds)}${extra}`,
    );
    if (v.error_message) console.log(`      erro: ${String(v.error_message).slice(0, 150)}`);
  }
  if (!vs?.length) console.log("   (nenhuma — o aluno ainda não tem voz)");

  const pronta = (vs ?? []).some((v) => v.status === "ready");
  if (ativo && saldo > 0 && !pronta) {
    console.log("\n   🚨 PAGANTE SEM VOZ PRONTA — é o sintoma que resume tudo. Investigue.");
  }

  // Produção recente
  for (const [tabela, rotulo] of [
    ["generations", "🔊 Áudios"],
    ["image_generations", "🖼️  Imagens"],
    ["video_clones", "🎬 Vídeos Clone"],
  ]) {
    const { data } = await db
      .from(tabela)
      .select("status, error_message, created_at")
      .eq("user_id", p.id)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!data?.length) continue;
    console.log(`\n${rotulo} (5 últimos)`);
    for (const g of data) {
      console.log(
        `   ${g.created_at.slice(0, 16)} [${g.status}]` +
          (g.error_message ? ` — ${String(g.error_message).slice(0, 110)}` : ""),
      );
    }
  }

  // Dinheiro
  const { data: tx } = await db
    .from("credit_transactions")
    .select("kind, amount, ref_type, note, created_at")
    .eq("user_id", p.id)
    .order("created_at", { ascending: false })
    .limit(8);
  console.log(`\n💳 CRÉDITOS (8 últimos)`);
  for (const t of tx ?? []) {
    console.log(
      `   ${t.created_at.slice(0, 16)} ${t.amount > 0 ? "+" : ""}${t.amount} ${t.kind} (${t.ref_type ?? "-"}) ${t.note ?? ""}`,
    );
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
