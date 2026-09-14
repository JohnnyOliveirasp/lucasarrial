/**
 * DEVOLVE o débito de onboarding do SGP que caiu na carteira de quem o
 * `perdoarNegativoDoOnboarding` NÃO alcança — o caso em que o
 * `subscription_grant` veio ANTES do débito, então o perdão rodou com
 * `credits_extra = 0` e saiu cedo (service.ts:155-160, `if (extra >= 0) return`).
 *
 * Réplica EXATA do que o `perdoarNegativoDoOnboarding` grava: mesmo
 * `kind='adjustment'`, mesmo `ref_type='perdao_negativo_onboarding'`, mesmo
 * `ref_id=<userId>`. Não invento tipo novo — tipo novo é o que faz a lista
 * canônica de estorno envelhecer calada (#185).
 *
 * TRAVAS, todas obrigatórias antes de gravar:
 *  1. o perfil existe e `credits_extra < 0`;
 *  2. existe débito de onboarding NO EXTRATO (`note ilike '%onboarding%'`) —
 *     negativo de outra causa não é nosso pra perdoar;
 *  3. existe pedido em `sgp_pedidos` (é o caminho do SGP, não o da planilha);
 *  4. o valor a devolver é <= 20.000 (regra 9-B, teto por caso);
 *  5. a soma do DIA (todas as devoluções, do banco, não da minha memória)
 *     depois desta operação continua <= 100.000 (regra 9-B, teto diário).
 *
 * Sem --confirmar, ENSAIA: imprime o que faria e não grava nada.
 * Confere o nº de linhas do .select() depois de gravar e RELÊ o perfil.
 */
const { supa } = require("../ferramentas/_comum.cjs");

const TETO_POR_CASO = 20000;
const TETO_DIARIO = 100000;

// Só os ref_type que significam "devolvemos crédito ao aluno". Grant de ciclo
// (`payment_event`/`stripe_session`) NÃO é devolução: somá-lo faz o teto diário
// parecer estourado por 1,1 milhão num dia normal de 11 renovações.
const DEVOLUCAO = [
  "image_refund", "video_clone_refund", "image_video_refund", "voice_train_refund",
  "generation_refund", "studio_scene_refund", "studio_audio_refund", "support_refund",
  "estorno_de_engano", "estorno", "perdao_negativo_onboarding", "reparo_falha_operacional",
];

const alvos = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const confirmar = process.argv.includes("--confirmar");

(async () => {
  const db = supa();

  const hoje = new Date().toISOString().slice(0, 10);
  const { data: doDia, error: eDia } = await db
    .from("credit_transactions")
    .select("amount, ref_type")
    .gt("amount", 0)
    .gte("created_at", `${hoje}T00:00:00Z`);
  if (eDia) throw new Error(`soma do dia falhou: ${eDia.message}`);
  const devolvidoHoje = (doDia ?? [])
    .filter((t) => DEVOLUCAO.includes(String(t.ref_type ?? "")))
    .reduce((s, t) => s + t.amount, 0);
  console.log(`devolvido hoje (só devolução, sem grant de ciclo): ${devolvidoHoje}`);
  console.log(`teto diário: ${TETO_DIARIO} — folga: ${TETO_DIARIO - devolvidoHoje}\n`);

  let acumulado = devolvidoHoje;

  for (const email of alvos) {
    console.log(`===== ${email} =====`);
    const { data: p, error: eP } = await db
      .from("profiles")
      .select("id, email, credits_subscription, credits_extra, plan, access_until")
      .eq("email", email)
      .maybeSingle();
    if (eP) throw new Error(`perfil: ${eP.message}`);
    if (!p) { console.log("  SEM PERFIL — pulado\n"); continue; }

    const extra = p.credits_extra ?? 0;
    const sub = p.credits_subscription ?? 0;
    console.log(`  sub=${sub} extra=${extra} plan=${p.plan} access_until=${p.access_until}`);

    if (extra >= 0) { console.log("  TRAVA 1: credits_extra não é negativo — nada a devolver\n"); continue; }

    const { data: deb, error: eDeb } = await db
      .from("credit_transactions")
      .select("id, amount, note, created_at")
      .eq("user_id", p.id)
      .ilike("note", "%onboarding%")
      .lt("amount", 0);
    if (eDeb) throw new Error(`extrato: ${eDeb.message}`);
    if (!deb?.length) { console.log("  TRAVA 2: nenhum débito de onboarding no extrato\n"); continue; }
    console.log(`  débitos de onboarding: ${deb.length} (${deb.reduce((s, t) => s + t.amount, 0)})`);

    const { data: ped, error: ePed } = await db
      .from("sgp_pedidos").select("id, status").eq("user_id", p.id).limit(1);
    if (ePed) throw new Error(`sgp_pedidos: ${ePed.message}`);
    if (!ped?.length) { console.log("  TRAVA 3: sem pedido no SGP — não é este caminho\n"); continue; }
    console.log(`  sgp_pedido: ${ped[0].status}`);

    const valor = -extra;
    if (valor > TETO_POR_CASO) { console.log(`  TRAVA 4: ${valor} passa do teto por caso (${TETO_POR_CASO}) — PARA E CHAMA\n`); continue; }
    if (acumulado + valor > TETO_DIARIO) { console.log(`  TRAVA 5: ${acumulado}+${valor} passa do teto diário — CONGELA E CHAMA\n`); continue; }

    if (!confirmar) { console.log(`  [ENSAIO] devolveria ${valor} → extra=0, saldo total ${sub}\n`); continue; }

    const { data: upd, error: eUpd } = await db
      .from("profiles")
      .update({ credits_extra: 0, updated_at: new Date().toISOString() })
      .eq("id", p.id)
      .eq("credits_extra", extra) // trava otimista: não grava se mudou no meio
      .select("id, credits_extra");
    if (eUpd) throw new Error(`update: ${eUpd.message}`);
    if ((upd?.length ?? 0) !== 1) throw new Error(`update afetou ${upd?.length ?? 0} linhas — ABORTADO`);

    const { data: ins, error: eIns } = await db
      .from("credit_transactions")
      .insert({
        user_id: p.id,
        kind: "adjustment",
        amount: valor,
        balance_after: sub,
        ref_type: "perdao_negativo_onboarding",
        ref_id: p.id,
        note:
          "Devolucao do debito de onboarding do SGP (ronda das falhas 10/09/2026). " +
          "O onboarding do SGP debitava da carteira do comprador o material que a casa " +
          "entrega (10.000 treino + 525 avatar); a causa foi corrigida em producao no " +
          "merge fdcba70 (PR #228). O perdao automatico nao alcancou este perfil porque " +
          "o subscription_grant veio ANTES do debito e o perdao saiu cedo (service.ts:159).",
      })
      .select("id");
    if (eIns) throw new Error(`insert: ${eIns.message}`);
    if ((ins?.length ?? 0) !== 1) throw new Error(`insert afetou ${ins?.length ?? 0} linhas — ABORTADO`);

    const { data: rele } = await db
      .from("profiles").select("credits_subscription, credits_extra").eq("id", p.id).maybeSingle();
    console.log(`  GRAVADO: +${valor} · linha ${ins[0].id}`);
    console.log(`  RELIDO DO BANCO: sub=${rele?.credits_subscription} extra=${rele?.credits_extra} total=${(rele?.credits_subscription ?? 0) + (rele?.credits_extra ?? 0)}\n`);
    acumulado += valor;
  }

  console.log(`total devolvido no dia depois desta rodada: ${acumulado}`);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
