/**
 * #666a7685 — O reenvio automatico de "RunPod COMPLETED" CUROU em producao?
 *
 * O PR #331 entrou na main em 22:26:48Z e o deploy deu SUCCESS em 22:29:50Z.
 * O vigia das 22hZ mediu a classe ANTES disso e disse, com todas as letras,
 * que NAO tinha lido o diff e NAO afirmava que curava. Esta ferramenta mede
 * o depois.
 *
 * O que prova cura, e o que NAO prova:
 *   - NAO basta "parou de falhar": pouco trafego tambem para de falhar.
 *   - O que prova e `request_attempts >= 2` numa ocorrencia NOVA: significa
 *     que a string casou com TRANSITORIAS e o reenvio disparou. Antes do fix
 *     as 9 ocorrencias tinham request_attempts = 1 (ninguem reenviou; quem
 *     reclicou foi a aluna).
 *
 * Armadilhas respeitadas (ordem de 20/08):
 *   - estorno se confere por ref_type='generation_refund', NUNCA por kind
 *     (o estorno grava kind='extra_purchase').
 *   - consulta corta em 1000 linhas: pagina.
 *   - imprime o campo error CRU antes de acreditar em qualquer zero.
 */
const { supa } = require("./_comum.cjs");

const DEPLOY = "2026-09-17T22:29:50Z";   // deploy SUCCESS do PR #331
const PR_ABERTO = "2026-09-17T21:07:56Z";
const ALUNOS = ["roseni.pimentel@gmail.com", "semeadorriquezas@gmail.com"];

async function paginar(tabela, montar) {
  const PAG = 1000;
  let de = 0, tudo = [];
  for (;;) {
    const { data, error } = await montar(supa().from(tabela)).range(de, de + PAG - 1);
    if (error) { console.error(`ERRO CRU em ${tabela}:`, JSON.stringify(error)); process.exit(1); }
    tudo = tudo.concat(data || []);
    if (!data || data.length < PAG) break;
    de += PAG;
  }
  return tudo;
}

(async () => {
  const db = supa();

  // ---- 1. a classe inteira, tabela toda, sem filtro de data ----
  const todas = await paginar("generations", (q) =>
    q.select("id,user_id,status,error_message,request_attempts,created_at")
     .ilike("error_message", "%runpod completed%")
     .order("created_at", { ascending: true }));

  console.log(`\n=== "RunPod COMPLETED" na tabela INTEIRA: ${todas.length} ocorrencia(s) ===`);
  const depois = todas.filter((g) => g.created_at > DEPLOY);
  const antes = todas.filter((g) => g.created_at <= DEPLOY);
  console.log(`  antes do deploy (<= ${DEPLOY}): ${antes.length}`);
  console.log(`  DEPOIS do deploy: ${depois.length}`);

  for (const g of todas) {
    const marca = g.created_at > DEPLOY ? "DEPOIS" : "antes ";
    console.log(`  [${marca}] ${g.created_at} ${g.id.slice(0, 8)} status=${g.status} attempts=${g.request_attempts} err=${JSON.stringify(g.error_message)}`);
  }

  console.log(`\n>>> VEREDITO DE CURA:`);
  if (depois.length === 0) {
    console.log(`    INCONCLUSIVO — zero ocorrencias novas desde o deploy.`);
    console.log(`    Ausencia de falha NAO e prova de cura: pode ser so ausencia de trafego.`);
  } else {
    const reenviadas = depois.filter((g) => (g.request_attempts || 1) >= 2);
    console.log(`    ${reenviadas.length} de ${depois.length} ocorrencia(s) nova(s) GANHARAM reenvio (attempts>=2).`);
    console.log(reenviadas.length === depois.length
      ? `    O mecanismo esta pegando.`
      : `    ⚠️ ALGUMA ocorrencia nova NAO ganhou reenvio — investigar.`);
  }

  // ---- 2. os dois alunos: tem audio pronto DEPOIS do deploy? ----
  for (const email of ALUNOS) {
    const { data: perfis, error: e1 } = await db.from("profiles").select("id,email").eq("email", email);
    if (e1) { console.error("ERRO CRU perfis:", JSON.stringify(e1)); process.exit(1); }
    if (!perfis?.length) { console.log(`\n### ${email}: perfil NAO encontrado`); continue; }
    const uid = perfis[0].id;

    const ger = await paginar("generations", (q) =>
      q.select("id,status,error_message,request_attempts,created_at")
       .eq("user_id", uid).gte("created_at", "2026-09-17T18:00:00Z")
       .order("created_at", { ascending: true }));

    const prontas = ger.filter((g) => g.status === "ready");
    const falhas = ger.filter((g) => g.status === "failed");
    const ultimaPronta = prontas.length ? prontas[prontas.length - 1].created_at : "NENHUMA";
    console.log(`\n### ${email} (${uid.slice(0, 8)})`);
    console.log(`  geracoes desde 18hZ: ${ger.length} | ready: ${prontas.length} | failed: ${falhas.length}`);
    console.log(`  ultima ready: ${ultimaPronta}`);
    const prontasDepois = prontas.filter((g) => g.created_at > DEPLOY);
    console.log(`  ready DEPOIS do deploy: ${prontasDepois.length} ${prontasDepois.length ? "<-- conseguiu usar o produto" : "<-- AINDA sem entrega pos-fix"}`);
    for (const g of ger.slice(-12)) {
      console.log(`    ${g.created_at} ${g.id.slice(0, 8)} ${g.status.padEnd(7)} attempts=${g.request_attempts ?? "-"} err=${JSON.stringify(g.error_message)}`);
    }
  }

  // ---- 3. dinheiro: casar ref_id e somar o SINAL ----
  //
  // ⚠️ A tabela e `credit_transactions` (NAO existe `credit_ledger`).
  // ⚠️ Conferir so por ref_type='generation_refund' e FALSO NEGATIVO: o
  //    _estornos.cjs mediu que isso enxerga 9,4% dos estornos. O metodo que
  //    vale e casar o ref_id e somar o sinal: debito(-) + estorno(+) = 0 -> quitado.
  // ⚠️ Soma negativa NAO e divida automatica: se o objeto foi ENTREGUE
  //    (status ready), a cobranca e legitima. Debito orfao (row apagada) e
  //    documentado na ordem de 20/08 e NAO e detector de bug.
  const { ehEstorno } = require("./_estornos.cjs");
  const TAB = ["generations", "image_generations", "video_clones", "studio_scenes"];
  for (const email of ALUNOS) {
    const { data: p, error: ep } = await db.from("profiles")
      .select("id,credits_subscription,credits_extra").eq("email", email);
    if (ep) { console.error("ERRO CRU perfil:", JSON.stringify(ep)); process.exit(1); }
    if (!p?.length) continue;
    const { data: tx, error: et } = await db.from("credit_transactions")
      .select("amount,kind,ref_type,ref_id,created_at")
      .eq("user_id", p[0].id).gte("created_at", "2026-09-17T18:00:00Z");
    if (et) { console.error("ERRO CRU tx:", JSON.stringify(et)); process.exit(1); }
    const porRef = {};
    for (const t of tx) { if (t.ref_id) (porRef[t.ref_id] = porRef[t.ref_id] || []).push(t); }
    const negativos = Object.entries(porRef)
      .map(([k, v]) => [k, v.reduce((a, t) => a + Number(t.amount), 0), v])
      .filter(([, s]) => s < 0);
    console.log(`\n=== dinheiro de ${email} ===`);
    console.log(`  saldo = ${p[0].credits_subscription} + ${p[0].credits_extra}`);
    console.log(`  refs com soma negativa: ${negativos.length} (cada um checado contra o objeto)`);
    for (const [id, soma, linhas] of negativos) {
      let achado = null;
      for (const t of TAB) {
        const { data, error } = await db.from(t).select("id,status").eq("id", id);
        if (error) { console.error(`ERRO CRU ${t}:`, JSON.stringify(error)); process.exit(1); }
        if (data?.length) { achado = [t, data[0].status]; break; }
      }
      const temEstorno = linhas.some((t) => ehEstorno(t.ref_type));
      const veredito = !achado
        ? "row APAGADA (debito orfao — ordem 20/08: NAO e bug, nao estornar as cegas)"
        : achado[1] === "ready"
          ? `ENTREGUE (${achado[0]} ready) -> cobranca legitima, NAO devolver`
          : `*** ${achado[0]} status=${achado[1]} SEM entrega e SEM estorno -> INVESTIGAR ***`;
      console.log(`    ${id.slice(0, 8)} soma=${soma} estorno_por_ref_type=${temEstorno} -> ${veredito}`);
    }
  }
})();
