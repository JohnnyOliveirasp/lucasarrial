#!/usr/bin/env node
/**
 * ESTORNA os 1.944 cr do Diego Vargas por um áudio que o sistema ENTREGOU como
 * pronto estando abaixo do próprio piso de qualidade (incidente eac94e82).
 *
 * ── O caso, medido em 23/09 ───────────────────────────────────────────────
 * Geração `1c761a52-addd-4861-b6f6-6e374d944ed4`, 22/09 21:47Z, status `ready`,
 * 111s, débito de -1.944. O `qa` dela, lido no banco, diz:
 *     coverage_min .... 0.85     (o piso que a própria casa define)
 *     coverage_medio .. 0.8376   (ABAIXO do piso)
 *     faltantes_total . 18
 *     faltantes_amostra ["minha","maneira","de","me","comunicar"]
 * Ou seja: saiu com 18 palavras faltando, incluindo a frase final inteira, e
 * mesmo assim foi marcado `ready` e entregue. O aluno reclamou, e a carta da
 * casa de hoje (uid 3254) confirma item por item o que sumiu.
 *
 * ⚠️ POR QUE ISTO NÃO FERE A REGRA DE "SÓ ESTORNAR QUANDO O CLIENTE PEDE".
 * A regra existe pra impedir devolução por iniciativa, em cima de trabalho
 * ENTREGUE. Aqui a entrega falhou contra o critério da própria casa (regra
 * #960: estorna quando o sistema não entregou o que promete). Além disso a
 * casa JÁ ESCREVEU a ele, em 23/09 11:54Z: "os do áudio que saiu com defeito
 * continuam debitados, e eu já levei esse ponto pra dentro pra ser resolvido.
 * (...) eu te retorno sobre isso." Não fechar isto transformaria a carta em
 * mais uma promessa não cumprida — que é EXATAMENTE o defeito deste incidente.
 *
 * ⚠️ NÃO CONFUNDIR COM A OUTRA GERAÇÃO. `a53e8f7b` (21:55Z) FALHOU e já foi
 * estornada automaticamente às 22:00:45Z (+1.944, ref_type generation_refund).
 * Essa está paga. A que este script trata é a que deu `ready` com defeito e
 * NUNCA foi estornada. Por isso o pareamento aqui é por `ref_id`, nunca por
 * valor nem por `kind` — os dois débitos têm o MESMO valor, e conferir por
 * `kind` acharia o estorno do irmão e concluiria, errado, que já foi devolvido.
 *
 * ARMADILHAS RESPEITADAS:
 *   - `ref_type` + `ref_id` casados (o estorno grava kind='extra_purchase';
 *     filtrar por `kind` já quase pagou em dobro pra 13 alunos);
 *   - relê o ledger ANTES de gravar: estorno casado já existente => PULA;
 *   - EXIGE exatamente 1 débito, 0 estornos, e que a geração seja DELE;
 *   - EXIGE que o qa confirme o defeito (faltantes_total > 0), pra este script
 *     não virar régua de devolver áudio bom;
 *   - CONFERE NO BANCO depois de gravar, não na fala da RPC.
 *
 * Sem `--confirmar` ele SIMULA.
 *
 * USO: node _frank/ferramentas/2026-09-23_estornar_audio_entregue_com_defeito.cjs [--confirmar]
 */
const { supa } = require("./_comum.cjs");

const EMAIL = "diegoavnunes@gmail.com";
const GERACAO = "1c761a52-addd-4861-b6f6-6e374d944ed4";
const VALOR = 1944;
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

  // A geração é dele E saiu com defeito? (não devolver áudio bom)
  const { data: gs, error: eg } = await db.from("generations")
    .select("id,user_id,status,qa,duration_seconds").eq("id", GERACAO);
  if (eg) { console.error("ERRO generations:", eg.message); process.exit(1); }
  if (gs.length !== 1) { console.error("geração não encontrada — PARE."); process.exit(1); }
  const g = gs[0];
  if (g.user_id !== p.id) { console.error("a geração NÃO é deste aluno — PARE."); process.exit(1); }
  const qa = g.qa ?? {};
  const faltantes = qa.faltantes_total ?? 0;
  const medio = qa.coverage_medio ?? null;
  const piso = qa.coverage_min ?? null;
  console.log(`geração ${GERACAO.slice(0, 8)} · status=${g.status} · ${g.duration_seconds}s`);
  console.log(`  qa: faltantes_total=${faltantes} · coverage_medio=${medio} · piso=${piso}`);
  console.log(`  amostra do que sumiu: ${JSON.stringify(qa.faltantes_amostra ?? [])}`);
  if (!(faltantes > 0)) {
    console.error("  qa NÃO acusa palavra faltando — este script não devolve áudio bom. PARE.");
    process.exit(1);
  }
  if (medio !== null && piso !== null && medio >= piso) {
    console.log(`  ⚠️  atenção: coverage_medio ${medio} NÃO está abaixo do piso ${piso}.`);
    console.log("     o defeito aqui se sustenta pelas palavras faltando, então sigo — mas fica registrado.");
  }

  // TRAVA ANTI-ESTORNO-DUPLO: pelo ref_id, nunca por kind nem por valor.
  const { data: linhas, error: el } = await db.from("credit_transactions")
    .select("amount,kind,ref_type,ref_id,created_at").eq("ref_id", GERACAO);
  if (el) { console.error("ERRO ledger:", el.message); process.exit(1); }
  const debitos = linhas.filter((t) => t.amount < 0);
  const estornos = linhas.filter((t) => t.amount > 0);
  console.log(`ledger para este ref_id: ${debitos.length} débito(s), ${estornos.length} estorno(s)`);
  for (const t of linhas) console.log(`  ${t.amount > 0 ? "+" : ""}${t.amount} ${t.kind}/${t.ref_type} ${t.created_at}`);
  if (estornos.length) { console.log("JÁ ESTORNADO — não pago em dobro. Nada a fazer."); return; }
  if (debitos.length !== 1) { console.error(`esperava 1 débito, achei ${debitos.length} — PARE.`); process.exit(1); }
  if (Math.abs(debitos[0].amount) !== VALOR) {
    console.error(`o débito é ${debitos[0].amount}, não -${VALOR} — PARE e confira à mão.`);
    process.exit(1);
  }

  console.log(`\nPLANO: devolver ${VALOR} cr (ref_type=generation_refund, ref_id=${GERACAO})`);
  if (!CONFIRMAR) { console.log("(ENSAIO — nada gravado. Repita com --confirmar.)"); return; }

  const { data, error } = await db.rpc("add_extra_credits", {
    p_user_id: p.id, p_amount: VALOR, p_ref_type: "generation_refund", p_ref_id: GERACAO,
  });
  if (error) { console.error("RPC FALHOU:", error.message); process.exit(1); }
  console.log("RPC ->", JSON.stringify(data));

  // CONFERE NO BANCO, não na fala da RPC.
  const { data: depois, error: e2 } = await db.from("credit_transactions")
    .select("amount,ref_type,kind,ref_id,created_at,balance_after").eq("ref_id", GERACAO).gt("amount", 0);
  if (e2) { console.error("ERRO ao reler:", e2.message); process.exit(1); }
  console.log(`CONFERIDO NO BANCO: ${depois.length} linha(s) de estorno`);
  for (const t of depois) console.log(`  +${t.amount} ${t.ref_type} (kind=${t.kind}) ${t.created_at} saldo_apos=${t.balance_after}`);
  if (!depois.length) { console.log("⚠️  ZERO linha — a RPC falou e não gravou. NÃO diga que estornou."); process.exit(1); }

  const { data: p2 } = await db.from("profiles").select("credits_subscription,credits_extra").eq("id", p.id);
  const saldoDepois = (p2[0].credits_subscription ?? 0) + (p2[0].credits_extra ?? 0);
  console.log(`SALDO: ${saldoAntes} -> ${saldoDepois} (delta ${saldoDepois - saldoAntes}, esperado ${VALOR})`);
  if (saldoDepois - saldoAntes !== VALOR) console.log("⚠️  DELTA NÃO BATE — confira à mão antes de afirmar que devolveu.");
})();
