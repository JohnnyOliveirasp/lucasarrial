#!/usr/bin/env node
/**
 * ESTORNA a geração que o botão "Gerar prompt automático" sabotou (#285/#270).
 *
 * POR QUE EXISTE. O #270 foi fechado em 15/09 com o defeito consertado em
 * produção (PR #297, merge `3e8af23`, 18:11Z) — mas a medição do próprio
 * conserto conta **22 gerações de 15 alunos** cuja atribuição de foto extra foi
 * apagada, e o casamento por `ref_id` mostra **25.525 créditos debitados e ZERO
 * estornados**. Consertar o código não devolveu o dinheiro de ninguém.
 *
 * O CAMINHO É O DE PRODUÇÃO, de propósito: `add_extra_credits` (RPC) com
 * `ref_type='image_refund'` e `ref_id` = id da geração — exatamente o que
 * `frontend/src/lib/images/finalize.ts:108,150` usa quando a casa estorna
 * sozinha. Insert na mão em `credit_transactions` não atualiza saldo e criaria
 * extrato que não bate.
 *
 * ⚠️ ARMADILHAS RESPEITADAS AQUI:
 *   - Estorno se confere por **ref_type casado com ref_id**, NUNCA por `kind`
 *     (o estorno grava `kind='extra_purchase'`). Ver `_estornos.cjs`.
 *   - Antes de gravar, relê o ledger: se JÁ existe estorno casado com aquela
 *     geração, PULA. É o falso negativo que paga em dobro.
 *   - Depois de gravar, **confere no banco** (não na fala da RPC): relê a linha
 *     e o saldo. Ensaio não é entrega.
 *
 * SEM `--confirmar` ele SIMULA e não grava nada.
 *
 * USO:
 *   node _frank/ferramentas/2026-09-16_estornar_foto_extra.cjs <email> [--confirmar]
 */
const { supa } = require("./_comum.cjs");

const CITA_EXTRA = /foto\s+extra|fotos\s+extras|imagem\s+extra|da\s+extra|nas\s+extras/i;
const REF_TYPES_ESTORNO = require("./_estornos.cjs").REF_TYPES_ESTORNO ?? [
  "image_refund", "video_clone_refund", "image_video_refund", "voice_train_refund",
  "generation_refund", "studio_scene_refund", "support_refund", "studio_audio_refund",
  "estorno_de_engano", "estorno",
];

const EMAIL = (process.argv[2] || "").trim().toLowerCase();
const CONFIRMAR = process.argv.includes("--confirmar");
if (!EMAIL) { console.error("uso: node 2026-09-16_estornar_foto_extra.cjs <email> [--confirmar]"); process.exit(1); }

(async () => {
  const db = supa();

  const { data: profs, error: ep } = await db.from("profiles")
    .select("id,email,display_name,credits_subscription,credits_extra").eq("email", EMAIL);
  if (ep) { console.error("ERRO profiles:", ep.message); process.exit(1); }
  if (!profs.length) { console.error("aluno sem perfil:", EMAIL); process.exit(1); }
  if (profs.length > 1) { console.error("MAIS DE UM PERFIL com esse e-mail — pare e confira à mão."); process.exit(1); }
  const p = profs[0];
  const saldoAntes = (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
  console.log(`ALUNO: ${p.email} (${p.display_name || "-"})  saldo=${saldoAntes}`);

  // 1) as gerações DELE em que a atribuição foi apagada
  const { data: gs, error: eg } = await db.from("image_generations")
    .select("id,created_at,idea,prompt,input_image_paths").eq("user_id", p.id).order("created_at");
  if (eg) { console.error("ERRO image_generations:", eg.message); process.exit(1); }
  const apagadas = gs
    .filter(g => (g.idea ?? "").trim() && (g.prompt ?? "").trim())
    .filter(g => Array.isArray(g.input_image_paths) && g.input_image_paths.length >= 2)
    .filter(g => CITA_EXTRA.test(g.idea))
    .filter(g => !CITA_EXTRA.test(g.prompt));
  console.log(`geracoes com atribuicao APAGADA: ${apagadas.length}`);
  if (!apagadas.length) { console.log("nada a estornar."); return; }

  // 2) débito e estorno JÁ existente, casados por ref_id (nunca por kind)
  const ids = apagadas.map(g => g.id);
  const { data: tx, error: et } = await db.from("credit_transactions").select("*").in("ref_id", ids);
  if (et) { console.error("ERRO credit_transactions:", et.message); process.exit(1); }

  const plano = [];
  for (const g of apagadas) {
    const linhas = tx.filter(t => String(t.ref_id) === String(g.id));
    const debito = linhas.filter(t => t.amount < 0).reduce((a, b) => a + b.amount, 0);
    const jaEstornado = linhas.filter(t => t.amount > 0 && REF_TYPES_ESTORNO.includes(t.ref_type));
    if (jaEstornado.length) {
      console.log(`  ${g.id.slice(0, 8)} ${g.created_at.slice(0, 16)}  debito=${debito}  JA ESTORNADO (${jaEstornado.map(x => x.ref_type + "+" + x.amount).join(",")}) -> PULA`);
      continue;
    }
    if (debito === 0) { console.log(`  ${g.id.slice(0, 8)} sem debito casado -> PULA`); continue; }
    plano.push({ id: g.id, em: g.created_at, valor: -debito });
    console.log(`  ${g.id.slice(0, 8)} ${g.created_at.slice(0, 16)}  debito=${debito}  -> ESTORNAR +${-debito}`);
  }
  const total = plano.reduce((a, b) => a + b.valor, 0);
  console.log(`\nTOTAL A ESTORNAR: ${total} creditos em ${plano.length} geracao(oes)`);
  if (!plano.length) return;

  if (!CONFIRMAR) { console.log("\n(ENSAIO — nada gravado. Repita com --confirmar para valer.)"); return; }

  // 3) grava pelo caminho de produção (o `supa()` já é service-role)
  for (const item of plano) {
    const { data, error } = await db.rpc("add_extra_credits", {
      p_user_id: p.id, p_amount: item.valor,
      p_ref_type: "image_refund", p_ref_id: item.id,
    });
    if (error) { console.error(`  FALHOU ${item.id.slice(0, 8)}: ${error.message}`); continue; }
    console.log(`  RPC ${item.id.slice(0, 8)} -> ${JSON.stringify(data)}`);
  }

  // 4) CONFERE NO BANCO (não na fala da RPC)
  const { data: depois, error: e2 } = await db.from("credit_transactions")
    .select("amount,ref_type,ref_id,created_at,balance_after").in("ref_id", plano.map(x => x.id)).gt("amount", 0);
  if (e2) { console.error("ERRO ao reler:", e2.message); process.exit(1); }
  console.log(`\nCONFERIDO NO BANCO: ${depois.length} linha(s) de estorno`);
  for (const t of depois) console.log(`  +${t.amount} ${t.ref_type} ${String(t.ref_id).slice(0, 8)} ${t.created_at} saldo_apos=${t.balance_after}`);

  const { data: p2 } = await db.from("profiles").select("credits_subscription,credits_extra").eq("id", p.id);
  const saldoDepois = (p2[0].credits_subscription ?? 0) + (p2[0].credits_extra ?? 0);
  console.log(`SALDO: ${saldoAntes} -> ${saldoDepois} (delta ${saldoDepois - saldoAntes}, esperado ${total})`);
  if (saldoDepois - saldoAntes !== total) console.log("⚠️  DELTA NAO BATE — confira a mao antes de dizer que devolveu.");
})();
