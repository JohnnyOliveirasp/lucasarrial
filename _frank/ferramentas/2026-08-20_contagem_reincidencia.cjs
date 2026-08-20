/**
 * CONTAGEM REPRODUTÍVEL das notas de REINCIDÊNCIA (correção pedida pelo
 * gerente no card "fechados que continuam disparando", 20/08).
 *
 * O número "9 incidentes / 31 reaberturas" do relatório original veio de uma
 * consulta ad-hoc não persistida — erro de método. Este script é a versão
 * reprodutível: varre TODA a tabela incidents, lê agent_notes de cada um e
 * conta as notas de reincidência em DUAS definições, imprimindo a lista crua
 * por incidente para conferência:
 *
 *  ESTRITA: nota cujo texto começa com 'REINCIDÊNCIA: falha voltou após status'
 *           E by === 'system' — exatamente o que ingest.ts:93 grava. SÓ o
 *           ingest grava essa nota (failure-alert.ts e mail-respond.ts reabrem
 *           — flip de status — mas NÃO escrevem nota de reincidência, então
 *           esta contagem NÃO cobre reaberturas desses dois caminhos).
 *  LARGA:   qualquer nota contendo 'REINCID' (case-insensitive), qualquer
 *           autor — pega também menções manuais/de agente à palavra, que NÃO
 *           são reabertura automática.
 *
 * SÓ .select(). Nenhuma escrita.
 */
const { supa } = require("./_comum.cjs");

const PREFIXO_ESTRITO = 'REINCIDÊNCIA: falha voltou após status';

(async () => {
  const db = supa();

  const { data: incidentes, error } = await db
    .from("incidents")
    .select("id, title, status, agent_notes")
    .order("first_seen_at", { ascending: true });
  if (error) {
    console.log("ERRO CRU na query:", JSON.stringify(error, null, 2));
    process.exit(1);
  }
  console.log(`DENOMINADOR: ${incidentes.length} incidentes na tabela (todos os status).`);

  let estritaIncs = [];
  let largaIncs = [];
  for (const i of incidentes) {
    const notas = Array.isArray(i.agent_notes) ? i.agent_notes : [];
    const estritas = notas.filter(
      (n) => typeof n.note === "string" && n.note.startsWith(PREFIXO_ESTRITO) && n.by === "system",
    );
    const largas = notas.filter(
      (n) => typeof n.note === "string" && /reincid/i.test(n.note),
    );
    if (estritas.length) {
      estritaIncs.push({ id: i.id.slice(0, 8), status: i.status, title: (i.title || "").slice(0, 60), notas: estritas.length });
    }
    if (largas.length) {
      largaIncs.push({
        id: i.id.slice(0, 8),
        status: i.status,
        title: (i.title || "").slice(0, 60),
        notas: largas.length,
        so_mencao: estritas.length === 0, // tem a palavra mas nenhuma nota canônica do ingest
      });
    }
  }

  const totEstrita = estritaIncs.reduce((s, x) => s + x.notas, 0);
  const totLarga = largaIncs.reduce((s, x) => s + x.notas, 0);

  console.log(`\nESTRITA (nota canônica do ingest, by='system'): ${estritaIncs.length} incidentes, ${totEstrita} notas.`);
  console.log(JSON.stringify(estritaIncs, null, 2));
  console.log(`\nLARGA (qualquer nota contendo 'REINCID', qualquer autor): ${largaIncs.length} incidentes, ${totLarga} notas.`);
  console.log(JSON.stringify(largaIncs, null, 2));
  console.log(
    "\nLEMBRETE DE ESCOPO: só ingest.ts grava a nota canônica. failure-alert.ts e " +
      "mail-respond.ts também reabrem (flip de status) mas sem nota — reaberturas " +
      "por esses caminhos NÃO aparecem em nenhuma das duas contagens.",
  );
})();
