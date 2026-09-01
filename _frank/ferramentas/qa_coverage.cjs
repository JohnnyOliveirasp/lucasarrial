#!/usr/bin/env node
/**
 * Saude do QA de audio (qa_coverage) - FastCloner.
 *
 * POR QUE EXISTE: em 19-20/08 o portao de qualidade foi reescrito tres vezes em
 * dois dias e a medicao se perdeu - tabelei falhas de ANTES de uma correcao e
 * apresentei como estado atual. Este script mede sempre do mesmo jeito, com o
 * denominador na mao.
 *
 * USO:
 *   node _frank/ferramentas/qa_coverage.cjs [--desde 2026-08-19] [--corte auto|<ISO>]
 *
 *   --desde  primeiro dia a considerar (default: 3 dias atras)
 *   --corte  instante em que a regua nova entrou no ar. O DEFAULT e "auto": o
 *            script descobre sozinho, perguntando ao GitHub quando o job
 *            `deploy-runpod` TERMINOU no ultimo run verde.
 *
 * A JANELA E O ERRO MAIS FACIL DE COMETER AQUI, e eu ja cometi:
 *   Em 20/08 usei 11:01Z como corte. 11:01 e a hora do PUSH. O worker so troca
 *   quando o job `deploy-runpod` termina de apontar o template e reciclar os
 *   workers - naquele run, 11:41:58Z. Quarenta minutos de geracoes que eu contei
 *   como "regua nova" eram da regua VELHA.
 *   REGRA: no runpod-worker vale a hora em que o deploy-runpod TERMINOU, NUNCA a
 *   do push nem a do inicio do build. Por isso o script pergunta sozinho - pra
 *   nao depender de eu lembrar.
 *
 * ARMADILHAS JA PAGAS, nao repita:
 *  - `generations` NAO tem user_email. As colunas sao: id, user_id, status,
 *    error_message, created_at, text_raw, elapsed_seconds.
 *  - `profiles` NAO tem full_name. Tem: id, email, display_name, access_until.
 *  - O PostgREST corta em 1000 linhas: pagina com .range().
 *  - Consulta que devolve zero pode ser consulta quebrada: o erro CRU e impresso.
 *  - Conta de admin/socio nao debita credito (bypassesBilling): fora da conta.
 */
const path = require("path");
const { execFileSync } = require("child_process");
const c = require(path.join(__dirname, "_comum.cjs"));
// A lista de verdade dos ref_type de estorno (chamado #113).
const { POR_FEATURE } = require(path.join(__dirname, "_estornos.cjs"));

/**
 * Descobre quando a regua que esta NO AR entrou no ar de verdade.
 * Fonte: o job `deploy-runpod` do ultimo run VERDE de runpod-worker.yml.
 * Devolve { corte, sha, run } ou null se nao der pra saber (e ai o script
 * avisa em vez de inventar uma janela).
 */
function descobrirCorte() {
  const gh = (args) =>
    execFileSync("gh", args, { cwd: __dirname, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    const runs = JSON.parse(
      gh(["run", "list", "--workflow=runpod-worker.yml", "--limit", "10",
          "--json", "databaseId,conclusion,headSha,createdAt"])
    );
    for (const r of runs) {
      if (r.conclusion !== "success") continue;
      const jobs = JSON.parse(
        gh(["api", `repos/{owner}/{repo}/actions/runs/${r.databaseId}/jobs`, "--jq", ".jobs"])
      );
      const dep = jobs.find((j) => j.name === "deploy-runpod");
      if (dep && dep.conclusion === "success" && dep.completed_at) {
        return { corte: dep.completed_at, sha: r.headSha.slice(0, 7), run: r.databaseId };
      }
    }
    return null;
  } catch (e) {
    console.log("AVISO: nao consegui perguntar ao GitHub quando o deploy terminou:", e.message);
    return null;
  }
}

// Contas que nao entram na conta: admin/socio nao debitam credito (bypassesBilling)
// e portanto nao sao indicador de nada.
const IGNORAR = new Set(["johnny.oliveirasp@gmail.com"]);

function arg(nome, padrao) {
  const i = process.argv.indexOf(nome);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : padrao;
}

async function paginar(cli, tabela, colunas, desde) {
  let todos = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await cli
      .from(tabela)
      .select(colunas)
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) {
      console.log(`ERRO CRU em ${tabela}:`, JSON.stringify(error));
      return null; // null != [] : falha de consulta nao e "nada encontrado"
    }
    todos = todos.concat(data || []);
    if (!data || data.length < 1000) return todos;
  }
}

function resume(linhas, rotulo) {
  const total = linhas.length;
  const falhas = linhas.filter((g) => (g.error_message || "").length > 0);
  const qacov = falhas.filter((g) => /qa_coverage/i.test(g.error_message || ""));
  const taxa = total ? ((falhas.length / total) * 100).toFixed(1) : "-";
  const confiavel = total >= 20;
  console.log(
    `${rotulo.padEnd(34)} | geracoes ${String(total).padStart(4)} | falhas ${String(
      falhas.length
    ).padStart(3)} | qa_coverage ${String(qacov.length).padStart(3)} | taxa ${taxa}%` +
      (confiavel ? "" : "   <-- n PEQUENO DEMAIS PRA CONCLUIR")
  );
  return { total, falhas, qacov, confiavel };
}

(async () => {
  const cli = typeof c.supa === "function" ? c.supa() : c.supa;
  const desde = arg("--desde", new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10));

  // Janela: por padrao o script DESCOBRE sozinho quando o deploy terminou.
  // Passar --corte na mao so pra investigar um run antigo.
  let corte = arg("--corte", "auto");
  if (corte === "auto") {
    const d = descobrirCorte();
    if (d) {
      corte = d.corte;
      console.log(`corte AUTOMATICO: deploy-runpod do sha ${d.sha} terminou em ${corte}`);
      console.log("(e o termino do deploy, NAO a hora do push - foi esse o erro de 20/08)\n");
    } else {
      corte = null;
      console.log("AVISO: sem corte. Nao afirme nada sobre 'antes x depois' da regua nova.\n");
    }
  }

  const gens = await paginar(
    cli,
    "generations",
    "id,user_id,status,error_message,created_at,text_raw,elapsed_seconds",
    desde + (desde.length === 10 ? "T00:00:00Z" : "")
  );
  if (gens === null) {
    console.log("\nA CONSULTA FALHOU. Nao conclua nada a partir disto.");
    process.exit(1);
  }

  // resolve e-mails pra poder excluir admin/socio
  const ids = [...new Set(gens.map((g) => g.user_id).filter(Boolean))];
  const emails = {};
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await cli
      .from("profiles")
      .select("id,email,display_name,access_until")
      .in("id", ids.slice(i, i + 200));
    if (error) console.log("ERRO CRU em profiles:", JSON.stringify(error));
    for (const p of data || []) emails[p.id] = p;
  }
  const deAluno = gens.filter((g) => !IGNORAR.has((emails[g.user_id] || {}).email));
  const ignoradas = gens.length - deAluno.length;

  console.log(`janela: desde ${desde}${corte ? ` | corte da regua nova: ${corte}` : ""}`);
  console.log(`geracoes lidas: ${gens.length} (${ignoradas} de admin/socio fora da conta)\n`);

  // por dia
  const dias = [...new Set(deAluno.map((g) => g.created_at.slice(0, 10)))].sort();
  for (const d of dias) resume(deAluno.filter((g) => g.created_at.slice(0, 10) === d), d);

  if (corte) {
    console.log("");
    resume(deAluno.filter((g) => g.created_at < corte), "ANTES da regua nova");
    const dep = resume(deAluno.filter((g) => g.created_at >= corte), "DEPOIS da regua nova");
    if (!dep.confiavel) {
      console.log(
        "\n>> Com menos de 20 geracoes depois do corte, NAO anuncie melhora nem piora."
      );
    }
  }

  const falhas = deAluno.filter((g) => (g.error_message || "").length > 0);
  if (falhas.length) {
    console.log("\n=== FALHAS, cruas (elapsed alto = hang, nao reprovacao do QA) ===");
    for (const g of falhas) {
      const p = emails[g.user_id] || {};
      console.log(
        `${g.created_at} | ${(p.email || g.user_id || "?").padEnd(32)} | ${String(
          (g.text_raw || "").length
        ).padStart(4)}ch | ${String(g.elapsed_seconds ?? "?").padStart(6)}s | ${(
          g.error_message || ""
        ).slice(0, 70)}`
      );
    }
    // ⚠️ Corrigido 23/08 (chamado #113): a instrução antiga mandava conferir
    // por ref_type='generation_refund', e era repetida a cada ronda. São NOVE
    // ref_type de estorno; esse é 9,4% deles, e o falso negativo daí paga o
    // aluno em dobro. Lista completa em _estornos.cjs.
    console.log("\nEstorno se confere por ref_type em credit_transactions, NUNCA por kind");
    console.log("(o estorno grava kind='extra_purchase'). São NOVE ref_type de estorno —");
    console.log(`para ÁUDIO é '${POR_FEATURE.audio}'; a lista completa está em _estornos.cjs.`);
    console.log("⚠️ 'estorno_de_engano' e 'estorno' NÃO terminam em _refund: filtrar");
    console.log("   por LIKE '%_refund' também deixa 17 linhas de fora.");
  } else {
    console.log("\nNenhuma falha de aluno na janela.");
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
