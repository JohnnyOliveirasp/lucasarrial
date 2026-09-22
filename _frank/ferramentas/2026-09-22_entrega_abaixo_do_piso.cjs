/**
 * ENTREGA ABAIXO DO PISO DO QA — instrumento SO LEITURA (#226 / 702cc916).
 *
 * A pergunta parada na mesa do Johnny ha 21 dias e': "entrega abaixo do piso
 * de QA: manter / falhar / avisar?". Ate hoje ela foi discutida com CASOS.
 * Este instrumento responde com a CLASSE: de todo audio que a casa ENTREGOU e
 * COBROU, quanto saiu abaixo da propria regua?
 *
 * O QUE CONTA COMO "ABAIXO DO PISO" (tres eixos, medidos separados — nao somo
 * coisas diferentes num indice unico):
 *   A. `coverage_min_visto` = 0  -> um pedaco ENTREGUE nao e' o texto (audio
 *      alucinado dentro de uma entrega que o aluno recebeu);
 *   B. `coverage_medio` < `coverage_min` (a regua da propria geracao) -> a
 *      media dos pedacos entregues nao alcanca o piso;
 *   C. `faltantes_total` > 0 -> palavras do texto sumiram do audio entregue.
 *
 * DISCIPLINA (as armadilhas ja medidas desta casa):
 *   - SO `status='ready'`. O proprio docstring de `registrar_cobertura` e de
 *     `registrar_faltantes` avisa que os contadores so descrevem ENTREGA
 *     quando a geracao termina ready. Job que falhou nao entra.
 *   - DENOMINADOR SEMPRE IMPRESSO. "0 casos" so vale ao lado de "medi N".
 *   - `faltantes_total`=0 sem `faltantes_medido_n` NAO e' "audio integro", e'
 *     "nao mediu" — separo os dois, que e' o erro que os proprios docstrings
 *     dizem que ninguem pode cometer.
 *   - PAGINA de 1000 em 1000 (o Supabase corta em 1000 — armadilha de 20/08).
 *   - MORRE em qualquer `error`. Zero de consulta quebrada nao e' zero medido.
 *
 * CONTROLE POSITIVO EMBUTIDO: a geracao `1c761a52` (Diego, 22/09) e' o caso
 * conhecido — ready, cobrada, `coverage_min_visto`=0, `coverage_medio`=0,8376
 * contra piso 0,85, `faltantes_total`=18. Se a varredura NAO reencontrar ela,
 * o instrumento se declara quebrado e sai com erro, em vez de imprimir um
 * numero bonito. Instrumento que nao acha o caso conhecido nao mede nada.
 *
 * NAO grava linha, NAO gasta GPU, NAO gasta credito, NAO manda e-mail.
 * Uso: node 2026-09-22_entrega_abaixo_do_piso.cjs [--dias=30]
 */
const { supa } = require("./_comum.cjs");

const CONTROLE = "1c761a52";

(async () => {
  const dias = Number((process.argv.find(a => a.startsWith("--dias=")) || "--dias=30").split("=")[1]);
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const db = supa();

  // paginacao: o corte em 1000 ja produziu numero errado nesta casa
  let todas = [], page = 0;
  for (;;) {
    const { data, error } = await db.from("generations")
      .select("id,user_id,status,created_at,qa,duration_seconds")
      .eq("status", "ready").gte("created_at", desde)
      .order("created_at", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) { console.log(`ERRO na consulta (pagina ${page}): ${error.message}`); process.exit(1); }
    todas = todas.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  const comQa = todas.filter(g => g.qa && typeof g.qa === "object");
  const medidas = comQa.filter(g => Number(g.qa.coverage_medido_n || 0) > 0);

  const A = medidas.filter(g => g.qa.coverage_min_visto === 0);
  const B = medidas.filter(g => {
    const piso = Number(g.qa.coverage_min);
    const med = Number(g.qa.coverage_medio);
    return Number.isFinite(piso) && Number.isFinite(med) && med < piso;
  });
  const comFaltMedido = comQa.filter(g => Number(g.qa.faltantes_medido_n || 0) > 0);
  const C = comFaltMedido.filter(g => Number(g.qa.faltantes_total || 0) > 0);

  // CONTROLE POSITIVO: o caso conhecido tem que aparecer nos tres eixos
  const achouControle = {
    varrido: todas.some(g => g.id.startsWith(CONTROLE)),
    A: A.some(g => g.id.startsWith(CONTROLE)),
    B: B.some(g => g.id.startsWith(CONTROLE)),
    C: C.some(g => g.id.startsWith(CONTROLE)),
  };
  if (!achouControle.varrido || !achouControle.A || !achouControle.B || !achouControle.C) {
    console.log("⛔ CONTROLE POSITIVO FALHOU — o instrumento NAO reencontrou o caso conhecido");
    console.log(`   ${CONTROLE}: varrido=${achouControle.varrido} A=${achouControle.A} B=${achouControle.B} C=${achouControle.C}`);
    console.log("   Nao publico numero de varredura que nao acha o caso que eu sei que existe.");
    process.exit(1);
  }

  const pct = (n, d) => d ? `${((n / d) * 100).toFixed(2)}%` : "—";
  console.log(`controle positivo OK (${CONTROLE} reencontrado nos 3 eixos)\n`);
  console.log(`JANELA: ultimos ${dias} dias (desde ${desde.slice(0,10)})`);
  console.log(`ENTREGAS (status='ready'): ${todas.length}`);
  console.log(`  com bloco qa:                 ${comQa.length}`);
  console.log(`  com cobertura medida (denom): ${medidas.length}`);
  console.log(`  com faltantes medido (denom): ${comFaltMedido.length}`);
  console.log("");
  console.log("══ ENTREGUE ABAIXO DA PROPRIA REGUA ══");
  console.log(`  A. pedaco entregue com cobertura ZERO   : ${A.length} de ${medidas.length}  (${pct(A.length, medidas.length)})`);
  console.log(`  B. media dos pedacos ABAIXO do piso     : ${B.length} de ${medidas.length}  (${pct(B.length, medidas.length)})`);
  console.log(`  C. palavra do texto sumiu do audio      : ${C.length} de ${comFaltMedido.length}  (${pct(C.length, comFaltMedido.length)})`);

  const uniao = new Set([...A, ...B, ...C].map(g => g.id));
  console.log(`  UNIAO (pelo menos um dos tres)          : ${uniao.size} de ${medidas.length}  (${pct(uniao.size, medidas.length)})`);
  const alunos = new Set([...A, ...B, ...C].map(g => g.user_id));
  console.log(`  alunos distintos atingidos              : ${alunos.size}`);

  const somaFalt = C.reduce((s, g) => s + Number(g.qa.faltantes_total || 0), 0);
  console.log(`  palavras perdidas somadas (eixo C)      : ${somaFalt}`);

  console.log("\n══ OS 15 PIORES POR PALAVRA PERDIDA (entregues e cobrados) ══");
  const piores = [...C].sort((a, b) => Number(b.qa.faltantes_total) - Number(a.qa.faltantes_total)).slice(0, 15);
  for (const g of piores) {
    const q = g.qa;
    console.log(`  ${g.id.slice(0,8)} · ${String(g.created_at).slice(0,16)} · faltam ${String(q.faltantes_total).padStart(4)} (pior pedaco ${q.faltantes_pior_n}) · cov_min_visto=${q.coverage_min_visto} · cov_medio=${q.coverage_medio} (piso ${q.coverage_min}) · dur=${g.duration_seconds}s`);
    if (Array.isArray(q.faltantes_amostra) && q.faltantes_amostra.length)
      console.log(`      sumiram: ${q.faltantes_amostra.join(" ")}`);
  }

  console.log("\n" + "=".repeat(74));
  console.log(">>> PRO RELATORIO: estas sao ENTREGAS — audio que o aluno recebeu e");
  console.log("    que a casa COBROU, nao tentativa descartada nem job que falhou.");
  console.log("    O que isto NAO decide: se a regua esta certa. Decide o Johnny (#226).");
})();
