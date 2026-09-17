#!/usr/bin/env node
/**
 * ESTORNA o video PAGO que o defeito do #439 sobrescreveu, caso a caso.
 *
 * POR QUE EXISTE. O #439 apaga o video anterior porque a key do R2 e por ID da
 * IMAGEM (`imageVideoKey`, video-sync.ts:50): despachar de novo sobrescreve
 * `video.mp4` e a row guarda um `video_kie_task_id` so. A perna do
 * consentimento subiu em 17/09 13:53Z (PR #326, merge cff9f6c) e NAO conserta o
 * defeito — e o QA provou que no mobile, com video carregado, o aviso nasce
 * FORA DA TELA (card 40c21ef4). Consertar o codigo nao devolve o dinheiro.
 *
 * CAMINHO DE PRODUCAO, de proposito: RPC `add_extra_credits` com
 * `ref_type='image_video_refund'` e `ref_id` = id da IMAGEM — exatamente o que
 * `frontend/src/lib/images/video-sync.ts:129` usa quando a casa estorna sozinha.
 * Insert na mao em `credit_transactions` nao atualiza saldo e cria extrato que
 * nao bate.
 *
 * ARMADILHAS RESPEITADAS:
 *   - estorno se confere por ref_type CASADO COM ref_id, nunca por `kind`
 *     (o estorno grava kind='extra_purchase'); filtrar por kind faz parecer que
 *     ninguem foi estornado e quase pagou 13 alunos em dobro (20/08).
 *   - rele o ledger ANTES de gravar: se ja existe estorno casado, PULA.
 *   - depois de gravar, CONFERE NO BANCO relendo a linha e o saldo.
 *   - TETO 9-B: <= 20.000 cr por caso, e soma do DIA INTEIRO (do banco) < 100k.
 *
 * SEM --confirmar ele SIMULA e nao grava nada.
 * USO: node 2026-09-17_estornar_video_sobrescrito.cjs <uuid-da-imagem> [--confirmar]
 */
const { supa } = require("./_comum.cjs");

const IMG = (process.argv[2] || "").trim();
const CONFIRMAR = process.argv.includes("--confirmar");
const TETO_CASO = 20000, TETO_DIA = 100000;
if (!/^[0-9a-f-]{36}$/i.test(IMG)) { console.error("uso: ... <uuid-da-imagem> [--confirmar]"); process.exit(1); }

(async () => {
  const db = supa();

  // 1) os despachos pagos desta imagem
  const { data: desp, error: e1 } = await db.from("credit_transactions")
    .select("id,user_id,amount,created_at,note").eq("ref_type", "image_video")
    .eq("ref_id", IMG).lt("amount", 0).order("created_at", { ascending: true });
  if (e1) { console.error("ERRO ledger:", e1.message); process.exit(1); }
  if (desp.length < 2) { console.error(`imagem tem ${desp.length} despacho(s) — nada foi sobrescrito. PARANDO.`); process.exit(1); }
  const USER = desp[0].user_id;
  console.log(`IMAGEM ${IMG}`);
  console.log(`despachos pagos: ${desp.length}`);
  for (const d of desp) console.log(`  ${d.created_at} · ${d.amount} cr · ${d.note}`);

  // sobrescritos = todos menos o ultimo; devolve a soma deles
  const sobrescritos = desp.slice(0, -1);
  const valor = sobrescritos.reduce((a, d) => a + Math.abs(d.amount), 0);
  console.log(`SOBRESCRITOS: ${sobrescritos.length} · A DEVOLVER: ${valor} cr`);
  if (valor > TETO_CASO) { console.error(`🔴 ${valor} > teto de ${TETO_CASO}/caso (9-B) — PARA E CHAMA O JOHNNY.`); process.exit(1); }

  // 2) ja foi estornado? confere por ref_type casado com ref_id
  const { data: ja, error: e2 } = await db.from("credit_transactions")
    .select("id,amount,ref_type,created_at").eq("ref_id", IMG).gt("amount", 0);
  if (e2) { console.error("ERRO ao reler estornos:", e2.message); process.exit(1); }
  if (ja.length) {
    console.log("JA ESTORNADO — pulando (este e o falso negativo que paga em dobro):");
    for (const t of ja) console.log(`  +${t.amount} ${t.ref_type} ${t.created_at}`);
    process.exit(0);
  }

  // 3) teto do DIA, somado do banco
  const HOJE = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
  const { data: dia, error: e3 } = await db.from("credit_transactions")
    .select("amount,ref_type").gte("created_at", HOJE).gt("amount", 0);
  if (e3) { console.error("ERRO teto do dia:", e3.message); process.exit(1); }
  const devolvidoHoje = dia.filter(t => t.ref_type !== "payment_event").reduce((a, t) => a + t.amount, 0);
  console.log(`DEVOLVIDO HOJE (do banco, exclui payment_event): ${devolvidoHoje} cr`);
  if (devolvidoHoje + valor > TETO_DIA) { console.error(`🔴 ${devolvidoHoje}+${valor} passa do teto diario ${TETO_DIA} (9-B) — CONGELA E CHAMA.`); process.exit(1); }

  const { data: p } = await db.from("profiles").select("id,email,display_name,credits_subscription,credits_extra").eq("id", USER);
  const antes = (p[0].credits_subscription ?? 0) + (p[0].credits_extra ?? 0);
  console.log(`ALUNO: ${p[0].email} (${p[0].display_name || "-"}) saldo_antes=${antes}`);

  if (!CONFIRMAR) { console.log("\n[ENSAIO] nada gravado. rode com --confirmar pra valer."); process.exit(0); }

  // 4) grava pelo caminho de producao
  const { data: rpc, error: e4 } = await db.rpc("add_extra_credits", {
    p_user_id: USER, p_amount: valor,
    p_ref_type: "image_video_refund", p_ref_id: IMG,
  });
  if (e4) { console.error("🔴 RPC FALHOU:", e4.message); process.exit(1); }
  console.log("RPC ->", JSON.stringify(rpc));

  // 5) CONFERE NO BANCO, nao na fala da RPC
  const { data: dep, error: e5 } = await db.from("credit_transactions")
    .select("amount,ref_type,ref_id,created_at,balance_after,kind").eq("ref_id", IMG).gt("amount", 0);
  if (e5) { console.error("ERRO ao conferir:", e5.message); process.exit(1); }
  console.log(`CONFERIDO NO BANCO: ${dep.length} linha(s)`);
  for (const t of dep) console.log(`  +${t.amount} ${t.ref_type} kind=${t.kind} ${t.created_at} saldo_apos=${t.balance_after}`);
  const { data: p2 } = await db.from("profiles").select("credits_subscription,credits_extra").eq("id", USER);
  const depoisSaldo = (p2[0].credits_subscription ?? 0) + (p2[0].credits_extra ?? 0);
  console.log(`saldo: ${antes} -> ${depoisSaldo} (delta ${depoisSaldo - antes})`);
  if (dep.length !== 1 || depoisSaldo - antes !== valor) { console.error("🔴 O BANCO NAO CONFIRMA O ESTORNO. NAO declare feito."); process.exit(1); }
  console.log("OK: estorno confirmado pelo banco.");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
