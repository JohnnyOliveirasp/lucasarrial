#!/usr/bin/env node
/**
 * TAXA-BASE DO ECO DA REFERÊNCIA — o sinal que casa PALAVRA POR PALAVRA com a
 * queixa do `#530` e que ninguém tinha medido.
 *
 * ── O ACHADO QUE MOTIVOU ESTE INSTRUMENTO (ronda de 26/09, ~14h40Z) ─────────
 * Duas rondas trataram o `#530` (dnoronhajr@gmail.com) pelo `intrusion_flagged`
 * (18/18, 18/18, 26/27). Ao imprimir o `qa` CRU das três gerações apareceu um
 * SEGUNDO sinal, no mesmo objeto, que nenhuma nota do cartão menciona:
 *
 *     echo_flagged / echo_checked  =  16/18 · 16/18 · 26/27
 *
 * E o `echo` é, pela definição do próprio código (`tts_qa/metrics.py:127`,
 * `echo_leak_count`), "o continuation do VoxCPM vaza frases da REFERÊNCIA no
 * meio/fim dos chunks". Ou seja: texto que o aluno NÃO pediu, vindo da gravação
 * de referência dele, entrando no áudio entregue.
 *
 * As palavras do aluno, hoje 14:07Z: *"o audio ainda está com repetição,
 * repetindo sempre o começo do parágrafo do áudio anterior."* Repetição de algo
 * que ele não pediu, sempre no mesmo lugar, é literalmente o que `echo_leak`
 * conta. `intrusion` (palavra A MAIS ou TROCADA) é o sinal mais largo; `echo` é
 * o específico da queixa.
 *
 * ── POR QUE MEDIR A TAXA-BASE ANTES DE CHAMAR DE DEFEITO ──────────────────
 * 16 de 18 só é grave se 16/18 for ANORMAL. Se a frota inteira vaza eco nessa
 * proporção, o número não distingue este aluno de ninguém e não sustenta
 * conclusão — foi assim que a leitura de 23/09 ("alunos diferentes, não é
 * surto") se sustentou por três dias e depois caiu. Este script mede a
 * população comparável e diz onde o aluno cai DENTRO dela.
 *
 * Ele NÃO decide nada e NÃO escreve no banco.
 *
 * ARMADILHAS RESPEITADAS:
 *   - PAGINA (páginas de 500) e MORRE se o total lido não bater com o `count`
 *     exato: a consulta ao Supabase corta em 1000 linhas, e foi assim que o
 *     `aluno_em_silencio.cjs` acusou 27 alunos falsos nesta mesma manhã;
 *   - população comparável declarada: só `ready` com `echo_checked > 0`;
 *   - reporta `echo_checked` junto da fração — fração alta com 3 pedaços é
 *     ruído, e foi o erro de método que a própria ronda registrou hoje ao usar
 *     "100% sinalizado" como definição de defeito;
 *   - imprime o denominador e a janela, pra ninguém comparar números de
 *     janelas diferentes.
 *
 * USO: node _frank/ferramentas/2026-09-26_eco_da_referencia_taxa_base.cjs [dias]
 */
const { supa } = require("./_comum.cjs");

const DIAS = Number(process.argv[2] || 14);
const ALUNO_DO_CASO = "a98f8173-c02b-423e-b1ff-745443c4c28f"; // #530

(async () => {
  const db = supa();
  const { data: agora } = await db.rpc("now").select?.() ?? {};
  const desde = new Date(Date.now() - DIAS * 86400000).toISOString();

  // count EXATO primeiro — é contra ele que a paginação é conferida.
  const { count, error: ec } = await db
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("status", "ready")
    .gte("created_at", desde);
  if (ec) { console.error("ERRO count:", ec.message); process.exit(1); }

  const PAG = 500;
  const linhas = [];
  for (let de = 0; de < count; de += PAG) {
    const { data, error } = await db
      .from("generations")
      .select("id,user_id,created_at,qa")
      .eq("status", "ready")
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .range(de, de + PAG - 1);
    if (error) { console.error("ERRO página", de, error.message); process.exit(1); }
    linhas.push(...data);
  }
  if (linhas.length !== count) {
    console.error(`LI ${linhas.length} de ${count} — paginação furou. PARE (zero de instrumento cego não é zero medido).`);
    process.exit(1);
  }
  console.log(`população: generations status=ready desde ${desde} (${DIAS}d)`);
  console.log(`lidas: ${linhas.length}/${count} (paginado, conferido)\n`);

  const comEco = linhas
    .map((g) => {
      const qa = g.qa ?? {};
      const ch = qa.echo_checked ?? 0;
      const fl = qa.echo_flagged ?? 0;
      if (!(ch > 0)) return null;
      return { id: g.id, user_id: g.user_id, created_at: g.created_at, ch, fl, frac: fl / ch,
               intr_ch: qa.intrusion_checked ?? 0, intr_fl: qa.intrusion_flagged ?? 0 };
    })
    .filter(Boolean);

  console.log(`com echo_checked > 0: ${comEco.length} gerações · ${new Set(comEco.map((x) => x.user_id)).size} alunos distintos`);
  if (!comEco.length) { console.log("nada a medir."); return; }

  const soma = comEco.reduce((a, x) => a + x.frac, 0);
  console.log(`fração média de eco na frota: ${(soma / comEco.length).toFixed(4)}`);

  const faixas = [
    ["0 (limpo)", (x) => x.frac === 0],
    ["> 0 e < 0,5", (x) => x.frac > 0 && x.frac < 0.5],
    ["0,5 a 0,79", (x) => x.frac >= 0.5 && x.frac < 0.8],
    ["0,8 a 0,99", (x) => x.frac >= 0.8 && x.frac < 1],
    ["1,0 (todos)", (x) => x.frac === 1],
  ];
  console.log("\ndistribuição da fração de eco:");
  for (const [rot, f] of faixas) {
    const n = comEco.filter(f).length;
    console.log(`  ${rot.padEnd(12)} ${String(n).padStart(4)}  (${((100 * n) / comEco.length).toFixed(1)}%)`);
  }

  // Os severos: fração alta COM muitos pedaços (a régua que a ronda aprendeu
  // hoje — fração alta com 3 pedaços é ruído).
  const severos = comEco.filter((x) => x.frac >= 0.8 && x.ch >= 5).sort((a, b) => b.frac - a.frac || b.ch - a.ch);
  console.log(`\nSEVEROS (fração >= 0,8 E echo_checked >= 5): ${severos.length} gerações · ${new Set(severos.map((x) => x.user_id)).size} alunos`);
  const emails = new Map();
  if (severos.length) {
    const ids = [...new Set(severos.map((x) => x.user_id))];
    const { data: ps } = await db.from("profiles").select("id,email").in("id", ids);
    for (const p of ps ?? []) emails.set(p.id, p.email);
  }
  for (const x of severos) {
    const marca = x.user_id === ALUNO_DO_CASO ? "  <<< #530" : "";
    console.log(`  ${x.id.slice(0, 8)} ${x.created_at.slice(0, 16)} eco ${x.fl}/${x.ch} = ${x.frac.toFixed(3)} · intrusão ${x.intr_fl}/${x.intr_ch} · ${emails.get(x.user_id) ?? x.user_id.slice(0, 8)}${marca}`);
  }

  // Onde o aluno do caso cai dentro da própria população.
  const dele = comEco.filter((x) => x.user_id === ALUNO_DO_CASO).sort((a, b) => a.created_at.localeCompare(b.created_at));
  console.log(`\nO ALUNO DO #530 (${ALUNO_DO_CASO.slice(0, 8)}): ${dele.length} geração(ões) na janela`);
  for (const x of dele) {
    const piores = comEco.filter((y) => y.frac > x.frac).length;
    console.log(`  ${x.id.slice(0, 8)} ${x.created_at.slice(0, 16)} eco ${x.fl}/${x.ch} = ${x.frac.toFixed(3)} · intrusão ${x.intr_fl}/${x.intr_ch} · gerações com eco PIOR que esta na frota: ${piores}`);
  }

  console.log("\n⚠️  O QUE ESTE NÚMERO NÃO DIZ: eco alto é telemetria de que texto da");
  console.log("    REFERÊNCIA vazou na transcrição, não prova de que o áudio ficou");
  console.log("    inaudível. E `echo_leak_count` devolve None (inconclusivo) quando a");
  console.log("    ref e o texto não têm bigrama distinto — esses caem em `echo_none` e");
  console.log("    NÃO entram como limpos aqui.");
})();
