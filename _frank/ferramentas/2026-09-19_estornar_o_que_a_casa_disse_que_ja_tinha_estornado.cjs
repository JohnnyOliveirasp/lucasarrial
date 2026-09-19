#!/usr/bin/env node
/**
 * ESTORNA os 400 créditos da Katia que a casa AFIRMOU POR ESCRITO já ter
 * devolvido — e não tinha (incidente 70633cab / cartão #473).
 *
 * ── Por que este estorno sai, e por que a razão NÃO é a qualidade do áudio ──
 * Em 17/09 08:50Z (Enviados uid 2606) a casa escreveu pra ela, palavra por
 * palavra: "Os 400 créditos que foram cobrados já voltaram automaticamente pra
 * sua conta."
 *
 * Medido em 19/09 no ledger, por ref_id (nunca por kind): a geração
 * 019c58d1 tem UMA linha, `-400` em 16/09 15:08. Estorno nenhum. O último
 * estorno dela é de 12/09 e é de OUTRA geração (b6df1a7e, também 400) — que é
 * provavelmente o que a Fast viu e leu como sendo esta. É exatamente a
 * armadilha que a ordem de 20/08 manda evitar: estorno se confere por ref_type
 * CASADO COM ref_id.
 *
 * Então a aluna está 400 créditos no negativo desde 16/09 acreditando que não
 * está, porque a gente disse que não estava. Devolver aqui não é devolver por
 * insatisfação (a regra do Johnny é clara: não se estorna por limite técnico do
 * produto). É honrar uma frase que a casa já mandou por escrito. Deixar essa
 * carta de pé sem o crédito atrás dela é a casa mentindo de graça.
 *
 * ⚠️ O QUE ESTE ESTORNO NÃO AFIRMA. Ele NÃO afirma que o áudio dela saiu
 * defeituoso. Medido em 19/09 sobre 825 entregas `ready` de 14 dias:
 *   · `exhausted >= 1` (o worker esgotou as tentativas e entregou assim mesmo)
 *     aparece em 242 delas — 29%;
 *   · o `rate_global_fator` 0.866 dela cai na faixa 0.850–0.899, que sozinha
 *     tem 220 das 272 entregas com essa métrica — 81%.
 * Ou seja, os números que o recado apresentou como prova de defeito descrevem o
 * COMPORTAMENTO NORMAL da casa, não uma anomalia da geração dela. Quem quiser
 * tratar isso como defeito tem que tratar em 29% da base, e essa é decisão de
 * produto do Johnny — já registrada em qa-veredito.ts e ainda não tomada.
 *
 * O CAMINHO É O DE PRODUÇÃO: `add_extra_credits` (RPC) com
 * ref_type='generation_refund' e ref_id = id da geração. Insert na mão em
 * credit_transactions não atualiza saldo e criaria extrato que não bate.
 *
 * ARMADILHAS RESPEITADAS (ordem de 20/08 + _estornos.cjs):
 *   - confere estorno por ref_type CASADO COM ref_id, nunca por `kind`;
 *   - relê o ledger antes de gravar: se já existe estorno casado, PULA;
 *   - depois de gravar, CONFERE NO BANCO (linha + saldo), não na fala da RPC.
 *
 * Sem `--confirmar` ele SIMULA.
 *
 * USO: node _frank/ferramentas/2026-09-19_estornar_o_que_a_casa_disse_que_ja_tinha_estornado.cjs [--confirmar]
 */
const { supa } = require("./_comum.cjs");
const { REF_TYPES_ESTORNO } = require("./_estornos.cjs");

const EMAIL = "katiasalvador32@gmail.com";
const GERACAO = "019c58d1-5eb9-410f-aa0a-66b4dcc399d8";
const CONFIRMAR = process.argv.includes("--confirmar");

(async () => {
  const db = supa();

  const { data: profs, error: ep } = await db.from("profiles")
    .select("id,email,display_name,credits_subscription,credits_extra").eq("email", EMAIL);
  if (ep) { console.error("ERRO profiles:", ep.message); process.exit(1); }
  if (profs.length !== 1) { console.error(`esperava 1 perfil, achei ${profs.length} — pare e confira à mão.`); process.exit(1); }
  const p = profs[0];
  const saldoAntes = (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
  console.log(`ALUNA: ${p.email} (${p.display_name || "-"})  saldo=${saldoAntes}`);

  // 1) a geração existe, está pronta e é dela?
  const { data: gs, error: eg } = await db.from("generations")
    .select("id,user_id,created_at,status,duration_seconds,error_message,qa").eq("id", GERACAO);
  if (eg) { console.error("ERRO generations:", eg.message); process.exit(1); }
  if (!gs.length) { console.error("geração não existe — pare."); process.exit(1); }
  const g = gs[0];
  if (g.user_id !== p.id) { console.error("a geração NÃO é dela — pare."); process.exit(1); }
  console.log(`GERACAO ${g.id.slice(0, 8)} ${g.created_at} status=${g.status} dur=${g.duration_seconds}s erro=${g.error_message ?? "null"}`);
  console.log(`  qa: exhausted=${g.qa?.exhausted} regens=${g.qa?.regens} fator=${g.qa?.rate_global_fator} faltantes=${g.qa?.faltantes_total}`);
  if (g.status !== "ready") { console.error("geração não está ready — o caso é outro, pare."); process.exit(1); }

  // 2) débito e estorno casados por ref_id (NUNCA por kind)
  const { data: tx, error: et } = await db.from("credit_transactions").select("*").eq("ref_id", GERACAO);
  if (et) { console.error("ERRO credit_transactions:", et.message); process.exit(1); }
  const debito = tx.filter(t => t.amount < 0).reduce((a, b) => a + b.amount, 0);
  const jaEstornado = tx.filter(t => t.amount > 0 && REF_TYPES_ESTORNO.includes(t.ref_type));
  console.log(`LEDGER do ref_id: ${tx.length} linha(s) · debito=${debito} · estornos=${jaEstornado.length}`);
  for (const t of tx) console.log(`  ${t.amount > 0 ? "+" : ""}${t.amount} ${t.ref_type} (kind=${t.kind}) ${t.created_at}`);

  if (jaEstornado.length) { console.log("\nJA ESTORNADO — não devolvo em dobro. Nada a fazer."); return; }
  if (debito === 0) { console.error("\nsem débito casado — pare e confira à mão."); process.exit(1); }

  const valor = -debito;
  console.log(`\nPLANO: devolver +${valor} créditos (ref_type=generation_refund, ref_id=${GERACAO.slice(0, 8)})`);
  console.log("MOTIVO: a carta de 17/09 (uid 2606) já disse a ela que isto tinha sido feito.");
  if (!CONFIRMAR) { console.log("(ENSAIO — nada gravado. Repita com --confirmar para valer.)"); return; }

  const { data, error } = await db.rpc("add_extra_credits", {
    p_user_id: p.id, p_amount: valor, p_ref_type: "generation_refund", p_ref_id: GERACAO,
  });
  if (error) { console.error("RPC FALHOU:", error.message); process.exit(1); }
  console.log("RPC ->", JSON.stringify(data));

  // 3) CONFERE NO BANCO, não na fala da RPC
  const { data: depois, error: e2 } = await db.from("credit_transactions")
    .select("amount,ref_type,kind,ref_id,created_at,balance_after").eq("ref_id", GERACAO).gt("amount", 0);
  if (e2) { console.error("ERRO ao reler:", e2.message); process.exit(1); }
  console.log(`CONFERIDO NO BANCO: ${depois.length} linha(s) de estorno`);
  for (const t of depois) console.log(`  +${t.amount} ${t.ref_type} (kind=${t.kind}) ${t.created_at} saldo_apos=${t.balance_after}`);

  const { data: p2 } = await db.from("profiles").select("credits_subscription,credits_extra").eq("id", p.id);
  const saldoDepois = (p2[0].credits_subscription ?? 0) + (p2[0].credits_extra ?? 0);
  console.log(`SALDO: ${saldoAntes} -> ${saldoDepois} (delta ${saldoDepois - saldoAntes}, esperado ${valor})`);
  if (saldoDepois - saldoAntes !== valor) console.log("⚠️  DELTA NAO BATE — não diga que devolveu até conferir à mão.");
  if (!depois.length) console.log("⚠️  ZERO linhas de estorno no banco — a RPC falou e não gravou. NÃO diga que devolveu.");
})();
