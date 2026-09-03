/**
 * MEDIÇÃO (leitura pura): incidentes FECHADOS (fixed/ignored) que seguem vivos.
 * São DUAS famílias, e a versão original só enxergava a primeira:
 *
 *   FAMÍLIA A — "disparou DEPOIS do fechamento": last_seen_at > resolved_at.
 *     O bug de processo do card de 20/08.
 *
 *   FAMÍLIA B — "fechado EM CIMA do próprio disparo": resolved_at vem DEPOIS
 *     de last_seen_at, mas por SEGUNDOS. O e-mail do aluno abre/re-dispara o
 *     chamado e a automação o re-fecha em ~1,5s com "entregue ao time". O
 *     contador de ocorrências sobe, o chamado nunca fica aberto, e quem olha
 *     a fila vê ZERO — enquanto o aluno está escrevendo.
 *
 * POR QUE A FAMÍLIA B EXISTE (medido no incidente #153, 27/08): os 5 casos
 * (#126, #82, #145, #141, #130) fecham 0,798s a 1,601s DEPOIS do disparo.
 * Como a família A só olha `last_seen_at > resolved_at`, nenhum dos 5 aparece:
 * o detector reportou "1 de 129, 0 vivos" no mesmo dia em que os 5 alunos
 * estavam sem resposta. O número estava certo pela régua e errado pelo mundo.
 * A régua nova não muda política nenhuma de fechamento (a regra do Johnny de
 * 24/08 segue valendo) — ela só para de esconder o caso.
 *
 * ATENÇÃO ao denominador: fail-burst e fast-email NÃO gravam linha em
 * incident_occurrences (só bumpam o contador no próprio incidente) — para
 * esses, "ocorrências depois do fechamento" não tem contagem exata; o script
 * diz isso em vez de imprimir 0 enganoso.
 *
 * ⚠️ O PONTO CEGO QUE ESTE SCRIPT NÃO ENXERGAVA — e que custou 7h06 (#226, 02/09).
 *
 * As DUAS famílias comparam `last_seen_at` contra `resolved_at`. Só que
 * `last_seen_at` não anda sozinho: quem o move é (a) uma ocorrência NOVA com a
 * MESMA `signature` (`ingest.ts`, `reportar.ts`, `failure-alert.ts`,
 * `gravar.ts`) ou (b) um evento de e-mail do aluno afetado (`espera.ts`,
 * `mail-bounce-registro.ts`). Chamado aberto NA MÃO, com `signature` inventada
 * na hora e sem aluno escrevendo, não tem nem um nem outro: o carimbo congela
 * no insert e a máquina NUNCA reaudita aquele fechamento.
 *
 * Medido em 02/09: dos 217 fechados, 120 (55%) nunca tiveram o `last_seen_at`
 * movido uma única vez. E o único que a família A pegou em toda a base (`#8`,
 * `training:user_dataset`) é justamente o único cuja signature EXISTE no código
 * — as demais (`transcode:mp3-sem-xing-header`, `image:pending_sem_reconciliador`,
 * `qa_exhausted_entrega_silenciosa`…) aparecem em ZERO arquivos. Ou seja:
 * "1 de 217" nunca foi taxa baixa de zumbi; era cobertura quase total de ~97 e
 * cobertura ZERO dos outros 120.
 *
 * Pior sub-classe: 18 fechados com `occurrences > 1` que nunca andaram — número
 * DIGITADO à mão no insert (dois deles com 2.625 e 2.585). Têm cara de chamado
 * bem instrumentado e são exatamente os que ninguém reaudita.
 *
 * Por isso o resumo agora separa AUDITÁVEL de CEGO. Um "0 vivos" sobre 217 lia
 * como "conferi 217"; era falso, e foi assim que o #226 seguiu entregando 7h06
 * depois de um `fixed` falso sem nada no sistema piscar. Régua nenhuma mudou —
 * o que muda é o script parar de anunciar cobertura que não tem.
 *
 * SÓ .select(). Nenhuma escrita.
 */
const { supa } = require("./_comum.cjs");

const HORAS_48 = 48 * 3600 * 1000;
/** Janela da família B: fechamento que cai em cima do disparo. */
const JANELA_EM_CIMA_MS = Number(process.env.JANELA_EM_CIMA_S || 300) * 1000;
const PAGINA = 1000;

/**
 * Lê a tabela inteira paginando. O PostgREST corta em 1000 linhas EM SILÊNCIO;
 * hoje são 142 fechados e não trunca, mas o denominador deste script é
 * exatamente o número que não pode mentir quando a base crescer.
 *
 * ⚠️ A ORDENAÇÃO TEM QUE SER ÚNICA, senão a paginação mente sem avisar.
 * Paginar é OFFSET/LIMIT: com `order by` que empata, o Postgres não promete
 * ordem estável de uma página para a seguinte, então linha empatada na
 * fronteira pode sair DUAS vezes — ou nenhuma. Não é hipótese nesta base:
 * medido em 28/08, 142 fechados para 140 `last_seen_at` distintos, ou seja
 * 2 grupos de empate JÁ existem. Enquanto tudo cabe numa página o efeito é
 * zero; passando de 1000 o denominador passa a errar em silêncio, que é
 * exatamente o defeito que este script existe para não cometer. Daí o
 * desempate por `id` (chave primária: ordem total e estável).
 */
async function lerTudo(db, tabela, colunas, aplicarFiltro) {
  const out = [];
  for (let de = 0; ; de += PAGINA) {
    let q = db.from(tabela).select(colunas).range(de, de + PAGINA - 1);
    if (aplicarFiltro) q = aplicarFiltro(q);
    q = q.order("id", { ascending: true }); // desempate — ver aviso acima
    const { data, error } = await q;
    if (error) return { data: null, error };
    out.push(...data);
    if (data.length < PAGINA) break;
  }
  return { data: out, error: null };
}

(async () => {
  const db = supa();
  const agora = Date.now();

  // 1) TODOS os fechados (denominador) — paginado, o corte de 1000 é silencioso
  const { data: fechados, error: e1 } = await lerTudo(
    db,
    "incidents",
    "id, numero, title, status, kind, cause, signature, occurrences, resolved_at, resolved_by, last_seen_at, first_seen_at, affected_emails",
    (q) => q.in("status", ["fixed", "ignored"]).order("last_seen_at", { ascending: false }),
  );
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

  // ------------------------------------------------------------------
  // COBERTURA REAL — quantos destes o script CONSEGUE reauditar (ver
  // "PONTO CEGO" no cabeçalho). Sem isto, o denominador acima é promessa
  // que as duas famílias não cumprem.
  // ------------------------------------------------------------------
  const andou = (i) =>
    i.last_seen_at && i.first_seen_at &&
    new Date(i.last_seen_at).getTime() > new Date(i.first_seen_at).getTime();

  const auditaveis = comResolvedAt.filter(andou);
  const cegos = comResolvedAt.filter((i) => !andou(i));
  // A sub-classe que engana: contador digitado no insert, alto, e imóvel.
  const cegosComNumero = cegos
    .filter((i) => (i.occurrences || 0) > 1)
    .sort((a, b) => (b.occurrences || 0) - (a.occurrences || 0));

  const pct = (n) => ((n / (comResolvedAt.length || 1)) * 100).toFixed(1);
  console.log(
    `\nCOBERTURA REAL DESTA MEDIÇÃO (não confunda com o denominador acima):\n` +
      `  AUDITÁVEL: ${auditaveis.length} (${pct(auditaveis.length)}%) — last_seen_at já se moveu ` +
      `alguma vez, então existe produtor e um disparo novo apareceria aqui.\n` +
      `  CEGO:      ${cegos.length} (${pct(cegos.length)}%) — last_seen_at CONGELADO desde o insert. ` +
      `Para estes, as duas famílias abaixo são incapazes de acusar qualquer coisa:\n` +
      `             família A (last_seen > resolved) é aritmeticamente impossível, e a família B\n` +
      `             só mede a distância insert→fechamento, que não diz nada sobre reincidência.\n` +
      `  Um fechamento FALSO dentro dos ${cegos.length} cegos não é detectado por este script. ` +
      `Foi o caso do #226.`,
  );

  if (cegosComNumero.length) {
    console.log(
      `\n  ⚠️ ${cegosComNumero.length} dos cegos carregam occurrences > 1 DIGITADO no insert — ` +
        `número que nunca mais anda.\n  São os mais enganosos: têm cara de chamado instrumentado ` +
        `e são os que ninguém reaudita.`,
    );
    for (const i of cegosComNumero) {
      console.log(
        `    #${i.numero} ${i.id.slice(0, 8)} [${i.status}] occurrences=${i.occurrences} ` +
          `· ${i.signature || "(sem signature)"}`,
      );
    }
  }

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
  console.log(`\nRESUMO FAMÍLIA A: ${linhas.length} fechados dispararam depois do fechamento; ${vivos.length} com ocorrência nas últimas 48h (vivos).`);
  console.log(`Vivos: ${vivos.map((v) => v.id).join(", ") || "(nenhum)"}`);

  // ------------------------------------------------------------------
  // FAMÍLIA B: fechado EM CIMA do próprio disparo (o ponto cego do #153)
  // ------------------------------------------------------------------
  const emCima = comResolvedAt
    .map((i) => {
      const delta = new Date(i.resolved_at).getTime() - new Date(i.last_seen_at).getTime();
      return { i, delta };
    })
    .filter(({ delta }) => delta >= 0 && delta <= JANELA_EM_CIMA_MS)
    .sort((a, b) => a.delta - b.delta);

  console.log(
    `\n\nFECHADOS EM CIMA DO PRÓPRIO DISPARO (fechamento até ${JANELA_EM_CIMA_MS / 1000}s depois da ` +
      `última ocorrência): ${emCima.length} de ${comResolvedAt.length}\n`,
  );

  const linhasB = emCima.map(({ i, delta }) => {
    const lastMs = new Date(i.last_seen_at).getTime();
    return {
      numero: i.numero,
      id: i.id.slice(0, 8),
      title: (i.title || "").slice(0, 70),
      status: i.status,
      resolved_by: i.resolved_by,
      fechou_em: `${(delta / 1000).toFixed(3)}s depois do disparo`,
      occurrences_contador: i.occurrences,
      reincidente: (i.occurrences || 0) > 1,
      alunos: i.affected_emails || [],
      ultima_ocorrencia_ha: `${Math.round((agora - lastMs) / 3600000)}h atrás`,
      vivo_48h: agora - lastMs <= HORAS_48,
    };
  });

  for (const l of linhasB) console.log(JSON.stringify(l, null, 2));

  // O que realmente dói: fechado em cima do disparo, reincidente E com aluno.
  const suspeitos = linhasB.filter((l) => l.reincidente && l.alunos.length);
  const vivosB = linhasB.filter((l) => l.vivo_48h);
  console.log(
    `\nRESUMO FAMÍLIA B: ${linhasB.length} fechados em cima do disparo; ` +
      `${vivosB.length} vivos nas últimas 48h; ` +
      `${suspeitos.length} REINCIDENTES COM ALUNO (o aluno escreveu de novo e o chamado re-fechou).`,
  );
  console.log(`Reincidentes com aluno: ${suspeitos.map((s) => `#${s.numero}`).join(", ") || "(nenhum)"}`);
  console.log(
    `\nTOTAL DAS DUAS FAMÍLIAS: ${linhas.length + linhasB.length} fechados com sinal de vida ` +
      `(${vivos.length + vivosB.length} vivos nas últimas 48h).`,
  );
  // Sem esta linha o total acima lê como "conferi os 217". Não conferi.
  console.log(
    `  ↳ este total vale sobre os ${auditaveis.length} AUDITÁVEIS. Sobre os ${cegos.length} CEGOS ` +
      `o script não tem opinião —\n    não é "nenhum disparou", é "não dá pra saber por aqui". ` +
      `Fechado cego só é reauditado por consulta\n    própria ao fato (foi o que reabriu o #226), ` +
      `não por este detector.`,
  );

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
