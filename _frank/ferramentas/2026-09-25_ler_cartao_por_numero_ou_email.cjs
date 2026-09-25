#!/usr/bin/env node
/**
 * 2026-09-25_ler_cartao_por_numero_ou_email.cjs — leitor READ-ONLY de incidente
 * por `numero` (o "#580" que os outros instrumentos imprimem) ou por e-mail de
 * aluno.
 *
 * POR QUE EXISTE. O `2026-09-22_ler_cartao.cjs` casa SO por prefixo de UUID
 * (comentario dele: "id e uuid: nao aceita LIKE"). Mas os instrumentos da ronda
 * — `percepcao_travada.cjs`, `idade_incidentes.cjs` — imprimem o cartao como
 * `#<numero>`. Resultado medido em 25/09 19hZ: `ler_cartao 580` devolve
 * "nenhum cartao casa 580" para um cartao que EXISTE e que a varredura de
 * percepcao acabou de apontar. Dois instrumentos da mesma ronda falando
 * identificadores diferentes custa turno e convida a "medir de memoria".
 *
 * Uso:
 *   node 2026-09-25_ler_cartao_por_numero_ou_email.cjs 580 [--notas=N]
 *   node 2026-09-25_ler_cartao_por_numero_ou_email.cjs aluno@dominio.com
 *
 * Nao escreve nada. Todo `error` de consulta e conferido e aborta (a consulta
 * que devolve `{data:null,error:...}` em silencio ja fez esta casa reportar
 * "0 gerações" onde havia erro de coluna).
 */
const { supa } = require("./_comum.cjs");

(async () => {
  const args = process.argv.slice(2);
  const alvo = args.find((a) => !a.startsWith("--"));
  const nNotas = Number((args.find((a) => a.startsWith("--notas=")) || "--notas=6").split("=")[1]);
  if (!alvo) {
    console.log("uso: node 2026-09-25_ler_cartao_por_numero_ou_email.cjs <numero|email> [--notas=N]");
    process.exit(1);
  }

  const s = supa();
  const campos =
    "id,numero,status,signature,title,affected_emails,created_at,last_seen_at,occurrences,resolved_at,resolved_commit,resolution_note,agent_notes";

  let linhas = [];
  if (/^\d+$/.test(alvo)) {
    const { data, error } = await s.from("incidents").select(campos).eq("numero", Number(alvo));
    if (error) {
      console.error("ERRO na consulta por numero:", error.message || error);
      process.exit(2);
    }
    linhas = data || [];
  } else {
    // affected_emails e array; `contains` exige o valor exato do elemento.
    const { data, error } = await s.from("incidents").select(campos).contains("affected_emails", [alvo]);
    if (error) {
      console.error("ERRO na consulta por e-mail:", error.message || error);
      process.exit(2);
    }
    linhas = data || [];
    if (!linhas.length) {
      // fallback: e-mail citado no titulo/assinatura (cartao aberto sem o array preenchido)
      const { data: d2, error: e2 } = await s
        .from("incidents")
        .select(campos)
        .or(`title.ilike.%${alvo}%,signature.ilike.%${alvo}%`);
      if (e2) {
        console.error("ERRO no fallback por titulo/assinatura:", e2.message || e2);
        process.exit(2);
      }
      linhas = d2 || [];
      if (linhas.length) console.log(`(casou por titulo/assinatura, nao pelo array affected_emails)\n`);
    }
  }

  if (!linhas.length) {
    console.log(`nenhum cartao casa "${alvo}"`);
    process.exit(0);
  }

  linhas.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const dias = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;

  for (const i of linhas) {
    console.log("═".repeat(78));
    console.log(`#${i.numero} · ${i.id}`);
    console.log(`status=${i.status} · ${dias(i.created_at).toFixed(1)}d de vida · ${i.occurrences ?? "?"}x`);
    console.log(`criado   ${i.created_at}`);
    console.log(`ultimo   ${i.last_seen_at}`);
    console.log(`alunos   ${JSON.stringify(i.affected_emails)}`);
    console.log(`titulo   ${i.title}`);
    console.log(`assin.   ${i.signature}`);
    if (i.resolved_at) console.log(`RESOLVIDO ${i.resolved_at} · commit ${i.resolved_commit || "(nenhum)"}`);
    if (i.resolution_note) console.log(`\nresolution_note:\n${i.resolution_note}`);
    const notas = Array.isArray(i.agent_notes) ? i.agent_notes : [];
    console.log(`\nNOTAS: ${notas.length} (mostrando as ${Math.min(nNotas, notas.length)} ultimas)`);
    for (const n of notas.slice(-nNotas)) {
      console.log("─".repeat(78));
      console.log(`[${n.at || "?"}] por ${n.by || "?"}`);
      console.log(n.note || JSON.stringify(n));
    }
    console.log("");
  }
})();
