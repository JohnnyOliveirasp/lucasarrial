#!/usr/bin/env node
/**
 * pos_merge_nota_no_cartao.cjs — o PASSO POS-MERGE: PR mergeou, o cartao que
 * ele nomeia no titulo fica sabendo. (incidente 0398d161)
 *
 * O QUE ELE FAZ: le PRs MERGEADOS (gh), extrai do TITULO os cartoes nomeados
 * (regua de escrita do `_pr_cartao.cjs` — mais dura que a da medicao), e
 * ANEXA em cada cartao VIVO uma nota dizendo o que o PR fez e que alguem
 * precisa conferir se isso resolve. A nota e ORDEM DE VISITA.
 *
 * O QUE ELE NUNCA FAZ:
 *   - FECHAR cartao. Merge nao e cura (ha PR de telemetria e de guarda de
 *     teste — medidos em 24/09). Nenhum status e tocado, nunca.
 *   - Sobrescrever nota. A escrita vai pelo `anexarNota` do
 *     `_incidente_nota.cjs` (anexa no array jsonb e CONFERE a escrita) — o
 *     mesmo caminho do `anotar_incidente.cjs`. Concatenar string em cima do
 *     array ja destruiu 21 notas em 3 incidentes nesta casa.
 *   - Postar duas vezes. A nota carrega o marcador `[pos-merge PR #N]`; se o
 *     cartao ja tem nota com esse marcador, pula (idempotente: 2 rodadas = 1
 *     nota).
 *   - Postar na duvida. Auto-referencia, "#N" que e referencia a PR
 *     ("revert do PR #300"), fragmento hex sem letra, numero sem cartao VIVO
 *     correspondente: tudo morre calado. Falso positivo aqui e nota errada
 *     em cartao de aluno.
 *
 * ENSAIO POR PADRAO: sem `--confirmar` nada e gravado — imprime o que
 * postaria, cartao a cartao, com a nota inteira. Mesma doutrina do
 * `anotar_incidente.cjs` ("ENSAIO NAO E ENTREGA").
 *
 * USO:
 *   node _frank/ferramentas/pos_merge_nota_no_cartao.cjs [opcoes]
 *     --pr N        so este PR (o modo "acabei de mergear o #355")
 *     --limit N     quantos PRs mergeados recentes varrer (default 100)
 *     --confirmar   grava de verdade (sem isso: ensaio)
 *
 * Precisa do `gh` autenticado e do .env.local (via _comum.cjs).
 */
const { execFileSync } = require("node:child_process");
const { supa } = require("./_comum.cjs");
const { postarNotasPosMerge, STATUS_VIVO } = require("./_pr_cartao.cjs");

function arg(nome) {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const tem = (nome) => process.argv.includes(nome);

const CAMPOS_PR = "number,title,mergedAt,body,url";

function lerPrsMergeados({ pr, limit }) {
  if (pr) {
    const um = JSON.parse(
      execFileSync("gh", ["pr", "view", String(pr), "--json", CAMPOS_PR + ",state"], {
        maxBuffer: 1e9,
      }).toString(),
    );
    if (um.state !== "MERGED" || !um.mergedAt) {
      throw new Error(
        `PR #${pr} esta ${um.state}, nao MERGED — este passo so roda DEPOIS do merge. Nada a fazer.`,
      );
    }
    return [um];
  }
  return JSON.parse(
    execFileSync(
      "gh",
      ["pr", "list", "--state", "merged", "--limit", String(limit), "--json", CAMPOS_PR],
      { maxBuffer: 1e9 },
    ).toString(),
  );
}

(async () => {
  const pr = arg("--pr");
  const limit = Number(arg("--limit") || 100);
  const confirmar = tem("--confirmar");

  const prs = lerPrsMergeados({ pr, limit });
  console.log(`PRs mergeados lidos: ${prs.length}${pr ? ` (so o #${pr})` : ` (ultimos ${limit})`}`);

  const db = supa();
  // agent_notes vem junto de proposito: e nele que a idempotencia se decide.
  const { data: cartoes, error } = await db
    .from("incidents")
    .select("id,numero,status,title,agent_notes")
    .in("status", STATUS_VIVO);
  // Armadilha 1 da casa: consulta que erra volta VAZIA. Zero-de-quebrada e
  // indistinguivel de zero-de-verdade sem olhar o error.
  if (error) {
    console.error(`❌ CONSULTA FALHOU lendo incidents: ${JSON.stringify(error)}`);
    console.error("   Nao acredite em nenhum numero desta rodada.");
    process.exit(1);
  }
  if (!Array.isArray(cartoes)) {
    console.error("❌ incidents nao devolveu lista — abortando sem adivinhar.");
    process.exit(1);
  }
  console.log(`cartoes vivos (${STATUS_VIVO.join("/")}): ${cartoes.length}`);

  const { postadas, puladas, ensaio } = await postarNotasPosMerge(db, prs, cartoes, { confirmar });

  console.log("");
  console.log("=".repeat(70));
  console.log(
    `${ensaio ? "🔎 ENSAIO — nota(s) que SERIAM postadas" : "✅ nota(s) POSTADAS (escrita conferida)"}: ${postadas.length}`,
  );
  console.log("=".repeat(70));
  for (const p of postadas) {
    console.log(`\n  cartao #${p.numero} (${String(p.id).slice(0, 8)}) <- PR #${p.pr}`);
    console.log(`  nota: ${p.nota}`);
  }

  if (puladas.length) {
    console.log(`\n⏭  puladas (idempotencia — ja tem a nota do PR): ${puladas.length}`);
    for (const p of puladas) {
      console.log(`  cartao #${p.numero} (${String(p.id).slice(0, 8)}) · PR #${p.pr} · ${p.motivo}`);
    }
  }

  if (ensaio && postadas.length) {
    console.log("\n🔎 ENSAIO — NADA gravado. Repita com --confirmar para postar.");
  }
  if (!postadas.length && !puladas.length) {
    console.log("\nnenhum par (PR mergeado × cartao vivo nomeado no titulo) nesta janela.");
  }
})().catch((e) => {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
});
