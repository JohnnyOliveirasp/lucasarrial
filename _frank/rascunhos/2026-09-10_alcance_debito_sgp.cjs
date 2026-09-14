/**
 * Alcance do débito do onboarding do SGP (card do Frank, 10/09).
 *
 * Pergunta 3 do card: quantos casos ANTIGOS existem além dos 12 com saldo
 * negativo AGORA — ou seja, quem ficou negativo pelo onboarding e depois teve
 * o saldo restaurado (por assinatura ou pelo perdão de 30/08), sumindo de
 * qualquer varredura por saldo negativo.
 *
 * SÓ LEITURA. Não escreve nada.
 */
const { supa } = require("../ferramentas/_comum.cjs");

async function paginar(q) {
  const PAG = 1000;
  let de = 0;
  const tudo = [];
  for (;;) {
    const { data, error } = await q(de, de + PAG - 1);
    if (error) throw new Error(error.message);
    tudo.push(...(data || []));
    if (!data || data.length < PAG) break;
    de += PAG;
  }
  return tudo;
}

(async () => {
  const db = supa();

  // 1. TODOS os débitos do onboarding (treino + avatar), paginado até o fim.
  const debitos = await paginar((a, b) =>
    db
      .from("credit_transactions")
      .select("user_id, kind, amount, ref_type, note, created_at")
      .lt("amount", 0)
      .ilike("note", "%onboarding%")
      .order("created_at", { ascending: true })
      .range(a, b),
  );
  console.log(`débitos de onboarding no extrato: ${debitos.length}`);
  if (debitos.length) {
    console.log(`  janela: ${debitos[0].created_at} .. ${debitos[debitos.length - 1].created_at}`);
  }

  // 2. Quem veio do SGP: tem linha em sgp_pedidos.
  const pedidos = await paginar((a, b) =>
    db.from("sgp_pedidos").select("user_id, status, criado_em, voice_id").range(a, b),
  );
  const sgpUsers = new Set(pedidos.map((p) => p.user_id).filter(Boolean));
  console.log(`pedidos SGP: ${pedidos.length} (user_id distintos: ${sgpUsers.size})`);

  // 3. Agrega por usuário.
  const porUser = new Map();
  for (const d of debitos) {
    const u = porUser.get(d.user_id) || { total: 0, n: 0, primeiro: d.created_at };
    u.total += d.amount;
    u.n += 1;
    porUser.set(d.user_id, u);
  }
  console.log(`usuários com débito de onboarding: ${porUser.size}`);

  // 4. Saldo atual + perdão, para cada um.
  const ids = [...porUser.keys()];
  const perfis = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("profiles")
      .select("id, email, credits_subscription, credits_extra, plan, access_until, access_source")
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    perfis.push(...(data || []));
  }
  const perfilDe = new Map(perfis.map((p) => [p.id, p]));

  const perdoados = await paginar((a, b) =>
    db
      .from("credit_transactions")
      .select("user_id, amount, created_at")
      .eq("ref_type", "perdao_negativo_onboarding")
      .range(a, b),
  );
  const perdoadoDe = new Map();
  for (const p of perdoados) {
    const cur = perdoadoDe.get(p.user_id) || { total: 0, quando: p.created_at };
    cur.total += p.amount;
    perdoadoDe.set(p.user_id, cur);
  }

  // 5. Classifica.
  const cls = { sgp_negativo_agora: [], sgp_restaurado: [], sgp_ok: [], planilha: [] };
  for (const [uid, u] of porUser) {
    const p = perfilDe.get(uid);
    const ehSgp = sgpUsers.has(uid);
    const extra = p?.credits_extra ?? 0;
    const perdao = perdoadoDe.get(uid);
    const reg = {
      email: p?.email, uid, debitado: u.total, extra,
      sub: p?.credits_subscription ?? 0, plan: p?.plan,
      access: p?.access_until || p?.access_source || null,
      perdao: perdao ? perdao.total : 0, quandoPerdao: perdao?.quando || null,
      primeiroDebito: u.primeiro,
    };
    if (!ehSgp) cls.planilha.push(reg);
    else if (extra < 0) cls.sgp_negativo_agora.push(reg);
    else if (perdao || extra >= 0) cls.sgp_restaurado.push(reg);
    else cls.sgp_ok.push(reg);
  }

  console.log("\n=== CLASSIFICAÇÃO ===");
  console.log(`SGP, negativo AGORA .......... ${cls.sgp_negativo_agora.length}`);
  console.log(`SGP, não está negativo agora .. ${cls.sgp_restaurado.length}`);
  console.log(`planilha (fora do card) ....... ${cls.planilha.length}`);

  const soma = (l) => l.reduce((s, r) => s + r.debitado, 0);
  console.log(`\nsoma debitada SGP negativo agora: ${soma(cls.sgp_negativo_agora)}`);
  console.log(`soma debitada SGP já restaurado : ${soma(cls.sgp_restaurado)}`);

  console.log("\n--- SGP negativo agora ---");
  for (const r of cls.sgp_negativo_agora.sort((a, b) => a.extra - b.extra)) {
    console.log(`${r.email}  extra=${r.extra} sub=${r.sub} plan=${r.plan} access=${r.access} debitado=${r.debitado}`);
  }

  console.log("\n--- SGP que JÁ ESTEVE negativo e não está mais (os 'invisíveis') ---");
  for (const r of cls.sgp_restaurado) {
    console.log(
      `${r.email}  extra=${r.extra} sub=${r.sub} plan=${r.plan} access=${r.access} ` +
        `debitado=${r.debitado} perdao=${r.perdao} (${r.quandoPerdao || "sem perdão registrado"}) 1ºdeb=${r.primeiroDebito}`,
    );
  }
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
