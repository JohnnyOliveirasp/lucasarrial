#!/usr/bin/env node
/**
 * ocorrencias_de_verdade.cjs — quantas ocorrencias um chamado teve DE VERDADE,
 * e quem foram as vitimas, inclusive as que somem do caminho natural de medir.
 *
 * POR QUE EXISTE (medido em 13/09, ronda das falhas, chamado #52 / 37bacb68):
 * o jeito obvio de medir um chamado de geracao e ir na tabela `generations`
 * filtrando status='failed' + a mensagem de erro. Esse caminho SUBCONTA EM
 * SILENCIO, e subconta justamente quem mais importa.
 *
 *   `incidents.occurrences` dizia 32.
 *   `generations` (failed + qa_coverage) devolvia 28.
 *
 * As 4 de diferenca nao eram contador inflado: eram ocorrencias cuja linha em
 * `generations` FOI APAGADA. O DELETE do historico pelo aluno leva a row junto
 * e deixa o `ref_id` pendurado em `incident_occurrences` — a mesma mecanica do
 * "debito orfao" ja fichada na ordem de 20/08.
 *
 * O ESTRAGO CONCRETO, e o motivo de isto virar ferramenta: naquela ronda a
 * medicao por `generations` concluiu "28 falhas, a ultima em 11/09" e com isso
 * teria PERDIDO a vitima mais recente — um aluno de 12/09 que era a unica ainda
 * sem atendimento, e que so apareceu porque a linha dele tinha sido apagada.
 * A ocorrencia MAIS NOVA de todas era invisivel pelo caminho natural. Quem
 * apaga o historico e, com frequencia, exatamente quem teve falha.
 *
 * A REGRA: para CONTAR ocorrencia ou ACHAR vitima, a fonte e
 * `incident_occurrences` — ela guarda `email` e `error` proprios e sobrevive ao
 * DELETE do aluno. `generations` serve para DETALHAR o que ainda existe, nunca
 * para definir o conjunto.
 *
 * Dinheiro: soma o SINAL (debito negativo + estorno positivo = 0 -> quitado) e
 * reconhece estorno por `ref_type` contra REF_TYPES_ESTORNO, NUNCA por `kind`
 * (o estorno grava kind='extra_purchase'; filtrar por kind faz aluno estornado
 * parecer nao estornado — o falso negativo que paga em dobro, ordem de 20/08).
 *
 * Somente LEITURA: nao escreve em lugar nenhum.
 *
 * USO:
 *   node _frank/ferramentas/ocorrencias_de_verdade.cjs <id|prefixo do incidente>
 *   node _frank/ferramentas/ocorrencias_de_verdade.cjs <id|prefixo> --dinheiro
 */
const { supa } = require("./_comum.cjs");
const { REF_TYPES_ESTORNO } = require("./_estornos.cjs");

const argv = process.argv.slice(2);
const COM_DINHEIRO = argv.includes("--dinheiro");
const PREF = argv.find((a) => !a.startsWith("--"));

if (!PREF) {
  console.error("uso: node ocorrencias_de_verdade.cjs <id|prefixo> [--dinheiro]");
  process.exit(1);
}

(async () => {
  const db = supa();

  // 1) resolve o incidente por prefixo, recusando ambiguo/inexistente
  let incs = [], from = 0;
  for (;;) {
    const { data, error } = await db
      .from("incidents")
      .select("id,numero,status,title,occurrences,first_seen_at,last_seen_at,affected_emails")
      .range(from, from + 999);
    if (error) { console.error("ERRO incidents:", error.message); process.exit(1); }
    incs = incs.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const hit = incs.filter((i) => i.id.startsWith(PREF));
  if (hit.length !== 1) {
    console.error(`prefixo ambiguo ou inexistente: ${hit.length} chamados casam com "${PREF}"`);
    process.exit(1);
  }
  const inc = hit[0];
  console.log(`CHAMADO #${inc.numero} · ${inc.id}`);
  console.log(`  ${inc.title}`);
  console.log(`  status=${inc.status}  occurrences(campo)=${inc.occurrences}`);
  console.log(`  first_seen=${inc.first_seen_at}  last_seen=${inc.last_seen_at}`);

  // 2) A FONTE: incident_occurrences. Paginado — o teto de 1000 do PostgREST
  //    corta em silencio, e um chamado de rajada passa disso com facilidade.
  let occ = [], o = 0;
  for (;;) {
    const { data, error } = await db
      .from("incident_occurrences")
      .select("kind,ref_id,at,email,error")
      .eq("incident_id", inc.id)
      .order("at")
      .range(o, o + 999);
    if (error) { console.error("ERRO incident_occurrences:", error.message); process.exit(1); }
    occ = occ.concat(data);
    if (data.length < 1000) break;
    o += 1000;
  }
  console.log(`\nOCORRENCIAS REAIS (incident_occurrences): ${occ.length}`);
  if (occ.length !== (inc.occurrences ?? -1)) {
    console.log(`  ⚠️ divergencia com o campo occurrences (${inc.occurrences}) — o campo e contador, o ledger e a verdade`);
  }

  // 3) quais refs ainda existem em generations (so para DETALHAR, nunca para definir o conjunto)
  const ids = [...new Set(occ.map((x) => x.ref_id).filter(Boolean))];
  const vivos = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db
      .from("generations")
      .select("id,status,created_at,error_message,duration_seconds")
      .in("id", ids.slice(i, i + 200));
    for (const g of data ?? []) vivos.set(g.id, g);
  }
  const fantasmas = occ.filter((x) => x.ref_id && !vivos.has(x.ref_id));
  console.log(`  linha viva em generations: ${occ.length - fantasmas.length}`);
  console.log(`  FANTASMA (row apagada, so o ledger lembra): ${fantasmas.length}`);
  if (fantasmas.length) {
    console.log(`  ⚠️ medir este chamado por generations perderia ${fantasmas.length} ocorrencia(s):`);
    for (const f of fantasmas) {
      console.log(`     ${f.at} · ${String(f.ref_id).slice(0, 8)} · ${f.email || "(sem e-mail no ledger)"}`);
    }
  }

  // 4) vitimas pelo LEDGER (sobrevive ao delete), nao por affected_emails
  const porEmail = new Map();
  for (const x of occ) {
    const e = x.email || "(sem e-mail)";
    if (!porEmail.has(e)) porEmail.set(e, []);
    porEmail.get(e).push(x);
  }
  console.log(`\nVITIMAS pelo ledger: ${porEmail.size} pessoa(s)`);
  const ord = [...porEmail.entries()].sort((a, b) =>
    new Date(b[1][b[1].length - 1].at) - new Date(a[1][a[1].length - 1].at));
  for (const [email, lista] of ord) {
    const ultima = lista[lista.length - 1].at;
    const fant = lista.filter((x) => !vivos.has(x.ref_id)).length;
    console.log(`  ${String(lista.length).padStart(3)}x · ultima ${ultima} · ${email}${fant ? `  (${fant} fantasma)` : ""}`);
  }
  const soNoLedger = [...porEmail.keys()].filter(
    (e) => e !== "(sem e-mail)" && !(inc.affected_emails ?? []).some((a) => String(a).toLowerCase() === e.toLowerCase()));
  if (soNoLedger.length) {
    console.log(`\n  ⚠️ no ledger mas FORA de affected_emails (${soNoLedger.length}): ${soNoLedger.join(", ")}`);
  }

  // 5) dinheiro por ref_id — o casamento e a prova, a lista de ref_type e so o filtro
  if (COM_DINHEIRO) {
    console.log(`\n=== DINHEIRO (soma do sinal por ref_id; 0 = quitado) ===`);
    let pendentes = 0, semLinha = 0;
    for (const x of occ) {
      const { data: tx } = await db
        .from("credit_transactions")
        .select("amount,kind,ref_type,created_at")
        .eq("ref_id", x.ref_id);
      const linhas = tx ?? [];
      if (!linhas.length) { semLinha++; continue; }
      const soma = linhas.reduce((s, t) => s + Number(t.amount), 0);
      const est = linhas.filter((t) => REF_TYPES_ESTORNO.includes(t.ref_type)).length;
      if (soma !== 0) {
        pendentes++;
        console.log(`  ⚠️ NAO QUITADO  ${String(x.ref_id).slice(0, 8)} · ${x.email} · soma=${soma} · estornos=${est}`);
      }
    }
    console.log(`  nao quitados: ${pendentes}`);
    console.log(`  sem nenhuma linha no extrato: ${semLinha} (nem sempre e erro: operacao gratuita/equipe nao debita)`);
    if (!pendentes) console.log(`  ✅ todas as ocorrencias com extrato fecham em zero`);
  } else {
    console.log(`\n(rode com --dinheiro para conferir estorno de cada ocorrencia)`);
  }
})();
