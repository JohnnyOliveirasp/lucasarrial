const { supa } = require("/home/johnny/Projects/lucasarrial/_frank/ferramentas/_comum.cjs");
const TRIALS = ["fariadelimaadvogados@gmail.com","adv.fernandesdejesus@gmail.com","matheuslealdamatta@gmail.com","abager@ecoestradas.org"];
(async () => {
  const db = supa();
  // CONTRAPROVA 1: a tabela responde
  const { count: nProf } = await db.from("profiles").select("id",{count:"exact",head:true});
  const { count: nTx } = await db.from("credit_transactions").select("id",{count:"exact",head:true});
  console.log(`contraprova: profiles=${nProf} credit_transactions=${nTx}\n`);

  console.log("### ORIGEM DO CREDITO dos 4 trials (armadilha Eliane 06/09: trial na Hotmart pode ter pago por Stripe)");
  for (const email of TRIALS) {
    const { data: p, error: pe } = await db.from("profiles").select("id,email,credits_subscription,credits_extra,access_until").ilike("email",email).maybeSingle();
    if (pe) { console.log(`${email}: ERRO ${pe.message}`); continue; }
    if (!p) { console.log(`${email}: SEM CONTA`); continue; }
    const { data: tx, error: te } = await db.from("credit_transactions")
      .select("kind,amount,ref_type,note,created_at").eq("user_id",p.id).order("created_at");
    if (te) { console.log(`${email}: ERRO tx ${te.message}`); continue; }
    const creditos = tx.filter(t=>t.amount>0);
    const tipos = [...new Set(creditos.map(t=>t.ref_type))];
    const suspeito = tipos.filter(t=>/stripe|extra_purchase|avulso/i.test(String(t)));
    console.log(`${email}`);
    console.log(`   saldo ${p.credits_subscription} mensalidade + ${p.credits_extra} extra | acesso ate ${p.access_until ?? "NULO"}`);
    console.log(`   ${creditos.length} credito(s), ref_type: ${tipos.join(", ") || "(nenhum)"}${suspeito.length ? "  <<< PAGOU POR FORA: "+suspeito.join(",") : "  -> trial puro"}`);
    for (const c of creditos) console.log(`      ${c.created_at.slice(0,16)} +${c.amount} ${c.ref_type}/${c.kind} — ${(c.note??"").slice(0,60)}`);
  }

  console.log("\n### breno.souza@expressouniao.com.br — procurar conta com OUTRO e-mail (armadilha #222)");
  const { data: porNome, error: ne } = await db.from("profiles")
    .select("email,display_name,access_until,credits_subscription,created_at").ilike("display_name","%breno%");
  console.log(ne ? `ERRO display_name: ${ne.message}` : `por nome 'breno': ${porNome.length} -> ${JSON.stringify(porNome)}`);
  const { data: porDom, error: de } = await db.from("profiles")
    .select("email,display_name,access_until,credits_subscription").ilike("email","%expressouniao%");
  console.log(de ? `ERRO email: ${de.message}` : `por dominio 'expressouniao': ${porDom.length} -> ${JSON.stringify(porDom)}`);
  // CONTRAPROVA 2: a busca por nome sabe achar gente
  const { data: prova } = await db.from("profiles").select("email").ilike("display_name","%a%").limit(5);
  console.log(`contraprova display_name ILIKE %a%: ${prova?.length ?? 0} (tem que ser > 0)`);
})();
