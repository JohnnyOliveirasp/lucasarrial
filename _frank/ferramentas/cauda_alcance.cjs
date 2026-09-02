#!/usr/bin/env node
/**
 * cauda_alcance.cjs — lê o JSONL do `cauda_decepada.cjs --varrer` e responde
 * QUANTOS ALUNOS e QUANTAS GERAÇÕES têm palavra decapitada, separando o que é
 * defeito de verdade do que é artefato da régua.
 *
 * POR QUE É UM SCRIPT SEPARADO. A varredura leva ~20min e baixa ~2GB. A
 * classificação mudou 2 vezes durante a análise (achei uma classe de falso
 * positivo depois de varrer). Guardar as FEATURES e reclassificar aqui custa
 * segundos; refazer a varredura a cada ideia nova custa 20min e sacaneia o R2.
 *
 * DUAS SEPARAÇÕES QUE MUDAM O NÚMERO, ambas descobertas medindo (02/09):
 *
 * 1) AMOSTRA DE VOZ não é geração de aluno. `text_normalized` vazio, sem
 *    telemetria de QA, duração fixa (5,92s repetida em vozes diferentes foi o
 *    que denunciou). Elas não passam pelo laço de QA da inferência, então
 *    contá-las como "aluno lesado" infla o alcance com coisa que nenhum aluno
 *    recebeu. Ficam FORA do número principal e reportadas à parte.
 *
 * 2) FRONTEIRA INTERNA x FIM DO ARQUIVO. São defeitos com donos diferentes:
 *      • interna  → silêncio no MEIO do áudio. É o caso Katia. Aqui o QA de
 *                   fim abrupto comprovadamente NUNCA olha (tail_checked=1
 *                   contra coverage_checked=8 na 1498fbe5, medido em prod).
 *      • fim      → o arquivo acaba com a voz alta. O QA do último chunk JÁ
 *                   cobre isso desde 26/08, e o fim do mp3 sofre padding do
 *                   encoder. Sinal mais fraco: reportado separado, não somado.
 *    O número que sustenta o conserto é o das INTERNAS.
 *
 * Uso: node _frank/ferramentas/cauda_alcance.cjs [--rel 35] [--plato -40]
 */
const path = require("node:path");
const fs = require("node:fs");
const c = require(path.join(__dirname, "_comum.cjs"));
require(path.join(c.RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(c.RAIZ, "frontend", ".env.local"),
});

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const REL = parseInt(arg("--rel", "35"), 10);
const PLATO = parseFloat(arg("--plato", "-40"));
const JSONL = path.join(__dirname, "..", "prova", "cauda_decepada.jsonl");

const suspeita = (f) => f.release_ms !== null && f.release_ms <= REL && f.plato_db > PLATO;
/** fim do arquivo = fronteira sem silêncio depois, ou colada na duração. */
const ehFim = (f, dur) => f.sil_s === 0 || (dur && Math.abs(f.t - dur) < 0.6);

(async () => {
  if (!fs.existsSync(JSONL)) { console.log("sem JSONL — rode --varrer antes"); return; }
  const regs = fs.readFileSync(JSONL, "utf8").split("\n").filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const medidos = regs.filter((r) => r.fronteiras);
  const erros = regs.filter((r) => r.erro);

  // classifica cada geração pelas fronteiras suspeitas, por tipo
  const cand = medidos.map((r) => {
    const ruins = r.fronteiras.filter(suspeita);
    return {
      ...r,
      internas: ruins.filter((f) => !ehFim(f, r.dur)),
      fins: ruins.filter((f) => ehFim(f, r.dur)),
    };
  });
  const comAlgo = cand.filter((r) => r.internas.length || r.fins.length);

  // ── separa amostra de voz de geração de aluno (consulta o banco) ──────────
  const s = c.supa();
  const meta = new Map();
  const ids = comAlgo.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await s.from("generations")
      .select("id,text_normalized,qa,name").in("id", ids.slice(i, i + 200));
    if (error) throw new Error(`supabase: ${error.message}`);
    for (const g of data) meta.set(g.id, g);
  }
  const ehAmostra = (r) => {
    const g = meta.get(r.id);
    if (!g) return false;
    const semTexto = !g.text_normalized || !String(g.text_normalized).trim();
    const semQa = !g.qa || !Object.keys(g.qa).length;
    return semTexto && semQa;
  };

  const amostras = comAlgo.filter(ehAmostra);
  const reais = comAlgo.filter((r) => !ehAmostra(r));
  const internas = reais.filter((r) => r.internas.length);
  const soFim = reais.filter((r) => !r.internas.length && r.fins.length);

  const pc = (n, d) => `${(n / Math.max(1, d) * 100).toFixed(1)}%`;
  console.log(`\n══ ALCANCE DA PALAVRA DECAPITADA ══════════════════════════`);
  console.log(`base medida:     ${medidos.length} entregas (${erros.length} não mediram)`);
  console.log(`fronteiras:      ${medidos.reduce((a, r) => a + r.fronteiras.length, 0)}`);
  console.log(`régua:           release_ms <= ${REL} E plato_db > ${PLATO}`);

  console.log(`\n── O NÚMERO QUE VALE: corte no MEIO do áudio ──────────────`);
  console.log(`GERAÇÕES:  ${internas.length}  (${pc(internas.length, medidos.length)} das entregas medidas)`);
  console.log(`ALUNOS:    ${new Set(internas.map((r) => r.user_id)).size}`);
  console.log(`VOZES:     ${new Set(internas.map((r) => r.voice_id)).size}`);
  console.log(`fronteiras internas ruins: ${internas.reduce((a, r) => a + r.internas.length, 0)}`);

  console.log(`\n── sinal mais fraco: corte no FIM do arquivo ──────────────`);
  console.log(`(o QA do último chunk já cobre desde 26/08; o fim do mp3 tem padding do encoder)`);
  console.log(`GERAÇÕES só-fim: ${soFim.length}   ALUNOS: ${new Set(soFim.map((r) => r.user_id)).size}`);

  console.log(`\n── fora da conta: amostras de voz (texto vazio, sem QA) ───`);
  console.log(`${amostras.length} arquivos — não são geração de aluno, não passam pelo laço de QA`);

  console.log(`\n── sensibilidade do limiar (só INTERNAS) ──────────────────`);
  console.log(`o limiar foi calibrado em UM positivo conhecido; isto mostra o quanto ele aguenta`);
  for (const lim of [15, 25, 35, 45, 55]) {
    const n = medidos.filter((r) => r.fronteiras.some((f) =>
      f.release_ms !== null && f.release_ms <= lim && f.plato_db > PLATO && !ehFim(f, r.dur)))
      .filter((r) => !ehAmostra(r)).length;
    console.log(`   release <=${String(lim).padStart(3)}ms: ${String(n).padStart(4)} gerações  ${pc(n, medidos.length)}`);
  }

  console.log(`\n── piores casos internos (pra conferir de ouvido) ─────────`);
  for (const r of internas.sort((a, b) =>
    Math.min(...a.internas.map((f) => f.release_ms)) - Math.min(...b.internas.map((f) => f.release_ms))
    || a.internas[0].plato_db - b.internas[0].plato_db).slice(0, 20)) {
    const p = r.internas.sort((a, b) => a.plato_db - b.plato_db)[0];
    console.log(`   ${r.id.slice(0, 8)} ${String(r.created_at).slice(0, 10)} voz=${String(r.voice_id).slice(0, 8)}` +
      ` t=${String(p.t).padStart(7)}s release=${String(p.release_ms).padStart(3)}ms plato=${String(p.plato_db).padStart(6)}dB` +
      ` sil=${p.sil_s}s  (${r.internas.length}/${r.fronteiras.length} fronteiras ruins)`);
  }

  // reincidência por voz: se concentra numa voz, é a voz; se espalha, é o produto
  const porVoz = {};
  for (const r of internas) porVoz[r.voice_id] = (porVoz[r.voice_id] || 0) + 1;
  const top = Object.entries(porVoz).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`\n── concentração por voz (espalhado = defeito do produto) ──`);
  console.log(`   ${new Set(internas.map((r) => r.voice_id)).size} vozes atingidas; top: ` +
    top.map(([v, n]) => `${v.slice(0, 8)}=${n}`).join(" "));
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
