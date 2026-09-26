#!/usr/bin/env node
/**
 * EXECUCAO (grava em producao, atras de --confirmar) do estorno agregado #439.
 * Cartao 75c33ee1. Johnny autorizou em 26/09 ("pode").
 *
 * IRMAO do simulador /mnt/Data/estorno-439-simulacao-2026-09-24/
 * simular_estorno_agregado_439.cjs — MESMA formula (copiada dele de proposito,
 * "reuse o codigo, nao reescreva a regra"), mas este GRAVA.
 *
 * A REGRA QUE DECIDE ESTE ARQUIVO: RECALCULAR NA HORA DE GRAVAR.
 * NUNCA aplicar a tabela salva do dia 24/09 nem a de qualquer rerun anterior.
 * PROVA MEDIDA (rerun do simulador em 26/09, ~16:38Z, ANTES deste script
 * existir): a tabela de 24/09 dizia 1.010.200 cr / 183 alunos; o rerun ao
 * vivo (mesmo dia, minutos depois) ja dizia 1.000.960 cr / 182 alunos —
 * 3 imagens tinham saido nesse intervalo (9.240 cr / 7 despachos), uma delas
 * estornada as 15:47:56Z do MESMO dia. Ou seja: nem "hoje de manha" e numero
 * confiavel pra gravar a tarde. So o recalculo feito NO MOMENTO IMEDIATAMENTE
 * ANTES de cada escrita individual vale.
 *
 * FORMULA (identica ao simulador, fonte:
 * _frank/ferramentas/2026-09-17_estornar_video_sobrescrito.cjs):
 *   - despachos pagos: credit_transactions ref_type='image_video', amount<0
 *   - por imagem (ref_id), congelado no corte aprovado 17/09 16:37:25Z
 *   - sobrescritos = todos MENOS o ultimo; valor = soma de |amount| deles
 *   - imagem que JA TEM qualquer tx amount>0 casada por ref_id (SEM filtrar
 *     ref_type — o estorno grava kind='extra_purchase' e pode ter ref_type
 *     variado: image_video_refund, image_refund, compensation, etc. Filtrar
 *     por um ref_type so, ou por kind, e o falso negativo que paga em dobro
 *     documentado em _frank/ferramentas/_estornos.cjs) e PULADA.
 *
 * CAMINHO DE ESCRITA: RPC add_extra_credits(p_user_id, p_amount,
 * p_ref_type='image_video_refund', p_ref_id=<imagem>) — o MESMO caminho de
 * producao do tool 2026-09-17_estornar_video_sobrescrito.cjs pra este mesmo
 * incidente (#439). scripts/13_credits.sql confirma: grava
 * kind='extra_purchase' (por isso nunca conferir por kind) e credits_extra +=
 * amount (saldo so pode SUBIR — nunca fica negativo por causa desta escrita).
 *
 * IDEMPOTENCIA: por IMAGEM (ref_id), checada DUAS VEZES — uma na montagem do
 * lote (linha ~140) e outra imediatamente antes de CADA escrita individual
 * (linha ~180), pra fechar a corrida contra qualquer outro estorno entrando
 * no meio da execucao (e exatamente o que a prova acima mostrou acontecer).
 * Rodar este script duas vezes NAO paga duas vezes.
 *
 * ABORTOS (declarados, nao ajustaveis na hora):
 *   (a) total pendente recalculado > TETO_TOTAL_APROVADO (1.010.200 cr, o
 *       liquido aprovado de 17/09) OU alunos pendentes > 183 — fisicamente
 *       so pode DIMINUIR desde 17/09 (mais estornos feitos), nunca crescer;
 *       crescer e sinal de bug ou escopo mudou. ABORTA sem gravar nada.
 *   (b) qualquer saldo fica NEGATIVO depois de uma escrita — nao deveria ser
 *       possivel (a escrita so soma), mas se acontecer e prova de
 *       inconsistencia mais funda: ABORTA o restante do lote imediatamente
 *       (o que ja foi gravado ate ali fica gravado e provado; nao desfaz).
 *   (c) qualquer consulta ao Supabase devolver error, OU a paginacao nao
 *       bater com o count exato — ABORTA na hora, antes de gravar mais nada.
 *
 * TETO 9-B (20.000/caso, 100.000/dia) aqui e SO INFORMATIVO: este lote inteiro
 * (1.010.200 cr agregados) ja foi aprovado em bloco pelo Johnny em 24/09 e
 * autorizado hoje — nao e uma gravacao autonoma caso-a-caso como a do tool de
 * 17/09. Os casos acima de 20k saem logados na prova pra ele ver, no bloqueiam
 * a execucao. Se isso estiver errado, PARAR e falar com o Frank antes de rodar
 * --confirmar.
 *
 * SEM --confirmar: ENSAIO — faz todas as consultas e o recalculo, escreve o
 * backup nao grava nenhuma linha nova, nao chama a RPC.
 * COM --confirmar: grava de verdade, caso a caso, sequencial (nao paralelo,
 * de proposito — cada escrita rele o estado antes de decidir a proxima).
 *
 * Supabase corta em 1000: toda leitura pagina com .range() E confere contra
 * um count exato (head:true) — aborta se nao bater.
 *
 * USO: node 2026-09-26_executar_estorno_agregado_439.cjs [--confirmar]
 */
const path = require("node:path");
const fs = require("node:fs");
const { supa } = require("./_comum.cjs");

const CORTE_1709 = "2026-09-17T16:37:25.999Z";
const OUT_DIR = "/mnt/Data/estorno-439-execucao-2026-09-26";
const CONFIRMAR = process.argv.includes("--confirmar");
const REF_TYPE_GRAVACAO = "image_video_refund";
const TETO_CASO_INFORMATIVO = 20000;
const TETO_TOTAL_APROVADO = 1010200; // A.liquido.cr de 17/09 — teto fisico, so pode diminuir
const TETO_ALUNOS_APROVADO = 183;
const ESPERADO_A = { desp: 451, cr: 1122940, alunos: 195 }; // bruto, mesma checagem do simulador
const ESPERADO_A_LIQUIDO = { desp: 398, cr: 1010200, alunos: 183 };

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const INICIO = new Date().toISOString();
const acumulado = { processados: [], pulados_ja_estornado: [], abortado_em: null, erro: null };

function gravarProva(statusFinal) {
  const arqPath = path.join(OUT_DIR, `prova_execucao_${INICIO.replace(/[:.]/g, "-")}.json`);
  const soma = acumulado.processados.reduce((a, p) => a + p.valor, 0);
  const conteudo = {
    gerado_em: new Date().toISOString(),
    inicio_execucao: INICIO,
    confirmar: CONFIRMAR,
    status_final: statusFinal,
    erro: acumulado.erro,
    abortado_em: acumulado.abortado_em,
    n_processados: acumulado.processados.length,
    soma_gravada_cr: soma,
    n_pulados_ja_estornado: acumulado.pulados_ja_estornado.length,
    processados: acumulado.processados,
    pulados_ja_estornado: acumulado.pulados_ja_estornado,
  };
  fs.writeFileSync(arqPath, JSON.stringify(conteudo, null, 2));
  console.log(`\nPROVA gravada: ${arqPath}`);
  console.log(`  processados: ${acumulado.processados.length} · soma gravada: ${soma} cr · pulados (ja estornado): ${acumulado.pulados_ja_estornado.length}`);
  return arqPath;
}

function abortar(msg) {
  console.error("\n🔴 ABORTO:", msg);
  acumulado.erro = msg;
  acumulado.abortado_em = new Date().toISOString();
  gravarProva("ABORTADO");
  process.exit(1);
}

// IMPORTANTE (achado rodando o ensaio pela primeira vez): supabase-js so
// devolve `count` exato quando o {count:'exact', head:true} vai NO MESMO
// .select() que ja carrega os filtros — encadear um SEGUNDO .select() por
// cima de uma query que ja tinha .order() aplicado devolve count=null sem
// error nenhum (silencioso). Por isso a contagem e a paginacao aqui montam
// a query DO ZERO cada uma, aplicando os MESMOS filtros via `aplicarFiltros`,
// e so a paginacao de dados aplica `ordenar`.
async function paginarComContagem(db, tabela, colunas, aplicarFiltros, ordenar, rotulo) {
  const { count, error: eCount } = await aplicarFiltros(db.from(tabela).select(colunas, { count: "exact", head: true }));
  if (eCount) abortar(`count exato de ${rotulo} falhou: ${JSON.stringify(eCount)}`);
  if (count === null || count === undefined) abortar(`count exato de ${rotulo} veio null/undefined sem error — nao confiar (provavel bug de montagem da query)`);
  const todos = [];
  for (let de = 0; ; de += 1000) {
    const base = ordenar(aplicarFiltros(db.from(tabela).select(colunas)));
    const { data, error } = await base.range(de, de + 999);
    if (error) abortar(`consulta ${rotulo} falhou (offset ${de}): ${JSON.stringify(error)}`);
    if (!data) abortar(`consulta ${rotulo} devolveu data=null sem error (offset ${de}) — nao confiar`);
    todos.push(...data);
    if (data.length < 1000) break;
  }
  if (todos.length !== count) {
    abortar(`paginacao de ${rotulo} leu ${todos.length} linhas mas o count exato do banco e ${count} — nao bate, nao confiar`);
  }
  return todos;
}

async function medirPendentes(db) {
  // 1) despachos pagos de image_video, congelados no corte aprovado
  const despachos = await paginarComContagem(
    db, "credit_transactions", "id,user_id,amount,created_at,ref_id,note",
    (q) => q.eq("ref_type", "image_video").lt("amount", 0),
    (q) => q.order("created_at", { ascending: true }).order("id", { ascending: true }),
    "despachos image_video",
  );
  const despCorte = despachos.filter((d) => d.created_at <= CORTE_1709);

  const porImagem = new Map();
  for (const d of despCorte) {
    if (!d.ref_id) abortar(`despacho ${d.id} sem ref_id — formula nao cobre isso`);
    if (!porImagem.has(d.ref_id)) porImagem.set(d.ref_id, []);
    porImagem.get(d.ref_id).push(d);
  }
  const imagens = [...porImagem.keys()];

  // 2) estornos casados por ref_id, QUALQUER ref_type, amount>0 (sem filtro)
  const estornos = [];
  for (let i = 0; i < imagens.length; i += 100) {
    const lote = imagens.slice(i, i + 100);
    const { data, error } = await db.from("credit_transactions")
      .select("id,user_id,amount,created_at,ref_id,ref_type,kind")
      .in("ref_id", lote).gt("amount", 0).limit(10000);
    if (error) abortar(`consulta estornos lote ${i} falhou: ${JSON.stringify(error)}`);
    if (data.length >= 10000) abortar(`lote ${i} de estornos bateu o limit 10000 — paginacao insuficiente`);
    estornos.push(...data);
  }
  const estornosPorImagem = new Map();
  for (const e of estornos) {
    if (!estornosPorImagem.has(e.ref_id)) estornosPorImagem.set(e.ref_id, []);
    estornosPorImagem.get(e.ref_id).push(e);
  }

  // 3) casos por imagem, com o estado JA ESTORNADA medido agora mesmo
  const casos = [];
  for (const [img, desp] of porImagem) {
    if (desp.length < 2) continue; // 1 despacho = nada sobrescrito
    const sobrescritos = desp.slice(0, -1);
    const valor = sobrescritos.reduce((a, d) => a + Math.abs(d.amount), 0);
    const jaEstornada = (estornosPorImagem.get(img) || []).length > 0;
    casos.push({ imagem: img, user_id: desp[0].user_id, nSobrescritos: sobrescritos.length, valor, jaEstornada });
  }

  // checagem de reproducao (mesma do simulador) — se a formula nao bate no
  // que foi aprovado, e risco pra escalar, nao pra ajustar
  const bruto = {
    desp: casos.reduce((a, c) => a + c.nSobrescritos, 0),
    cr: casos.reduce((a, c) => a + c.valor, 0),
    alunos: new Set(casos.map((c) => c.user_id)).size,
  };
  if (bruto.desp !== ESPERADO_A.desp || bruto.cr !== ESPERADO_A.cr || bruto.alunos !== ESPERADO_A.alunos) {
    abortar(`bruto recalculado (${bruto.desp}/${bruto.cr}/${bruto.alunos}) nao bate com o aprovado (${ESPERADO_A.desp}/${ESPERADO_A.cr}/${ESPERADO_A.alunos}) — escopo dos despachos mudou desde 17/09, o que nao deveria acontecer (corte congelado). PARAR e escalar.`);
  }

  const pendentes = casos.filter((c) => !c.jaEstornada);
  const somaPendente = pendentes.reduce((a, c) => a + c.valor, 0);
  const alunosPendente = new Set(pendentes.map((c) => c.user_id)).size;

  // (a) teto fisico: so pode diminuir desde o aprovado, nunca crescer
  if (somaPendente > TETO_TOTAL_APROVADO) {
    abortar(`total pendente recalculado ${somaPendente} cr > teto aprovado ${TETO_TOTAL_APROVADO} cr — fisicamente impossivel sob o modelo (corte de despachos congelado, so estornos crescem). Bug ou premissa quebrada. NAO gravar.`);
  }
  if (alunosPendente > TETO_ALUNOS_APROVADO) {
    abortar(`alunos pendentes ${alunosPendente} > teto aprovado ${TETO_ALUNOS_APROVADO} — mesma logica do teto de total. NAO gravar.`);
  }

  return { casos, pendentes, somaPendente, alunosPendente, imagensNoEscopo: imagens.length };
}

(async () => {
  const db = supa();

  console.log(`=== EXECUCAO ESTORNO AGREGADO #439 (cartao 75c33ee1) ===`);
  console.log(`modo: ${CONFIRMAR ? "CONFIRMAR (grava em producao)" : "ENSAIO (nada e gravado)"}`);
  console.log(`inicio: ${INICIO}\n`);

  const medPre = await medirPendentes(db);
  console.log(`recalculo (agora): ${medPre.pendentes.length} imagens pendentes / ${medPre.somaPendente} cr / ${medPre.alunosPendente} alunos`);
  console.log(`(referencia — aprovado 17/09: 304 imagens / ${ESPERADO_A_LIQUIDO.cr} cr / ${ESPERADO_A_LIQUIDO.alunos} alunos, antes de qualquer estorno posterior)`);

  if (medPre.pendentes.length === 0) {
    console.log("\nNADA PENDENTE — todos os casos aprovados ja foram estornados. Nada a fazer.");
    gravarProva("NADA_PENDENTE");
    process.exit(0);
  }

  // BACKUP NOVO dos perfis afetados (universo: alunos com algum caso, pendente ou nao)
  const userIds = [...new Set(medPre.casos.map((c) => c.user_id))];
  const perfis = [];
  for (let i = 0; i < userIds.length; i += 100) {
    const lote = userIds.slice(i, i + 100);
    const { data, error } = await db.from("profiles")
      .select("id,email,display_name,credits_subscription,credits_extra")
      .in("id", lote);
    if (error) abortar(`consulta profiles (backup) lote ${i} falhou: ${JSON.stringify(error)}`);
    perfis.push(...data);
  }
  if (perfis.length !== userIds.length) {
    const achados = new Set(perfis.map((p) => p.id));
    abortar(`profiles (backup) devolveu ${perfis.length} de ${userIds.length}. SUMIDOS: ${userIds.filter((u) => !achados.has(u)).join(", ")}`);
  }
  const backup = perfis.map((p) => ({
    id: p.id, email: p.email, display_name: p.display_name,
    credits_subscription: p.credits_subscription ?? 0, credits_extra: p.credits_extra ?? 0,
    saldo_total: (p.credits_subscription ?? 0) + (p.credits_extra ?? 0),
  })).sort((a, b) => a.email.localeCompare(b.email));
  // achado no ensaio: montar o mapa de lookup a partir de `perfis` cru (sem
  // saldo_total) faz o print do ensaio mostrar saldo_antes="?" e o
  // saldo_depois_esperado errado (0 + valor em vez de saldo real + valor).
  // o mapa tem que vir do `backup`, que ja tem o campo derivado.
  const perfilPorId = new Map(backup.map((p) => [p.id, p]));
  const backupPath = path.join(OUT_DIR, `backup_perfis_antes_execucao_${INICIO.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ gerado_em: INICIO, n: backup.length, perfis: backup }, null, 2));
  console.log(`\nBACKUP (novo, desta execucao) gravado: ${backupPath} (${backup.length} perfis)`);

  // avisos informativos (nao bloqueiam — lote ja aprovado em bloco)
  const acima20k = medPre.pendentes.filter((c) => c.valor > TETO_CASO_INFORMATIVO);
  if (acima20k.length) {
    console.log(`\n⚠️ ${acima20k.length} caso(s) pendente(s) acima de ${TETO_CASO_INFORMATIVO} cr (informativo, alcada e do Johnny, ja aprovado em bloco):`);
    for (const c of acima20k) console.log(`  imagem ${c.imagem} user ${c.user_id}: ${c.valor} cr`);
  }

  if (!CONFIRMAR) {
    console.log(`\n=== ENSAIO — o que SERIA gravado (${medPre.pendentes.length} imagens) ===`);
    for (const c of medPre.pendentes.sort((a, b) => b.valor - a.valor)) {
      const p = perfilPorId.get(c.user_id);
      console.log(`  ${p?.email || c.user_id} · imagem ${c.imagem} · ${c.valor} cr · saldo_antes=${p?.saldo_total ?? "?"} -> saldo_depois_esperado=${(p?.saldo_total ?? 0) + c.valor}`);
    }
    console.log(`\nTOTAL ENSAIO: ${medPre.somaPendente} cr / ${medPre.pendentes.length} imagens / ${medPre.alunosPendente} alunos`);
    console.log("\n[ENSAIO] NADA FOI GRAVADO. Rode com --confirmar so depois do Johnny conferir esta saida.");
    gravarProva("ENSAIO_OK");
    process.exit(0);
  }

  // ===== CONFIRMAR: grava de verdade, sequencial, caso a caso =====
  console.log(`\n=== GRAVANDO (${medPre.pendentes.length} imagens) ===`);
  let somaDiaJaVista = 0;
  for (const caso of medPre.pendentes.sort((a, b) => a.valor - b.valor)) {
    // (c) recheca IMEDIATAMENTE antes desta escrita — fecha a corrida com
    // qualquer outro estorno que tenha entrado desde medirPendentes()
    const { data: recheck, error: eRecheck } = await db.from("credit_transactions")
      .select("id,amount,ref_type,created_at").eq("ref_id", caso.imagem).gt("amount", 0);
    if (eRecheck) abortar(`recheck de idempotencia da imagem ${caso.imagem} falhou: ${JSON.stringify(eRecheck)}`);
    if (recheck.length > 0) {
      console.log(`  PULANDO imagem ${caso.imagem} (user ${caso.user_id}): ja estornada entre a listagem e agora — ${JSON.stringify(recheck)}`);
      acumulado.pulados_ja_estornado.push({ imagem: caso.imagem, user_id: caso.user_id, valor_previsto: caso.valor, encontrado: recheck });
      continue;
    }

    const { data: pAntes, error: ePAntes } = await db.from("profiles")
      .select("id,email,credits_subscription,credits_extra").eq("id", caso.user_id);
    if (ePAntes) abortar(`leitura de profile (antes) da imagem ${caso.imagem} falhou: ${JSON.stringify(ePAntes)}`);
    if (!pAntes || pAntes.length !== 1) abortar(`profile do user ${caso.user_id} nao encontrado (imagem ${caso.imagem}) antes da escrita`);
    const saldoAntes = (pAntes[0].credits_subscription ?? 0) + (pAntes[0].credits_extra ?? 0);

    const { data: rpc, error: eRpc } = await db.rpc("add_extra_credits", {
      p_user_id: caso.user_id, p_amount: caso.valor,
      p_ref_type: REF_TYPE_GRAVACAO, p_ref_id: caso.imagem,
    });
    if (eRpc) abortar(`RPC add_extra_credits falhou na imagem ${caso.imagem} (user ${caso.user_id}): ${JSON.stringify(eRpc)}`);
    if (!rpc || rpc.ok !== true) abortar(`RPC add_extra_credits devolveu nao-ok na imagem ${caso.imagem}: ${JSON.stringify(rpc)}`);

    // CONFERE NO BANCO — nao na fala da RPC
    const { data: txDepois, error: eTx } = await db.from("credit_transactions")
      .select("id,amount,ref_type,ref_id,created_at,balance_after,kind").eq("ref_id", caso.imagem).gt("amount", 0);
    if (eTx) abortar(`conferencia da transacao da imagem ${caso.imagem} falhou: ${JSON.stringify(eTx)}`);
    if (!txDepois || txDepois.length !== 1) abortar(`imagem ${caso.imagem}: esperava exatamente 1 linha de estorno apos a escrita, achei ${txDepois?.length ?? 0} — o banco nao confirma, NAO declarar feito`);
    const tx = txDepois[0];
    if (tx.amount !== caso.valor) abortar(`imagem ${caso.imagem}: tx gravada com amount=${tx.amount}, esperado ${caso.valor} — nao bate`);

    const { data: pDepois, error: ePDepois } = await db.from("profiles")
      .select("id,email,credits_subscription,credits_extra").eq("id", caso.user_id);
    if (ePDepois) abortar(`leitura de profile (depois) da imagem ${caso.imagem} falhou: ${JSON.stringify(ePDepois)}`);
    const saldoDepois = (pDepois[0].credits_subscription ?? 0) + (pDepois[0].credits_extra ?? 0);

    // (b) saldo negativo depois — nao deveria ser possivel (soma so aumenta)
    if (saldoDepois < 0) {
      acumulado.processados.push({
        imagem: caso.imagem, user_id: caso.user_id, email: pDepois[0].email, valor: caso.valor,
        saldo_antes: saldoAntes, saldo_depois: saldoDepois, tx_id: tx.id, balance_after_tx: tx.balance_after,
        created_at: tx.created_at, ALERTA: "saldo negativo depois",
      });
      abortar(`imagem ${caso.imagem} (user ${caso.user_id}, ${pDepois[0].email}): saldo ficou NEGATIVO depois (${saldoDepois}) — impossivel sob o modelo (so soma), inconsistencia mais funda. Parando o RESTANTE do lote; o que ja foi gravado ate aqui esta na prova.`);
    }
    if (saldoDepois - saldoAntes !== caso.valor) {
      abortar(`imagem ${caso.imagem}: delta de saldo (${saldoDepois - saldoAntes}) != valor gravado (${caso.valor}) — banco nao confirma`);
    }

    somaDiaJaVista += caso.valor;
    acumulado.processados.push({
      imagem: caso.imagem, user_id: caso.user_id, email: pDepois[0].email, valor: caso.valor,
      saldo_antes: saldoAntes, saldo_depois: saldoDepois, tx_id: tx.id, balance_after_tx: tx.balance_after,
      created_at: tx.created_at,
    });
    console.log(`  OK ${pDepois[0].email} · imagem ${caso.imagem} · +${caso.valor} cr · ${saldoAntes} -> ${saldoDepois} · tx ${tx.id}`);
  }

  console.log(`\n=== FIM ===`);
  console.log(`processados: ${acumulado.processados.length} · soma gravada: ${acumulado.processados.reduce((a, p) => a + p.valor, 0)} cr`);
  console.log(`pulados (ja estornado durante a execucao): ${acumulado.pulados_ja_estornado.length}`);
  gravarProva("CONCLUIDO");
})().catch((e) => {
  acumulado.erro = e.stack || e.message;
  console.error("FATAL:", acumulado.erro);
  gravarProva("FATAL");
  process.exit(1);
});
