#!/usr/bin/env node
/**
 * 2026-09-24_simulacao_75c33ee1_estorno_agregado.cjs
 *
 * Cartao 75c33ee1 (#439, Animar Imagem sobrescreve video pago).
 * Johnny APROVOU o estorno agregado (1.010.200 cr liquidos, 183 alunos) COM
 * CONDICOES: backup antes, rodar SO em simulacao, entregar antes/depois.
 * Este script e a SIMULACAO.
 *
 * ⛔ SO LEITURA NO BANCO. NAO grava, NAO roda DDL, NAO estorna.
 *    A unica escrita e em ARQUIVO LOCAL (/mnt/Data): backup + tabela.
 *
 * METODOLOGIA — reproduzida da medicao da nota 6 do cartao (17/09 16:48Z,
 * prova 2026-09-17_rotina_falhas_17h...md), reconstruida empiricamente em
 * 24/09 ate bater EXATO (ver controle positivo abaixo):
 *  - Debitos: credit_transactions ref_type='image_video' amount<0, ate o corte
 *    2026-09-17T16:37:25Z (ultimo evento do razao na medicao aprovada),
 *    agrupados por (user_id, ref_id=id da imagem). Num grupo com N despachos,
 *    os N-1 primeiros foram SOBRESCRITOS pelo ultimo.
 *  - Estornos: ref_type IN ('image_video_refund','generation_refund'),
 *    amount>0, ate o mesmo corte, casados por (user_id, ref_id) — NUNCA por
 *    kind (estorno grava kind='extra_purchase').
 *  - LIQUIDO: grupo com QUALQUER estorno casado sai INTEIRO da conta; grupo
 *    sem estorno entra com todos os sobrescritos. (E assim, e nao por
 *    subtracao, que o 398/1.010.200/183 fecha. Efeito colateral que o numero
 *    aprovado CARREGA: 2 grupos com estorno PARCIAL — residual 20.860 cr —
 *    ficaram fora. Reportado na saida; decisao sobre eles nao e minha.)
 *
 * CONTROLE POSITIVO: o corte congelado TEM que reproduzir EXATAMENTE
 * 398 despachos / 1.010.200 cr / 183 alunos e 2.310 despachos totais no corte.
 * Se nao bater, ABORTA sem simular — numero aprovado nao se ajusta em silencio.
 *
 * Armadilhas cobertas: paginacao (Supabase corta em 1000), error cru impresso,
 * estorno por ref_type e nao por kind.
 */
const fs = require("node:fs");
const path = require("node:path");
const { supa } = require("./_comum.cjs");

const CORTE_APROVADO = "2026-09-17T16:37:25+00:00";
const OUT_DIR = "/mnt/Data/Projetos/PlatformLucasArrial/_frank/prova";

async function paginar(db, montar) {
  const PASSO = 1000;
  let de = 0, tudo = [];
  for (;;) {
    const { data, error } = await montar(db).range(de, de + PASSO - 1);
    if (error) { console.error("ERRO CRU DO SUPABASE:", JSON.stringify(error)); process.exit(1); }
    tudo = tudo.concat(data || []);
    if (!data || data.length < PASSO) break;
    de += PASSO;
  }
  return tudo;
}

/** Metodologia G (a da medicao aprovada). */
function medir(debitos, estornos, corteIso) {
  const corte = corteIso ? new Date(corteIso).getTime() : Infinity;
  const deb = debitos.filter(d => new Date(d.created_at).getTime() <= corte);
  const est = estornos.filter(e => new Date(e.created_at).getTime() <= corte);

  const grupos = new Map();
  for (const d of deb) {
    const k = d.user_id + "|" + d.ref_id;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(d);
  }
  for (const l of grupos.values()) l.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const estPorChave = new Map();
  for (const e of est) {
    const k = e.user_id + "|" + e.ref_id;
    if (!grupos.has(k)) continue;
    if (!estPorChave.has(k)) estPorChave.set(k, []);
    estPorChave.get(k).push(e);
  }

  let brutoDespachos = 0, brutoCr = 0, liqDespachos = 0, liqCr = 0;
  const brutoAlunos = new Set();
  const porAluno = new Map(); // uid -> { despachos, bruto, gruposEstornados, liquido }
  const gruposParciais = [];

  for (const [k, lista] of grupos) {
    if (lista.length < 2) continue;
    const sobre = lista.slice(0, -1);
    const somaSobre = sobre.reduce((s, d) => s + Math.abs(d.amount), 0);
    const uid = lista[0].user_id;
    brutoDespachos += sobre.length; brutoCr += somaSobre; brutoAlunos.add(uid);
    if (!porAluno.has(uid)) porAluno.set(uid, { despachos: 0, bruto: 0, gruposEstornados: 0, liquido: 0 });
    const a = porAluno.get(uid);
    a.despachos += sobre.length; a.bruto += somaSobre;

    const ests = estPorChave.get(k) || [];
    if (ests.length > 0) {
      a.gruposEstornados++;
      const somaEst = ests.reduce((s, e) => s + Math.abs(e.amount), 0);
      if (somaSobre - somaEst > 0) {
        gruposParciais.push({ chave: k, sobrescrito: somaSobre, estornado: somaEst, residual_fora_do_aprovado: somaSobre - somaEst });
      }
      continue; // grupo estornado sai INTEIRO (metodologia da medicao aprovada)
    }
    liqDespachos += sobre.length; liqCr += somaSobre;
    a.liquido += somaSobre;
  }

  const alunosLiquidos = [...porAluno.entries()].filter(([, v]) => v.liquido > 0);
  return {
    totalDespachosNoCorte: deb.length,
    bruto: { despachos: brutoDespachos, creditos: brutoCr, alunos: brutoAlunos.size },
    liquido: { despachos: liqDespachos, creditos: liqCr, alunos: alunosLiquidos.length },
    porAluno, alunosLiquidos, gruposParciais,
  };
}

(async () => {
  const db = supa();

  console.log("== 1. Lendo o razao (paginado, 1000 em 1000) ==");
  const debitos = await paginar(db, (d) => d.from("credit_transactions")
    .select("id,user_id,ref_id,amount,created_at")
    .eq("ref_type", "image_video").lt("amount", 0)
    .order("created_at", { ascending: true }));
  console.log("debitos image_video (todo o historico):", debitos.length);

  const estornos = await paginar(db, (d) => d.from("credit_transactions")
    .select("id,user_id,ref_id,ref_type,amount,created_at")
    .in("ref_type", ["image_video_refund", "generation_refund"]).gt("amount", 0)
    .order("created_at", { ascending: true }));
  console.log("estornos (image_video_refund + generation_refund):", estornos.length);

  console.log("\n== 2. CONTROLE POSITIVO — corte congelado em", CORTE_APROVADO, "==");
  const congelado = medir(debitos, estornos, CORTE_APROVADO);
  console.log("despachos totais no corte:", congelado.totalDespachosNoCorte, "(prova de 17/09: 2310)");
  console.log("BRUTO   :", JSON.stringify(congelado.bruto), "(aprovado: 451 / 1.122.940 / 195)");
  console.log("LIQUIDO :", JSON.stringify(congelado.liquido), "(aprovado: 398 / 1.010.200 / 183)");
  const ok = congelado.totalDespachosNoCorte === 2310
    && congelado.liquido.despachos === 398 && congelado.liquido.creditos === 1010200 && congelado.liquido.alunos === 183
    && congelado.bruto.despachos === 451 && congelado.bruto.creditos === 1122940 && congelado.bruto.alunos === 195;
  if (!ok) {
    console.error("\n⛔ CONTROLE POSITIVO FALHOU. A metodologia NAO reproduz o numero aprovado. PARANDO sem simular.");
    process.exit(2);
  }
  console.log("✅ bate EXATO com a medicao aprovada, nos 7 numeros.");
  if (congelado.gruposParciais.length) {
    console.log("\n⚠️ FORA do numero aprovado (estorno PARCIAL — o metodo da medicao zera o grupo inteiro):");
    for (const g of congelado.gruposParciais) console.log("  ", JSON.stringify(g));
    const somaRes = congelado.gruposParciais.reduce((s, g) => s + g.residual_fora_do_aprovado, 0);
    console.log("   residual total FORA do aprovado:", somaRes, "cr — decisao sobre isso nao e minha; registrado.");
  }

  console.log("\n== 3. Medicao VIVA (mesma metodologia, sem corte) — so pra reportar o delta ==");
  const vivo = medir(debitos, estornos, null);
  console.log("BRUTO   :", JSON.stringify(vivo.bruto));
  console.log("LIQUIDO :", JSON.stringify(vivo.liquido));
  console.log("(delta liquido vs aprovado: despachos", vivo.liquido.despachos - 398,
    "| cr", vivo.liquido.creditos - 1010200, "| alunos", vivo.liquido.alunos - 183, ")");

  console.log("\n== 4. BACKUP dos perfis do conjunto APROVADO (183) ==");
  const ids = congelado.alunosLiquidos.map(([uid]) => uid);
  const perfis = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from("profiles")
      .select("id,email,plan,credits_subscription,credits_extra")
      .in("id", ids.slice(i, i + 100));
    if (error) { console.error("ERRO CRU perfis:", JSON.stringify(error)); process.exit(1); }
    perfis.push(...(data || []));
  }
  console.log("perfis esperados:", ids.length, "| encontrados:", perfis.length);
  const achados = new Set(perfis.map(p => p.id));
  const sumidos = ids.filter(id => !achados.has(id));
  if (sumidos.length) console.log("⚠️ PERFIS NAO ENCONTRADOS (conta apagada?) — NOMEANDO:", JSON.stringify(sumidos));

  const agoraIso = new Date().toISOString();
  const dia = agoraIso.slice(0, 10);
  const backupPath = path.join(OUT_DIR, `${dia}_backup_75c33ee1_perfis_antes.json`);
  fs.writeFileSync(backupPath, JSON.stringify({
    gerado_em: agoraIso,
    cartao: "75c33ee1-4e1d-496d-9f1c-81027ea40b0e",
    corte_aprovado: CORTE_APROVADO,
    numero_aprovado: { despachos: 398, creditos: 1010200, alunos: 183 },
    perfis_sumidos: sumidos,
    perfis: perfis.map(p => ({
      id: p.id, email: p.email, plan: p.plan,
      credits_subscription: p.credits_subscription,
      credits_extra: p.credits_extra,
      saldo_total: (p.credits_subscription || 0) + (p.credits_extra || 0),
    })).sort((a, b) => a.email.localeCompare(b.email)),
  }, null, 2));
  console.log("backup gravado:", backupPath, `(${perfis.length} perfis)`);

  console.log("\n== 5. SIMULACAO antes/depois (NADA gravado no banco) ==");
  // O estorno entraria como credito EXTRA (caminho de producao ja usado no
  // proprio cartao, caso Tonimek: RPC add_extra_credits, ref_type=image_video_refund).
  const porId = new Map(perfis.map(p => [p.id, p]));
  const linhas = [];
  let somaEstorno = 0, negativosDepois = 0, estornosNegativos = 0;
  for (const [uid, v] of congelado.alunosLiquidos) {
    if (v.liquido < 0) estornosNegativos++;
    somaEstorno += v.liquido;
    const p = porId.get(uid);
    if (!p) { linhas.push({ id: uid, email: "(PERFIL NAO ENCONTRADO)", estorno_simulado: v.liquido }); continue; }
    const antesSub = p.credits_subscription || 0, antesExt = p.credits_extra || 0;
    const antes = antesSub + antesExt;
    const depoisExt = antesExt + v.liquido;
    const depois = antesSub + depoisExt;
    if (depois < 0) negativosDepois++;
    linhas.push({
      id: uid, email: p.email,
      despachos_sobrescritos_do_aluno: v.despachos, grupos_ja_estornados: v.gruposEstornados,
      estorno_simulado: v.liquido,
      antes_sub: antesSub, antes_extra: antesExt, antes_total: antes,
      depois_sub: antesSub, depois_extra: depoisExt, depois_total: depois,
    });
  }
  linhas.sort((a, b) => (b.estorno_simulado || 0) - (a.estorno_simulado || 0));

  const tabelaPath = path.join(OUT_DIR, `${dia}_simulacao_75c33ee1_antes_depois.json`);
  fs.writeFileSync(tabelaPath, JSON.stringify({
    gerado_em: agoraIso, corte_aprovado: CORTE_APROVADO,
    metodologia: "grupo (aluno+imagem) com estorno casado por ref_type+ref_id sai inteiro; sobrescrito = todos menos o ultimo despacho do grupo; estorno simulado entra em credits_extra (add_extra_credits, ref_type=image_video_refund)",
    numero_vivo_hoje: vivo.liquido,
    grupos_parciais_fora_do_aprovado: congelado.gruposParciais,
    somatorio: { alunos: linhas.length, estorno_total: somaEstorno, saldos_negativos_depois: negativosDepois, estornos_negativos: estornosNegativos },
    linhas,
  }, null, 2));
  console.log("tabela gravada:", tabelaPath);

  console.log("\n== SOMATORIO ==");
  console.log("alunos:", linhas.length);
  console.log("estorno total simulado:", somaEstorno, "cr (aprovado: 1.010.200)");
  console.log("saldos NEGATIVOS depois:", negativosDepois, "| estornos negativos (sinal de erro de calculo):", estornosNegativos);

  console.log("\n== TABELA (30 maiores estornos) ==");
  console.log("email | desp.sobrescritos | ESTORNO | antes sub+extra=total -> depois total");
  for (const l of linhas.slice(0, 30)) {
    console.log(`${l.email} | ${l.despachos_sobrescritos_do_aluno} | +${l.estorno_simulado} | ${l.antes_sub}+${l.antes_extra}=${l.antes_total} -> ${l.depois_total}`);
  }
  console.log("\n⛔ NADA FOI GRAVADO EM PRODUCAO. DDL NAO RODOU. Simulacao pura, esperando a conferencia do Johnny.");
})();
