#!/usr/bin/env node
/**
 * 2026-09-26_snapshot_da_fila.cjs — grava a LISTA de ids por status, nao a contagem.
 *
 * ================================ POR QUE EXISTE ================================
 *
 * TRES rondas seguidas fecharam com "+1 aberto e -1 fixed sem explicacao" e as
 * tres concluiram a mesma coisa: "nao e reconstituivel sem um snapshot da lista".
 * A ronda das 12hZ de 26/09 escreveu isso com todas as letras e recomendou gravar
 * os IDS; a recomendacao atravessou duas rondas sem ser implementada e a ronda
 * das 14hZ encontrou o MESMO desvio de novo (fixed 337->336, open 19->20).
 *
 * Nao e falta de zelo de quem contou: a tabela `incidents` NAO TEM `updated_at`
 * (conferido no information_schema em 26/09 — 22 colunas, nenhuma delas), e dois
 * caminhos de codigo trocam status sem deixar rastro:
 *
 *   1. `reportar.ts:166,198,221` — ocorrencia nova num cartao `fixed`/`ignored`
 *      reabre pra `open` E chama `limparFechamento()`, que zera resolved_at,
 *      resolved_by e resolved_commit. NAO escreve nota em agent_notes.
 *      Consequencia exata: a consulta natural pra achar reabertura
 *      ("status aberto E resolved_at preenchido") devolve VAZIO por construcao.
 *      Eu rodei ela em 26/09 14hZ e deu `[]` — e `[]` ali nao e "nao houve
 *      reabertura", e "a evidencia foi apagada pelo proprio caminho".
 *   2. `incident_occurrences`, que seria o livro de ocorrencias, so e escrito por
 *      `ingest.ts:245` (falha de sistema). O caminho humano (chat/e-mail, via
 *      reportar.ts) nunca insere. Medido: 236 linhas no total, a ultima em
 *      2026-09-23 11:48:19Z, e ZERO linhas pro #530 — que tem occurrences=3.
 *
 * Ou seja: sem este arquivo, mudanca de status e INDETECTAVEL depois do fato.
 * O contador diz QUANTOS mudaram; so a lista diz QUAIS.
 *
 * ================================ COMO USAR ================================
 *
 *   node _frank/ferramentas/2026-09-26_snapshot_da_fila.cjs            # grava + diff
 *   node _frank/ferramentas/2026-09-26_snapshot_da_fila.cjs --so-diff  # nao grava
 *
 * O arquivo é _frank/prova/fila_snapshot.jsonl, uma linha por ronda, e vai pra
 * MAIN junto com o log da ronda. Ele é o instrumento; o log é a leitura dele.
 *
 * ================================ GUARDAS ================================
 *
 * - PAGINA. A consulta do Supabase corta em 1000 linhas em silencio e a fila ja
 *   tem 581 cartoes. O `aluno_em_silencio.cjs` acusou 27 alunos falsos em 26/09
 *   exatamente por nao paginar (eram 13). Aqui: le em paginas de 500 e MORRE se
 *   o total lido nao bater com o count exato. Zero de instrumento cego nao e
 *   zero medido.
 * - NAO ESCREVE NADA NO BANCO. E sensor puro (regra 14-A): le e grava arquivo.
 */
const fs = require("node:fs");
const path = require("node:path");
require(path.join(__dirname, "..", "..", "frontend", "node_modules", "dotenv")).config({
  path: path.join(__dirname, "..", "..", "frontend", ".env.local"),
});

const PROJECT = "yizerthyrgrajivlotcw";
const DESTINO = path.join(__dirname, "..", "prova", "fila_snapshot.jsonl");
const PAGINA = 500;

async function sql(query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente");
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 500)}`);
  return JSON.parse(txt);
}

(async () => {
  const soDiff = process.argv.includes("--so-diff");

  // 1) count EXATO primeiro — é ele que prova que a paginação leu tudo.
  const [{ n: esperado }] = await sql("select count(*)::int as n from incidents");

  // 2) lê paginado, ordem estável por numero.
  const linhas = [];
  for (let off = 0; off < esperado + PAGINA; off += PAGINA) {
    const p = await sql(
      `select numero, left(id::text,8) as id8, status from incidents order by numero limit ${PAGINA} offset ${off}`,
    );
    if (!p.length) break;
    linhas.push(...p);
  }
  if (linhas.length !== esperado) {
    console.error(
      `❌ ABORTADO: li ${linhas.length} cartoes e o count diz ${esperado}. ` +
        `Snapshot parcial e pior que nenhum — ele viraria "diff" mentiroso na proxima ronda.`,
    );
    process.exit(1);
  }

  const mapa = {};
  for (const l of linhas) mapa[String(l.numero)] = l.status;
  const porStatus = {};
  for (const s of Object.values(mapa)) porStatus[s] = (porStatus[s] ?? 0) + 1;

  console.log(`fila lida: ${linhas.length}/${esperado} cartoes (paginado, conferido)`);
  console.log(
    Object.entries(porStatus)
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `  ${n} ${s}`)
      .join("\n"),
  );

  // 3) diff contra o snapshot anterior, se existir.
  let anterior = null;
  if (fs.existsSync(DESTINO)) {
    const brutas = fs.readFileSync(DESTINO, "utf8").trim().split("\n").filter(Boolean);
    if (brutas.length) anterior = JSON.parse(brutas[brutas.length - 1]);
  }

  if (!anterior) {
    console.log("\n⚠️  PRIMEIRA RONDA COM SNAPSHOT: nao existe anterior, entao nao ha diff.");
    console.log("    A partir da proxima ronda, mudanca de status passa a ter NOME e nao so numero.");
  } else {
    const a = anterior.status;
    const mudou = [];
    const nasceu = [];
    const sumiu = [];
    for (const [num, st] of Object.entries(mapa)) {
      if (!(num in a)) nasceu.push({ num, st });
      else if (a[num] !== st) mudou.push({ num, de: a[num], para: st });
    }
    for (const num of Object.keys(a)) if (!(num in mapa)) sumiu.push({ num, de: a[num] });

    console.log(`\ndiff contra o snapshot de ${anterior.at} (${anterior.total} cartoes):`);
    console.log(`  MUDOU DE STATUS: ${mudou.length}`);
    for (const m of mudou) console.log(`    #${m.num}  ${m.de} -> ${m.para}`);
    console.log(`  NASCEU: ${nasceu.length}`);
    for (const n of nasceu) console.log(`    #${n.num}  nasceu em ${n.st}`);
    console.log(`  DESAPARECEU DA TABELA: ${sumiu.length}`);
    for (const s of sumiu) console.log(`    #${s.num}  estava em ${s.de}  <- CARTAO APAGADO, investigue`);
    if (!mudou.length && !nasceu.length && !sumiu.length)
      console.log("  (nada mudou — e agora isso e MEDIDO, nao suposto)");
  }

  if (soDiff) {
    console.log("\n--so-diff: nao gravei.");
    return;
  }
  // `at` vem do relogio do banco, nao do meu: o log da ronda e comparado com
  // timestamps do banco, e misturar dois relogios ja produziu leitura errada.
  const [{ agora }] = await sql("select now()::text as agora");
  fs.appendFileSync(
    DESTINO,
    JSON.stringify({ at: agora, total: linhas.length, por_status: porStatus, status: mapa }) + "\n",
  );
  console.log(`\n✔ snapshot gravado em _frank/prova/fila_snapshot.jsonl (at=${agora})`);
})().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
