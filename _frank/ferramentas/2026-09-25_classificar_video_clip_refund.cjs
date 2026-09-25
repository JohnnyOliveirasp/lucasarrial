#!/usr/bin/env node
/**
 * PROVA (só leitura) de que classe é o ref_type `video_clip_refund`.
 *
 * A varredura de 25/09 acusou `video_clip_refund` como ref_type que nenhuma das
 * duas listas de `_estornos.cjs` classifica. É a QUINTA reincidência da mesma
 * classe (#185 studio_audio, #342 perdao/compensation, 19/09 edicao_broll,
 * 20/09 video_clip_refund_backfill, agora esta).
 *
 * ⚠️ Cuidado com o vizinho: `video_clip_refund_backfill` JÁ está cadastrado em
 * REF_TYPES_ESTORNO. Este aqui é OUTRO nome, sem o sufixo, e nasceu fora da
 * lista — exatamente o buraco que o próprio comentário do _estornos.cjs previu:
 * "todo refundRefType novo nasce fora da lista".
 *
 * O MÉTODO É O DA CASA (o mesmo que classificou `compensation` em 10/09):
 * não se decide pelo NOME. Casa o `ref_id` com o débito e soma o sinal.
 *   débito -N + crédito +N = 0  ->  É DEVOLUÇÃO.
 * Se sobrar saldo negativo, também se olha o irmão `video_clip_regen`, que
 * debita a regeração de clipe numa linha própria (foi ele que fez três alunos
 * PARECEREM estornados a maior em 20/09).
 *
 * NÃO ESCREVE NADA. Só imprime o veredito pra quem for cadastrar em UMA das
 * duas listas de _frank/ferramentas/_estornos.cjs.
 *
 * USO: node _frank/ferramentas/2026-09-25_classificar_video_clip_refund.cjs
 */
const { supa } = require("./_comum.cjs");

const ALVO = "video_clip_refund";
/** Débitos que podem compor o valor devolvido no mesmo ref_id. */
const DEBITOS_IRMAOS = ["video_clips", "video_clip_regen", "video_clip"];

(async () => {
  const db = supa();

  // 1) Todas as linhas do ref_type alvo.
  const { data: alvo, error: errAlvo } = await db
    .from("credit_transactions")
    .select("id, user_id, ref_id, ref_type, amount, created_at")
    .eq("ref_type", ALVO);
  if (errAlvo) throw new Error(`credit_transactions[${ALVO}]: ${errAlvo.message}`);

  if (!alvo?.length) {
    console.log(`Nenhuma linha com ref_type='${ALVO}'. Nada a classificar.`);
    return;
  }

  console.log(`ref_type '${ALVO}': ${alvo.length} linha(s)`);
  const refIds = [...new Set(alvo.map((l) => l.ref_id).filter(Boolean))];
  console.log(`ref_id distintos: ${refIds.length}`);
  const semRef = alvo.filter((l) => !l.ref_id).length;
  if (semRef) console.log(`⚠️  ${semRef} linha(s) SEM ref_id — essas não dá pra casar.`);

  // 2) Todas as linhas que compartilham esses ref_id (qualquer ref_type).
  const vizinhos = [];
  for (let i = 0; i < refIds.length; i += 200) {
    const lote = refIds.slice(i, i + 200);
    const { data, error } = await db
      .from("credit_transactions")
      .select("id, user_id, ref_id, ref_type, amount, created_at")
      .in("ref_id", lote);
    if (error) throw new Error(`credit_transactions[vizinhos]: ${error.message}`);
    vizinhos.push(...(data ?? []));
  }

  const porRef = new Map();
  for (const l of vizinhos) {
    if (!porRef.has(l.ref_id)) porRef.set(l.ref_id, []);
    porRef.get(l.ref_id).push(l);
  }

  let zeram = 0;
  let sobraNegativa = 0;
  let sobraPositiva = 0;
  let semDebito = 0;
  const exemplos = [];

  for (const refId of refIds) {
    const linhas = porRef.get(refId) ?? [];
    const soma = linhas.reduce((s, l) => s + Number(l.amount ?? 0), 0);
    const temDebito = linhas.some(
      (l) => Number(l.amount ?? 0) < 0 && DEBITOS_IRMAOS.includes(String(l.ref_type)),
    );
    const detalhe = linhas
      .map((l) => `${l.ref_type} ${Number(l.amount) > 0 ? "+" : ""}${l.amount}`)
      .join(" · ");

    if (!temDebito) {
      semDebito++;
      if (exemplos.length < 12) exemplos.push(`  SEM DEBITO IRMAO  ${refId.slice(0, 12)} → ${detalhe}`);
      continue;
    }
    if (soma === 0) {
      zeram++;
      if (exemplos.length < 12) exemplos.push(`  ZEROU             ${refId.slice(0, 12)} → ${detalhe} = 0`);
    } else if (soma < 0) {
      sobraNegativa++;
      if (exemplos.length < 12) exemplos.push(`  SOBRA NEGATIVA    ${refId.slice(0, 12)} → ${detalhe} = ${soma}`);
    } else {
      sobraPositiva++;
      if (exemplos.length < 12) exemplos.push(`  SOBRA POSITIVA    ${refId.slice(0, 12)} → ${detalhe} = ${soma}`);
    }
  }

  console.log("\n=== CASAMENTO ref_id (débito + crédito) ===");
  console.log(`  zeram exatamente ......... ${zeram}`);
  console.log(`  sobra negativa ........... ${sobraNegativa}  (devolveu MENOS que o débito)`);
  console.log(`  sobra positiva ........... ${sobraPositiva}  (devolveu MAIS que o débito — investigar)`);
  console.log(`  sem débito irmão ......... ${semDebito}  (não dá pra provar por este caminho)`);

  console.log("\n=== AMOSTRA ===");
  for (const e of exemplos) console.log(e);

  const provaveisDevolucao = zeram + sobraNegativa;
  const total = zeram + sobraNegativa + sobraPositiva + semDebito;
  console.log("\n=== VEREDITO ===");
  if (semDebito === total) {
    console.log("  NÃO PROVADO: nenhum ref_id casou com débito. Não cadastre no escuro.");
  } else if (provaveisDevolucao > 0 && provaveisDevolucao === total - semDebito) {
    console.log(
      `  É DEVOLUÇÃO. ${provaveisDevolucao}/${total - semDebito} ref_id casados anulam (ou abatem) um débito de clipe.`,
    );
    console.log(`  → cadastrar '${ALVO}' em REF_TYPES_ESTORNO (_frank/ferramentas/_estornos.cjs).`);
  } else {
    console.log(
      `  MISTO (${provaveisDevolucao} devolvem, ${sobraPositiva} sobram positivo, ${semDebito} sem prova).`,
    );
    console.log("  → NÃO cadastre ainda. Olhe os casos de sobra positiva um a um.");
  }
  if (semDebito > 0 && semDebito < total) {
    console.log(`  ⚠️  ${semDebito} ref_id ficaram SEM PROVA — o número acima é incompleto.`);
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
