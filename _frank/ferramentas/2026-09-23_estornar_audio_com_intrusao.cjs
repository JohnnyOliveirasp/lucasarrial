#!/usr/bin/env node
/**
 * ESTORNA áudio que o portão entregou como pronto tendo TODOS os pedaços
 * sinalizados por INTRUSÃO — conteúdo falado que não está no texto do aluno.
 * (incidente #530 / 7fb9e7e3, família do #52)
 *
 * ── Por que é irmão, e não cópia, do estornar_audio_entregue_com_defeito ──
 * Aquele script trata FALTA: `faltantes_total > 0`, texto que não foi falado.
 * Este trata SOBRA, que é o defeito oposto e tem telemetria oposta:
 *     faltantes_total .... 0        <- não falta nada
 *     coverage_medio ..... 1        <- cobertura perfeita
 *     intrusion_flagged .. 18 de 18 <- e ainda assim TODO pedaço acusa intrusão
 * Um script só, com uma guarda só, deixaria um dos dois casos passar batido.
 * Por isso a guarda aqui é `intrusion_flagged == intrusion_checked > 0`, e não
 * "tem alguma coisa errada no qa".
 *
 * ── A TAXA-BASE, medida antes de chamar isto de defeito ───────────────────
 * Em 777 gerações `ready` com telemetria nos últimos 14 dias:
 *     média de pedaços sinalizados .... 2,46
 *     fração média sinalizada ......... 17,6%
 *     com 100% sinalizado ............. 7   (0,9%)
 * Ou seja: sinalizar alguma intrusão é COMUM e não prova nada sozinho. O que é
 * raro é 100%. Sem essa medida eu estaria devolvendo dinheiro em cima de um
 * número que quase toda geração tem.
 *
 * ⚠️ O QUE ESTE SCRIPT NÃO AFIRMA: que o áudio "está ruim". Eu não ouço áudio.
 * Ele afirma o que a telemetria da CASA registrou (todo pedaço acusando
 * conteúdo fora do texto) e o que o ALUNO relatou (uma frase que não está no
 * texto, repetida a cada parágrafo). As duas coisas batem, e é isso que
 * sustenta a devolução — não um palpite sobre a gravação.
 *
 * ⚠️ POR QUE ref_id = ID DA GERAÇÃO, e não a chave "inc530-..." sugerida no
 * recado: é o pareamento que `estorno_confere.cjs` e a trava anti-duplo usam.
 * Uma chave inventada fica órfã: nenhuma varredura futura casa o estorno com o
 * débito, e o próximo que olhar vai concluir que este aluno nunca foi devolvido.
 *
 * ARMADILHAS RESPEITADAS:
 *  - confere por `ref_type` + `ref_id`, NUNCA por `kind` (o estorno grava
 *    kind='extra_purchase'; filtrar por kind já quase pagou em dobro a 13);
 *  - relê o ledger ANTES de gravar: estorno casado existente => PULA;
 *  - exige 1 débito, 0 estornos, e que a geração seja DO aluno;
 *  - CONFERE NO BANCO depois de gravar, não na fala da RPC.
 *
 * Sem `--confirmar` ele SIMULA.
 *
 * USO: node _frank/ferramentas/2026-09-23_estornar_audio_com_intrusao.cjs [--confirmar]
 */
const { supa } = require("./_comum.cjs");

const EMAIL = "dnoronhajr@gmail.com";
const GERACAO = "65f26a72-c8d2-4da0-ae72-51b2aa5adbc1";
const VALOR = 684;
const CONFIRMAR = process.argv.includes("--confirmar");

(async () => {
  const db = supa();

  const { data: profs, error: ep } = await db.from("profiles")
    .select("id,email,credits_subscription,credits_extra").eq("email", EMAIL);
  if (ep) { console.error("ERRO profiles:", ep.message); process.exit(1); }
  if (profs.length !== 1) { console.error(`esperava 1 perfil, achei ${profs.length} — PARE.`); process.exit(1); }
  const p = profs[0];
  const saldoAntes = (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
  console.log(`perfil ${p.id.slice(0, 8)} · saldo=${saldoAntes}`);

  const { data: gs, error: eg } = await db.from("generations")
    .select("id,user_id,status,qa,elapsed_seconds,text_raw").eq("id", GERACAO);
  if (eg) { console.error("ERRO generations:", eg.message); process.exit(1); }
  if (gs.length !== 1) { console.error("geração não encontrada — PARE."); process.exit(1); }
  const g = gs[0];
  if (g.user_id !== p.id) { console.error("a geração NÃO é deste aluno — PARE."); process.exit(1); }

  const qa = g.qa ?? {};
  const flag = Number(qa.intrusion_flagged ?? 0);
  const chk = Number(qa.intrusion_checked ?? 0);
  console.log(`geração ${GERACAO.slice(0, 8)} · status=${g.status} · ${g.elapsed_seconds}s · ${String(g.text_raw ?? "").length} chars`);
  console.log(`  intrusão: ${flag} de ${chk} pedaço(s) sinalizado(s)`);
  console.log(`  faltantes_total=${qa.faltantes_total} · coverage_medio=${qa.coverage_medio} · regens=${qa.regens}`);
  if (!(chk > 0 && flag === chk)) {
    console.error("  a guarda deste script é 100% dos pedaços sinalizados. Não é o caso aqui — PARE.");
    console.error("  (intrusão parcial é COMUM: média de 17,6% em 777 gerações. Não devolve dinheiro.)");
    process.exit(1);
  }

  // TRAVA ANTI-ESTORNO-DUPLO, pelo ref_id.
  const { data: linhas, error: el } = await db.from("credit_transactions")
    .select("amount,kind,ref_type,ref_id,created_at").eq("ref_id", GERACAO);
  if (el) { console.error("ERRO ledger:", el.message); process.exit(1); }
  const debitos = linhas.filter((t) => t.amount < 0);
  const estornos = linhas.filter((t) => t.amount > 0);
  console.log(`ledger deste ref_id: ${debitos.length} débito(s), ${estornos.length} estorno(s)`);
  for (const t of linhas) console.log(`  ${t.amount > 0 ? "+" : ""}${t.amount} ${t.kind}/${t.ref_type} ${t.created_at}`);
  if (estornos.length) { console.log("JÁ ESTORNADO — não pago em dobro. Nada a fazer."); return; }
  if (debitos.length !== 1) { console.error(`esperava 1 débito, achei ${debitos.length} — PARE.`); process.exit(1); }
  if (Math.abs(debitos[0].amount) !== VALOR) {
    console.error(`o débito é ${debitos[0].amount}, não -${VALOR} — PARE.`); process.exit(1);
  }

  console.log(`\nPLANO: devolver ${VALOR} cr (ref_type=generation_refund, ref_id=${GERACAO})`);
  if (!CONFIRMAR) { console.log("(ENSAIO — nada gravado. Repita com --confirmar.)"); return; }

  const { data, error } = await db.rpc("add_extra_credits", {
    p_user_id: p.id, p_amount: VALOR, p_ref_type: "generation_refund", p_ref_id: GERACAO,
  });
  if (error) { console.error("RPC FALHOU:", error.message); process.exit(1); }
  console.log("RPC ->", JSON.stringify(data));

  const { data: depois, error: e2 } = await db.from("credit_transactions")
    .select("amount,ref_type,kind,created_at,balance_after").eq("ref_id", GERACAO).gt("amount", 0);
  if (e2) { console.error("ERRO ao reler:", e2.message); process.exit(1); }
  console.log(`CONFERIDO NO BANCO: ${depois.length} linha(s) de estorno`);
  for (const t of depois) console.log(`  +${t.amount} ${t.ref_type} (kind=${t.kind}) ${t.created_at} saldo_apos=${t.balance_after}`);
  if (!depois.length) { console.log("⚠️  ZERO linha — a RPC falou e não gravou. NÃO diga que estornou."); process.exit(1); }

  const { data: p2 } = await db.from("profiles").select("credits_subscription,credits_extra").eq("id", p.id);
  const saldoDepois = (p2[0].credits_subscription ?? 0) + (p2[0].credits_extra ?? 0);
  console.log(`SALDO: ${saldoAntes} -> ${saldoDepois} (delta ${saldoDepois - saldoAntes}, esperado ${VALOR})`);
  if (saldoDepois - saldoAntes !== VALOR) console.log("⚠️  DELTA NÃO BATE — confira à mão.");
})();
