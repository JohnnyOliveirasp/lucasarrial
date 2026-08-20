/**
 * MEDIÇÃO (leitura pura): incidentes FECHADOS (fixed/ignored) que continuaram
 * disparando DEPOIS do fechamento — o bug de processo do card de 20/08.
 *
 * Para cada fechado: compara last_seen_at vs resolved_at, conta ocorrências
 * cruas (incident_occurrences.at > resolved_at) quando existem, e marca os
 * "vivos" (ocorrência nas últimas 48h).
 *
 * ATENÇÃO ao denominador: fail-burst e fast-email NÃO gravam linha em
 * incident_occurrences (só bumpam o contador no próprio incidente) — para
 * esses, "ocorrências depois do fechamento" não tem contagem exata; o script
 * diz isso em vez de imprimir 0 enganoso.
 *
 * SÓ .select(). Nenhuma escrita.
 */
const { supa } = require("./_comum.cjs");

const HORAS_48 = 48 * 3600 * 1000;

(async () => {
  const db = supa();
  const agora = Date.now();

  // 1) TODOS os fechados (denominador)
  const { data: fechados, error: e1 } = await db
    .from("incidents")
    .select(
      "id, title, status, kind, cause, signature, occurrences, resolved_at, resolved_by, last_seen_at, first_seen_at",
    )
    .in("status", ["fixed", "ignored"])
    .order("last_seen_at", { ascending: false });
  if (e1) {
    console.log("ERRO CRU na query de fechados:", JSON.stringify(e1, null, 2));
    process.exit(1);
  }
  console.log(`DENOMINADOR: ${fechados.length} incidentes fechados (fixed/ignored) examinados.`);

  const semResolvedAt = fechados.filter((i) => !i.resolved_at);
  const comResolvedAt = fechados.filter((i) => i.resolved_at);
  console.log(
    `  ${comResolvedAt.length} com resolved_at preenchido; ${semResolvedAt.length} sem resolved_at ` +
      `(esses não dá pra comparar — listados à parte no fim).`,
  );

  // 2) fechados com last_seen_at DEPOIS do resolved_at
  const zumbis = comResolvedAt.filter(
    (i) => new Date(i.last_seen_at).getTime() > new Date(i.resolved_at).getTime(),
  );
  console.log(`\nFECHADOS QUE DISPARARAM DEPOIS DO FECHAMENTO: ${zumbis.length} de ${comResolvedAt.length}\n`);

  if (!zumbis.length) {
    console.log("Zero zumbis. Corpo cru dos 5 fechados mais recentes pra prova de que a query anda:");
    console.log(JSON.stringify(fechados.slice(0, 5), null, 2));
  }

  const linhas = [];
  for (const i of zumbis) {
    // ocorrências cruas depois do fechamento (só existe pro caminho ingest)
    const { data: occs, error: e2 } = await db
      .from("incident_occurrences")
      .select("at", { count: "exact" })
      .eq("incident_id", i.id)
      .gt("at", i.resolved_at)
      .order("at", { ascending: false });
    if (e2) {
      console.log(`ERRO CRU nas ocorrências de ${i.id}:`, JSON.stringify(e2, null, 2));
      continue;
    }
    // total de linhas cruas do incidente (pra saber se ele É do caminho ingest)
    const { count: totalOccs, error: e3 } = await db
      .from("incident_occurrences")
      .select("*", { count: "exact", head: true })
      .eq("incident_id", i.id);
    if (e3) console.log(`ERRO CRU no total de ${i.id}:`, JSON.stringify(e3, null, 2));

    const lastMs = new Date(i.last_seen_at).getTime();
    const vivo48h = agora - lastMs <= HORAS_48;
    linhas.push({
      id: i.id.slice(0, 8),
      title: (i.title || "").slice(0, 70),
      status: i.status,
      cause: i.cause,
      signature: (i.signature || "").slice(0, 60),
      resolved_at: i.resolved_at,
      resolved_by: i.resolved_by,
      last_seen_at: i.last_seen_at,
      occs_depois_fechamento:
        totalOccs && totalOccs > 0
          ? occs.length
          : "sem linhas cruas (caminho fail-burst/fast-email só bumpa contador)",
      occurrences_contador: i.occurrences,
      dispara_ha: `${Math.round((lastMs - new Date(i.resolved_at).getTime()) / 3600000)}h depois do fechamento`,
      ultima_ocorrencia_ha: `${Math.round((agora - lastMs) / 3600000)}h atrás`,
      vivo_48h: vivo48h,
    });
  }

  for (const l of linhas) console.log(JSON.stringify(l, null, 2));

  const vivos = linhas.filter((l) => l.vivo_48h);
  console.log(`\nRESUMO: ${linhas.length} fechados dispararam depois do fechamento; ${vivos.length} com ocorrência nas últimas 48h (vivos).`);
  console.log(`Vivos: ${vivos.map((v) => v.id).join(", ") || "(nenhum)"}`);

  if (semResolvedAt.length) {
    console.log(`\nFechados SEM resolved_at (não comparáveis, corpo cru):`);
    console.log(
      JSON.stringify(
        semResolvedAt.map((i) => ({
          id: i.id.slice(0, 8),
          title: (i.title || "").slice(0, 60),
          status: i.status,
          last_seen_at: i.last_seen_at,
          occurrences: i.occurrences,
        })),
        null,
        2,
      ),
    );
  }
})();
