#!/usr/bin/env node
/**
 * ESTORNA a geração de imagem que a aluna pagou e a TELA não mostrou (#310).
 *
 * POR QUE EXISTE. O #310 (thallitamachado@hotmail.com) nasceu 08/09 com
 * "imagem saiu preta, 525cr debitados". A ronda de 09/09 baixou o arquivo do R2
 * e PROVOU que ele está íntegro; a ronda de 17/09 OLHOU a imagem e confirmou:
 * é o retrato de jaleco no consultório, exatamente o que ela pediu. Ou seja, a
 * geração entregou e quem falhou foi a EXIBIÇÃO.
 *
 * O e-mail de 09/09 (Enviados uid 1410) condicionou a devolução à resposta
 * dela ("se você me disser que perdeu a geração por causa da tela, eu devolvo").
 * Ela nunca respondeu e ninguém voltou nela por 8,3 dias. Devolver condicionado
 * a uma resposta que a casa não foi buscar é a casa lucrando com o próprio
 * silêncio. Por isso o estorno sai AGORA, sem esperar.
 *
 * O QUE NÃO ESTOU AFIRMANDO: não provei que a tela dela mostrou preto. Provei
 * que o arquivo está bom e que ela NUNCA usou essa geração (nenhum débito
 * casado com o ref_id dela depois). A dúvida é nossa, e quem criou a dúvida
 * come a dúvida.
 *
 * O CAMINHO É O DE PRODUÇÃO: `add_extra_credits` (RPC) com
 * ref_type='image_refund' e ref_id = id da geração — o mesmo que
 * frontend/src/lib/images/finalize.ts:108,150 usa. Insert na mão em
 * credit_transactions não atualiza saldo e criaria extrato que não bate.
 *
 * ARMADILHAS RESPEITADAS (ordem de 20/08 + _estornos.cjs):
 *   - confere estorno por ref_type CASADO COM ref_id, nunca por `kind`
 *     (o estorno grava kind='extra_purchase');
 *   - relê o ledger antes de gravar: se já existe estorno casado, PULA;
 *   - depois de gravar, CONFERE NO BANCO (linha + saldo), não na fala da RPC.
 *
 * Sem `--confirmar` ele SIMULA.
 *
 * USO: node _frank/ferramentas/2026-09-17_estornar_imagem_que_a_tela_nao_mostrou.cjs [--confirmar]
 */
const { supa } = require("./_comum.cjs");
const { REF_TYPES_ESTORNO } = require("./_estornos.cjs");

const EMAIL = "thallitamachado@hotmail.com";
const GERACAO = "1723da64-2296-41c6-9f30-2f7c7f97f677";
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
  const { data: gs, error: eg } = await db.from("image_generations")
    .select("id,user_id,created_at,status,idea,image_path,error_message")
    .eq("id", GERACAO);
  if (eg) { console.error("ERRO image_generations:", eg.message); process.exit(1); }
  if (!gs.length) { console.error("geração não existe — pare."); process.exit(1); }
  const g = gs[0];
  if (g.user_id !== p.id) { console.error("a geração NÃO é dela — pare."); process.exit(1); }
  console.log(`GERACAO ${g.id.slice(0, 8)} ${g.created_at} status=${g.status} erro=${g.error_message ?? "null"}`);
  console.log(`  pedido: ${g.idea}`);
  if (g.status !== "ready") { console.error("geração não está ready — o caso é outro, pare."); process.exit(1); }

  // 2) débito e estorno casados por ref_id (NUNCA por kind)
  const { data: tx, error: et } = await db.from("credit_transactions")
    .select("*").eq("ref_id", GERACAO);
  if (et) { console.error("ERRO credit_transactions:", et.message); process.exit(1); }
  const debito = tx.filter(t => t.amount < 0).reduce((a, b) => a + b.amount, 0);
  const jaEstornado = tx.filter(t => t.amount > 0 && REF_TYPES_ESTORNO.includes(t.ref_type));
  console.log(`LEDGER do ref_id: ${tx.length} linha(s) · debito=${debito} · estornos=${jaEstornado.length}`);
  for (const t of tx) console.log(`  ${t.amount > 0 ? "+" : ""}${t.amount} ${t.ref_type} (kind=${t.kind}) ${t.created_at}`);

  if (jaEstornado.length) { console.log("\nJA ESTORNADO — não devolvo em dobro. Nada a fazer."); return; }
  if (debito === 0) { console.error("\nsem débito casado — pare e confira à mão."); process.exit(1); }

  const valor = -debito;
  console.log(`\nPLANO: devolver +${valor} créditos (ref_type=image_refund, ref_id=${GERACAO.slice(0, 8)})`);
  if (!CONFIRMAR) { console.log("(ENSAIO — nada gravado. Repita com --confirmar para valer.)"); return; }

  const { data, error } = await db.rpc("add_extra_credits", {
    p_user_id: p.id, p_amount: valor, p_ref_type: "image_refund", p_ref_id: GERACAO,
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
