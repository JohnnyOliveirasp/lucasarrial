#!/usr/bin/env node
/**
 * 2026-09-18_alucinacao_antes_depois.cjs — mede a cura do #52 (qa_coverage).
 *
 * POR QUE EXISTE: o #52 ficou 29,8 dias aberto com a frase herdada "24 de 29
 * tem OUTRA causa". O numero estava certo e a conclusao era enganosa: as 24
 * nao sao outra causa, sao a MESMA familia (CHUNK ALUCINADO) e ja estavam
 * curadas desde 27/08 — 30 dias antes de alguem medir. A frase mandou as
 * rondas seguintes cacar causa nova onde o conserto ja estava no ar.
 *
 * O QUE MEDE: taxa de falha qa_coverage ANTES x DEPOIS do commit 7d030db3
 * ("qa(#52): chunk alucinado para de repetir e o resgate ganha o nivel 2",
 * 27/08 18:13:58Z). Taxa, nao contagem: o volume de geracoes quase dobrou no
 * periodo e a contagem crua esconderia isso.
 *
 * ⚠️ ARMADILHA QUE ESTE SCRIPT NAO COMETE (loop.py:143-147): em job que FALHA,
 * `coverage_medido_n` / `coverage_min_visto` / `coverage_medio` descrevem so
 * os chunks registrados antes do job morrer — eles SO valem para
 * `status='ready'`. Quem responde na falha e `coverage_best`. Comparar
 * `coverage_flagged` com `coverage_medido_n` numa falha produz uma inversao
 * de 100% que parece defeito e e artefato do desenho. Foi a hipotese que eu
 * levantei e derrubei na ronda de 18/09 13hZ, e e o terceiro instrumento da
 * casa a tropecar na mesma suposicao.
 *
 * Só leitura. Nao gasta GPU, nao escreve nada.
 */
const { supa } = require("/mnt/Data/Projetos/PlatformLucasArrial/_frank/ferramentas/_comum.cjs");

// Instante do commit 7d030db3 (git: 2026-08-27 14:13:58 -0400).
const CORTE = "2026-08-27T18:13:58Z";
// Nascimento do #52; antes disso a classe nem existia como cartao.
const DESDE = "2026-08-19T00:00:00Z";

const ehQaCoverage = (g) =>
  g.status === "failed" && (g.error_message ?? "").toLowerCase().includes("qa_coverage");

(async () => {
  const db = supa();

  // Consulta ao Supabase corta em 1000 linhas: pagina (armadilha de 20/08).
  const todas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("generations")
      .select("id,created_at,status,error_message,qa")
      .gte("created_at", DESDE)
      .order("created_at")
      .range(de, de + 999);
    if (error) throw new Error("generations: " + error.message);
    todas.push(...data);
    if (data.length < 1000) break;
  }

  const antes = todas.filter((g) => g.created_at < CORTE);
  const depois = todas.filter((g) => g.created_at >= CORTE);
  const linha = (nome, pop) => {
    const f = pop.filter(ehQaCoverage);
    const pct = pop.length ? (100 * f.length) / pop.length : 0;
    console.log(
      `  ${nome.padEnd(26)} ${String(f.length).padStart(3)} falhas / ${String(pop.length).padStart(5)} geracoes = ${pct.toFixed(3)}%`
    );
    return { n: f.length, pop: pop.length, pct, falhas: f };
  };

  console.log(`CORTE = ${CORTE} (commit 7d030db3), populacao desde ${DESDE.slice(0, 10)}`);
  console.log(`geracoes varridas: ${todas.length}\n`);
  const a = linha("ANTES do 7d030db3", antes);
  const d = linha("DEPOIS do 7d030db3", depois);
  if (d.pct > 0) console.log(`\n  >>> reducao de ${(a.pct / d.pct).toFixed(1)}x na TAXA`);

  // As falhas que sobraram depois do conserto, com o campo que de fato responde.
  console.log(`\nFALHAS POSTERIORES AO CONSERTO (${d.falhas.length}) — leia coverage_best, nao coverage_min_visto:`);
  for (const g of d.falhas) {
    const q = g.qa ?? {};
    console.log(
      `  ${g.id.slice(0, 8)} ${g.created_at.slice(0, 16)} · coverage_best=${q.coverage_best ?? "—"}` +
        ` · alucinado=${q.coverage_alucinado ?? "—"} · resgate=${q.coverage_rescue ?? "—"}` +
        ` · resgate_falhou=${q.coverage_rescue_failed ?? "—"}` +
        ` · faltantes=${JSON.stringify(q.faltantes_amostra ?? null)}`
    );
  }

  // Por que as antigas nunca poderiam ter sido diagnosticadas pela telemetria.
  const comFaltantes = todas.filter((g) => g.qa && "faltantes_amostra" in g.qa);
  const primeira = comFaltantes.map((g) => g.created_at).sort()[0];
  console.log(
    `\nfaltantes_amostra (campo que NOMEIA as palavras perdidas) so existe desde ${primeira ?? "—"}.` +
      `\nDas falhas qa_coverage do #52, so ${todas.filter(ehQaCoverage).filter((g) => g.qa && "faltantes_amostra" in g.qa).length} de ${todas.filter(ehQaCoverage).length} tem esse campo — as outras nao eram diagnosticaveis por telemetria, so por texto.`
  );
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
