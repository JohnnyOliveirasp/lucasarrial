#!/usr/bin/env node
/**
 * ESTORNA os 525 cr do César, cobrados por uma imagem que nunca chegou e cuja
 * linha foi APAGADA antes de qualquer estorno poder acontecer (#b5073c91).
 *
 * ── O caso, medido em 19/09 ───────────────────────────────────────────────
 * cesarsantos.gestor@gmail.com tem 5 débitos `image_generation` no ledger e
 * apenas 4 linhas em `image_generations`. O débito órfão é
 * `508e6d11-e46a-4ba3-94a0-17bcd7e6521b`, -525 às 11:08:19Z. Dezenove minutos
 * depois, às 11:27Z, ele escalou pela Fast dizendo que a imagem estava presa
 * girando. As outras QUATRO estão lá, todas `ready`: ele não limpa histórico —
 * apagou exatamente a que não funcionou.
 *
 * ⚠️ POR QUE ISTO NÃO É O "DÉBITO ÓRFÃO NORMAL" DA ORDEM DE 20/08. Aquela
 * armadilha diz, com razão, que débito sem linha é NORMAL: o aluno recebe a
 * imagem, apaga do histórico, e o ref fica pendurado. Medi a classe inteira
 * hoje: 1.113 órfãos, 317 pessoas, 653.886 cr desde 01/07 — a esmagadora
 * maioria é gente arrumando a própria galeria, e estornar isso seria devolver
 * dinheiro de trabalho ENTREGUE. Não é o que este script faz.
 *
 * O que separa ESTE do resto são três medidas, não o palpite:
 *   1. ele reclamou 19 min depois do débito, e a queixa está registrada fora do
 *      nosso banco (escalação da Fast, 11:27Z) — testemunha contemporânea;
 *   2. ele guardou as outras quatro; a taxa de apagar dele é 1 em 5, e a
 *      apagada é justamente a da queixa;
 *   3. `generate/route.ts` insere a linha (268) ANTES de debitar (288) e aborta
 *      se o insert falha (284). Logo a linha EXISTIU e foi apagada — não é
 *      "cobrou sem nunca criar".
 *
 * ── O furo estrutural que este caso expõe (não consertado aqui) ───────────
 * O estorno de imagem mora SÓ dentro de `failImageGeneration`, que precisa da
 * linha. O DELETE de `/api/v1/images` (route.ts:128-153) não seleciona nem olha
 * `status`: apaga `pending`/`generating` igual apaga `ready`. Ou seja, a única
 * ação que a tela oferece pra escapar do spinner infinito é exatamente a que
 * destrói o objeto que poderia devolver o dinheiro — e, junto, a prova de que
 * a casa devia. Depois de apagada, ninguém mais consegue distinguir "entregou e
 * o aluno limpou" de "nunca entregou e o aluno desistiu". Cartão à parte.
 *
 * O CAMINHO É O DE PRODUÇÃO: `add_extra_credits` (RPC) com
 * ref_type='image_refund' e ref_id = id da geração, o mesmo par que
 * `images/finalize.ts` usa. Insert na mão em credit_transactions não atualiza
 * saldo e criaria extrato que não bate.
 *
 * ARMADILHAS RESPEITADAS:
 *   - confere estorno por ref_type CASADO COM ref_id, nunca por `kind`;
 *   - relê o ledger antes de gravar: se já existe estorno casado, PULA;
 *   - EXIGE exatamente 1 débito e 0 estornos, e que o débito seja DELE;
 *   - depois de gravar, CONFERE NO BANCO (linha + saldo), não na fala da RPC.
 *
 * Sem `--confirmar` ele SIMULA.
 *
 * USO: node _frank/ferramentas/2026-09-19_estornar_geracao_apagada_sem_entregar.cjs [--confirmar]
 */
const { supa } = require("./_comum.cjs");
const { REF_TYPES_ESTORNO } = require("./_estornos.cjs");

const EMAIL = "cesarsantos.gestor@gmail.com";
const GERACAO = "508e6d11-e46a-4ba3-94a0-17bcd7e6521b";
const CONFIRMAR = process.argv.includes("--confirmar");

(async () => {
  const db = supa();

  const { data: profs, error: ep } = await db.from("profiles")
    .select("id,email,display_name,credits_subscription,credits_extra").eq("email", EMAIL);
  if (ep) { console.error("ERRO profiles:", ep.message); process.exit(1); }
  if (profs.length !== 1) { console.error(`esperava 1 perfil, achei ${profs.length} — pare e confira à mão.`); process.exit(1); }
  const p = profs[0];
  const saldoAntes = (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
  console.log(`ALUNO: ${p.email} (${p.display_name || "-"})  saldo=${saldoAntes}`);

  // 1) a linha REALMENTE não existe? (se existir, o caso é outro e eu paro)
  const { data: gs, error: eg } = await db.from("image_generations")
    .select("id,status,created_at").eq("id", GERACAO);
  if (eg) { console.error("ERRO image_generations:", eg.message); process.exit(1); }
  if (gs.length) {
    console.error(`a linha EXISTE (status=${gs[0].status}) — este script é só pro caso apagado. PARE.`);
    process.exit(1);
  }
  console.log(`LINHA ${GERACAO.slice(0, 8)}: não existe em image_generations (apagada) — confirmado.`);

  // 2) débito e estorno casados por ref_id (NUNCA por kind)
  const { data: tx, error: et } = await db.from("credit_transactions").select("*").eq("ref_id", GERACAO);
  if (et) { console.error("ERRO credit_transactions:", et.message); process.exit(1); }
  const debitos = tx.filter(t => t.amount < 0);
  const jaEstornado = tx.filter(t => t.amount > 0 && REF_TYPES_ESTORNO.includes(t.ref_type));
  console.log(`LEDGER do ref_id: ${tx.length} linha(s) · débitos=${debitos.length} · estornos=${jaEstornado.length}`);
  for (const t of tx) console.log(`  ${t.amount > 0 ? "+" : ""}${t.amount} ${t.ref_type} (kind=${t.kind}) ${t.created_at}`);

  if (jaEstornado.length) { console.log("\nJA ESTORNADO — não devolvo em dobro. Nada a fazer."); return; }
  if (debitos.length !== 1) { console.error(`\nesperava exatamente 1 débito, achei ${debitos.length} — pare e confira à mão.`); process.exit(1); }
  if (debitos[0].user_id !== p.id) { console.error("\no débito NÃO é dele — pare."); process.exit(1); }

  const valor = -debitos[0].amount;
  console.log(`\nPLANO: devolver +${valor} créditos (ref_type=image_refund, ref_id=${GERACAO.slice(0, 8)})`);
  console.log("MOTIVO: cobrado às 11:08:19Z, reclamou às 11:27Z que girava sem parar, e a linha foi apagada antes de qualquer estorno poder rodar.");
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
