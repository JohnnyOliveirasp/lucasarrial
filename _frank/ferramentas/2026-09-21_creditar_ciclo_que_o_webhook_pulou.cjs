#!/usr/bin/env node
/**
 * CREDITA o ciclo pago que o webhook PULOU por causa do e-mail divergente.
 *
 * ── O caso, medido em 21/09 ───────────────────────────────────────────────
 * `webhooks/hotmart/route.ts` (~261) resolve o dono da compra SÓ pelo
 * `buyer_email`. Quem compra com um e-mail e cria a conta com outro cai no
 * ramo errado: o alarme de "compra órfã" dispara E o crédito do mês é pulado.
 * O vínculo certo existe o tempo todo em `entitlements.user_id` — tanto que o
 * resgate do login (`claim.ts`) busca por `user_id` e funciona. Só o caminho
 * do PAGAMENTO usa e-mail. O conserto do webhook está com o coder; isto aqui
 * é a REMEDIAÇÃO das duas pessoas que já foram atingidas.
 *
 * DOIS ALUNOS, ZERO LINHA NO LEDGER desde que compraram:
 *   Marcio Fernandes   conta cdmarciofernandes@gmail.com (compra ...@hotmail)
 *                      trx HP1509025099, pagou 10/08, acesso venceu 10/09
 *   Fernanda Franzolin conta ftfranzolin@gmail.com (compra fnfranzolin@hotmail)
 *                      trx HP0304698101, pagou 11/08, acesso venceu 11/09
 * Os dois logaram UMA vez, no próprio cadastro (`last_sign_in_at` = o segundo
 * seguinte ao `created_at`), viram a conta vazia e nunca mais voltaram.
 *
 * E ficaram fora do socorro automático: `claim.ts` pula entitlement com
 * `access_until <= agora`. Enquanto estavam no prazo, ninguém logou; agora que
 * venceu, o resgate nunca mais roda pra eles. Sem esta mão, ficam assim.
 *
 * ⚠️ AUTORIZAÇÃO: Johnny, 21/09, explícito — "libera em créditos para eles".
 * A regra permanente é não estornar por iniciativa própria; aqui não é
 * iniciativa minha e não é estorno na Hotmart (que nunca é meu): é entregar o
 * crédito do ciclo que eles PAGARAM e que o nosso webhook não entregou.
 *
 * ── Por que crédito RESOLVE, mesmo com o acesso vencido ───────────────────
 * Conferido no código hoje, não suposto:
 *   - `app/[locale]/app/layout.tsx:95` — "Entrada LIVRE: todo usuário logado
 *     entra na plataforma e vê os menus. O paywall não bloqueia mais o acesso".
 *   - `voice-cloning/page.tsx:66` — `canTrain = team || creditsTotal >= COST`.
 *   - `voices/[id]/start-training/route.ts:102-121` — a trava é
 *     `bal.total < TRAINING_CREDIT_COST`; `access_until` só é lido DENTRO desse
 *     ramo, e apenas pra escolher o texto do botão do popup. Com saldo, o ramo
 *     não roda.
 * Ou seja: o portão é SALDO, não `access_until`. Por isso o crédito sozinho
 * basta pra eles voltarem a usar o que pagaram.
 *
 * ── A chave do crédito é a TRANSAÇÃO, de propósito ────────────────────────
 * `ref_id` = a transação da compra (HP...), o MESMO par que o webhook usaria
 * (`extractTransactionId`) e que `claim.ts` consulta na trava anti-crédito-
 * duplo. Assim, quando o conserto do webhook entrar e qualquer reprocessamento
 * passar por essa transação, a deduplicação enxerga que já foi creditado e não
 * paga em dobro. Inventar uma chave nova aqui criaria exatamente esse risco.
 *
 * ARMADILHAS RESPEITADAS:
 *   - relê o ledger ANTES de gravar: `subscription_grant` com este `ref_id` já
 *     existente => PULA (não credita em dobro);
 *   - exige que o `user_id` alvo seja o MESMO que está no entitlement daquela
 *     transação — não confia no e-mail, que é justamente o dado furado;
 *   - CONFERE NO BANCO depois (linha no ledger + saldo), não na fala da RPC;
 *   - usa a RPC de produção `grant_subscription_credits`, não INSERT na mão
 *     (insert não mexe no saldo e cria extrato que não bate).
 *
 * ⚠️ O QUE ESTE SCRIPT NÃO FAZ: não mexe em `access_until` nem em `plan`. A
 * decisão do Johnny foi "libera em créditos". Se depois ele quiser devolver
 * também a janela de acesso, é outra decisão e outro script.
 *
 * ⚠️ EFEITO COLATERAL QUE A RPC DIRETA NÃO TEM: chamada pelo app,
 * `grantSubscriptionCredits` ainda roda `perdoarNegativoDoOnboarding` e
 * `destravarAvisoDeCredito`. Aqui eu chamo a RPC crua. Confirmado que não faz
 * falta nestes dois casos: ambos têm `credits_extra = 0` (o perdão só age em
 * negativo) e nenhum dos dois tem voz treinada (o aviso gravado de "você tem
 * 0 créditos" nunca chegou a existir). O script RECUSA se essa premissa não
 * valer, em vez de seguir no escuro.
 *
 * Sem `--confirmar` ele SIMULA.
 *
 * USO: node _frank/ferramentas/2026-09-21_creditar_ciclo_que_o_webhook_pulou.cjs [--confirmar]
 */
const { supa } = require("./_comum.cjs");

const VALOR = 100000; // PLAN_MONTHLY_CREDITS (credits/config.ts:7)
const CONFIRMAR = process.argv.includes("--confirmar");

const ALVOS = [
  { email: "cdmarciofernandes@gmail.com", trx: "HP1509025099", nome: "Marcio Fernandes" },
  { email: "ftfranzolin@gmail.com", trx: "HP0304698101", nome: "Fernanda Franzolin" },
];

(async () => {
  const db = supa();
  const plano = [];

  for (const alvo of ALVOS) {
    console.log(`\n── ${alvo.nome} <${alvo.email}> trx=${alvo.trx}`);

    const { data: profs, error: ep } = await db.from("profiles")
      .select("id,email,display_name,credits_subscription,credits_extra,access_until,plan")
      .eq("email", alvo.email);
    if (ep) { console.error("ERRO profiles:", ep.message); process.exit(1); }
    if (profs.length !== 1) { console.error(`esperava 1 perfil, achei ${profs.length} — PARE.`); process.exit(1); }
    const p = profs[0];
    const saldoAntes = (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
    console.log(`  perfil ${p.id.slice(0, 8)} · plan=${p.plan} · saldo=${saldoAntes} (sub=${p.credits_subscription} extra=${p.credits_extra}) · acesso_ate=${p.access_until}`);

    // O e-mail é o dado FURADO deste bug — então o vínculo tem de vir do
    // entitlement da transação, e ele tem de bater com o perfil que achei.
    const { data: ents, error: ee } = await db.from("entitlements")
      .select("id,user_id,buyer_email,status,raw_event");
    if (ee) { console.error("ERRO entitlements:", ee.message); process.exit(1); }
    const daTrx = (ents ?? []).filter((e) => {
      const t = JSON.stringify(e.raw_event ?? {});
      return t.includes(alvo.trx);
    });
    if (daTrx.length !== 1) { console.error(`  esperava 1 entitlement com a trx, achei ${daTrx.length} — PARE.`); process.exit(1); }
    const ent = daTrx[0];
    if (ent.user_id !== p.id) { console.error(`  o entitlement aponta pra ${ent.user_id} e nao pra ${p.id} — PARE.`); process.exit(1); }
    console.log(`  entitlement ${ent.id.slice(0, 8)} · compra=${ent.buyer_email} · status=${ent.status} · user_id CONFERE`);

    // Premissa dos efeitos colaterais que a RPC crua não executa.
    if ((p.credits_extra ?? 0) < 0) { console.error("  credits_extra NEGATIVO — o perdao do onboarding faria falta. PARE."); process.exit(1); }
    const { count: vozes, error: ev } = await db.from("voices")
      .select("id", { count: "exact", head: true }).eq("user_id", p.id);
    if (ev) { console.error("ERRO voices:", ev.message); process.exit(1); }
    if ((vozes ?? 0) > 0) { console.error(`  tem ${vozes} voz(es) — o aviso gravado de credito pode existir. PARE e cheque a mao.`); process.exit(1); }
    console.log(`  vozes=${vozes} · credits_extra=${p.credits_extra} — efeitos colaterais da RPC nao fazem falta`);

    // TRAVA ANTI-CRÉDITO-DUPLO: pela transação, igual claim.ts.
    const { data: tx, error: et } = await db.from("credit_transactions")
      .select("id,amount,kind,ref_type,created_at").eq("user_id", p.id).eq("ref_id", alvo.trx);
    if (et) { console.error("ERRO ledger:", et.message); process.exit(1); }
    if (tx.length) {
      console.log(`  JA EXISTE ${tx.length} linha(s) com este ref_id — PULO (nao credito em dobro).`);
      for (const t of tx) console.log(`    ${t.amount} ${t.kind}/${t.ref_type} ${t.created_at}`);
      continue;
    }
    const { count: qualquer } = await db.from("credit_transactions")
      .select("id", { count: "exact", head: true }).eq("user_id", p.id);
    console.log(`  ledger: 0 linha(s) com este ref_id · ${qualquer ?? 0} linha(s) no total`);

    plano.push({ p, alvo, saldoAntes });
    console.log(`  -> CREDITAR +${VALOR} (ref_type=payment_event, ref_id=${alvo.trx})`);
  }

  console.log(`\nPLANO: ${plano.length} pessoa(s) × ${VALOR} cr`);
  if (!plano.length) { console.log("nada a fazer."); return; }
  if (!CONFIRMAR) { console.log("(ENSAIO — nada gravado. Repita com --confirmar.)"); return; }

  for (const { p, alvo, saldoAntes } of plano) {
    const { data, error } = await db.rpc("grant_subscription_credits", {
      p_user_id: p.id, p_amount: VALOR, p_ref_type: "payment_event", p_ref_id: alvo.trx,
    });
    if (error) { console.error(`RPC FALHOU (${alvo.email}):`, error.message); process.exit(1); }
    console.log(`\nRPC ${alvo.email} ->`, JSON.stringify(data));

    // CONFERE NO BANCO, não na fala da RPC.
    const { data: linhas } = await db.from("credit_transactions")
      .select("amount,kind,ref_type,ref_id,created_at,balance_after")
      .eq("user_id", p.id).eq("ref_id", alvo.trx);
    for (const t of linhas ?? []) console.log(`  CONFERIDO ${t.amount > 0 ? "+" : ""}${t.amount} ${t.kind}/${t.ref_type} ${t.created_at} saldo_apos=${t.balance_after}`);
    if (!linhas?.length) { console.log("  ⚠️  ZERO linha no ledger — a RPC falou e nao gravou. NAO diga que creditou."); continue; }

    const { data: p2 } = await db.from("profiles")
      .select("credits_subscription,credits_extra").eq("id", p.id);
    const saldoDepois = (p2[0].credits_subscription ?? 0) + (p2[0].credits_extra ?? 0);
    console.log(`  SALDO: ${saldoAntes} -> ${saldoDepois} (delta ${saldoDepois - saldoAntes}, esperado ${VALOR})`);
    if (saldoDepois - saldoAntes !== VALOR) console.log("  ⚠️  DELTA NAO BATE — confira a mao antes de afirmar que entregou.");
  }
})();
