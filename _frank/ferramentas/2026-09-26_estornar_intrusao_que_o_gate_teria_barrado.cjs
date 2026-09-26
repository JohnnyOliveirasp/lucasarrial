#!/usr/bin/env node
/**
 * ESTORNA as duas gerações do `#530` que o gate de intrusão TERIA BARRADO, e
 * que foram entregues e cobradas nas 70h em que o conserto ficou parado num PR
 * aberto.
 *
 * ── O CASO, MEDIDO EM 26/09 ────────────────────────────────────────────────
 * Aluno `dnoronhajr@gmail.com` (perfil a98f8173), pagante, acesso ativo até
 * 07/10, recargas em 22/07, 07/08 e 07/09. Escreveu **4 vezes**. As palavras
 * dele hoje 14:25Z: *"pois já pedi anteriormente e nada ainda fizeram, o
 * problema se repete continuamente e não consigo gerar o video por causa do
 * audio errado."*
 *
 * Três gerações de texto longo, todas `ready` (entregues e cobradas):
 *
 *   65f26a72  23/09 14:12Z  684 ch  intrusão 18/18  eco 16/18  −684  JÁ ESTORNADA 15:27Z
 *   f1d1b4a4  25/09 22:05Z  721 ch  intrusão 18/18  eco 16/18  −721  não estornada
 *   ba4a829e  26/09 14:17Z  730 ch  intrusão 26/27  eco 26/27  −730  não estornada
 *
 * ── POR QUE ISTO NÃO É DEVOLUÇÃO POR INICIATIVA ───────────────────────────
 * Três razões independentes, nenhuma delas "eu achei":
 *
 * 1. **A CASA JÁ DECIDIU ISTO UMA VEZ.** A `65f26a72` tem a MESMA assinatura
 *    (intrusão 18/18) e foi estornada pela própria casa em 23/09 15:27Z. As
 *    duas de baixo são o mesmo defeito no mesmo aluno; tratá-las diferente é
 *    incoerência, não prudência.
 *
 * 2. **A RÉGUA VIROU CÓDIGO DE PRODUÇÃO HOJE.** O PR #418 foi mergeado em
 *    26/09 14:47:30Z (merge `83d1ad4e`): `intrusao_sistemica` REPROVA a geração
 *    quando `flagged/checked >= 0.9` E `checked >= 5`, ANTES da montagem, e a
 *    falha dispara o estorno automático (`_resultado_intrusao` devolve `error`
 *    → webhook chama `handleTechFailure` com `refundRefType='generation_refund'`
 *    — conferido nas duas pontas). As duas gerações abaixo cruzam essa régua:
 *       f1d1b4a4  18/18 = 1,000  checked 18  ->  REPROVARIA
 *       ba4a829e  26/27 = 0,963  checked 27  ->  REPROVARIA
 *    Se o gate estivesse no ar quando elas rodaram, o crédito teria voltado
 *    SOZINHO. Este script não inventa regra: aplica a regra da casa às duas
 *    entregas que escaparam pela janela em que o conserto ficou parado.
 *
 * 3. **A TAXA-BASE DIZ QUE NÃO É O NORMAL DA FROTA.** Medido em 829 gerações
 *    `ready` com `echo_checked > 0` nos últimos 14 dias (235 alunos):
 *    **98,3% estão limpas** de eco da referência, e só **4** são severas
 *    (fração >= 0,8 com >= 5 pedaços). **TRÊS DAS QUATRO SÃO DESTE ALUNO** — e
 *    a `ba4a829e` é a PIOR da frota na janela (0,963; nenhuma pior). O defeito
 *    está concentrado nele, não é o piso do produto.
 *    (`_frank/ferramentas/2026-09-26_eco_da_referencia_taxa_base.cjs`)
 *
 * ⚠️ O QUE EU NÃO AFIRMO: não ouvi os áudios. A prova aqui é telemetria da
 * própria casa (whisper comparando o áudio com o texto pedido) somada às
 * palavras do aluno — não escuta minha. E `qa` NÃO guarda amostra do texto
 * intruso: só contagem. Conferido imprimindo o `qa` cru
 * (`2026-09-26_intrusao_o_que_entrou_no_audio.cjs`).
 *
 * ARMADILHAS RESPEITADAS:
 *   - pareia por `ref_id` + `ref_type='generation_refund'`, NUNCA por `kind`
 *     (o estorno grava `kind='extra_purchase'`; filtrar por `kind` já quase
 *     pagou em dobro pra 13 alunos) e NUNCA por valor;
 *   - relê o ledger ANTES de gravar: estorno já existente => PULA a geração;
 *   - EXIGE 1 débito e 0 estornos por geração, e que ela seja DELE;
 *   - EXIGE que o `qa` cruze a régua de produção (>=0,9 e checked>=5) — sem
 *     isso este script NÃO devolve nada, pra não virar régua de devolver áudio
 *     bom;
 *   - CONFERE NO BANCO depois de gravar (linha de estorno + delta do saldo),
 *     nunca na fala da RPC. Update por id inexistente afeta 0 linhas EM
 *     SILÊNCIO.
 *
 * Sem `--confirmar` ele SIMULA.
 *
 * USO: node _frank/ferramentas/2026-09-26_estornar_intrusao_que_o_gate_teria_barrado.cjs [--confirmar]
 */
const { supa } = require("./_comum.cjs");

const EMAIL = "dnoronhajr@gmail.com";
// A régua que está EM PRODUÇÃO desde o merge 83d1ad4e (26/09 14:47:30Z).
const FRACAO_MIN = 0.9;
const CHECKED_MIN = 5;
const ALVOS = [
  { prefixo: "f1d1b4a4", valor: 721 },
  { prefixo: "ba4a829e", valor: 730 },
];
const CONFIRMAR = process.argv.includes("--confirmar");

(async () => {
  const db = supa();

  const { data: profs, error: ep } = await db
    .from("profiles")
    .select("id,email,credits_subscription,credits_extra,access_until,plan")
    .eq("email", EMAIL);
  if (ep) { console.error("ERRO profiles:", ep.message); process.exit(1); }
  if (profs.length !== 1) { console.error(`esperava 1 perfil, achei ${profs.length} — PARE.`); process.exit(1); }
  const p = profs[0];
  const saldoAntes = (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
  console.log(`aluno ${p.email} · perfil ${p.id.slice(0, 8)} · plano=${p.plan} · acesso até ${p.access_until}`);
  console.log(`saldo ANTES: ${saldoAntes}`);
  console.log(`régua aplicada (a de produção): fração >= ${FRACAO_MIN} E checked >= ${CHECKED_MIN}\n`);

  // `id` é uuid: `like` não existe pra uuid. Filtro em JS sobre as DELE.
  const { data: todas, error: eg } = await db
    .from("generations")
    .select("id,user_id,status,created_at,qa")
    .eq("user_id", p.id);
  if (eg) { console.error("ERRO generations:", eg.message); process.exit(1); }

  const aPagar = [];
  for (const alvo of ALVOS) {
    const achadas = (todas ?? []).filter((g) => g.id.startsWith(alvo.prefixo));
    if (achadas.length !== 1) { console.error(`${alvo.prefixo}: esperava 1 geração, achei ${achadas.length} — PARE.`); process.exit(1); }
    const g = achadas[0];
    const qa = g.qa ?? {};
    const ch = qa.intrusion_checked ?? 0;
    const fl = qa.intrusion_flagged ?? 0;
    const frac = ch > 0 ? fl / ch : null;
    console.log(`── ${g.id}`);
    console.log(`   status=${g.status} · ${g.created_at}`);
    console.log(`   intrusão ${fl}/${ch}${frac === null ? "" : ` = ${frac.toFixed(3)}`} · eco ${qa.echo_flagged ?? "?"}/${qa.echo_checked ?? "?"}`);

    if (g.status !== "ready") {
      console.error("   NÃO está 'ready' — este script só trata entrega COBRADA. PARE.");
      process.exit(1);
    }
    if (frac === null || !(frac >= FRACAO_MIN && ch >= CHECKED_MIN)) {
      console.error(`   NÃO cruza a régua de produção (${FRACAO_MIN}/${CHECKED_MIN}) — este script não devolve áudio bom. PARE.`);
      process.exit(1);
    }
    console.log(`   ✔ cruza a régua de produção — o gate de hoje REPROVARIA esta geração`);

    const { data: linhas, error: el } = await db
      .from("credit_transactions")
      .select("amount,kind,ref_type,ref_id,created_at")
      .eq("ref_id", g.id)
      .order("created_at");
    if (el) { console.error("   ERRO ledger:", el.message); process.exit(1); }
    const deb = linhas.filter((t) => t.amount < 0);
    const estornos = linhas.filter((t) => t.amount > 0 && t.ref_type === "generation_refund");
    for (const t of linhas) console.log(`   ${t.amount > 0 ? "+" : ""}${t.amount} kind=${t.kind} ref_type=${t.ref_type} ${t.created_at}`);
    if (estornos.length) { console.log("   JÁ ESTORNADA — não pago em dobro. PULO esta.\n"); continue; }
    if (deb.length !== 1) { console.error(`   esperava 1 débito, achei ${deb.length} — PARE.`); process.exit(1); }
    if (Math.abs(deb[0].amount) !== alvo.valor) {
      console.error(`   o débito é ${deb[0].amount}, não -${alvo.valor} — PARE e confira à mão.`);
      process.exit(1);
    }
    aPagar.push({ id: g.id, valor: alvo.valor });
    console.log(`   -> A DEVOLVER: ${alvo.valor} cr\n`);
  }

  const total = aPagar.reduce((a, x) => a + x.valor, 0);
  console.log(`PLANO: ${aPagar.length} estorno(s), total ${total} cr (ref_type=generation_refund)`);
  if (!aPagar.length) { console.log("nada a fazer."); return; }
  if (!CONFIRMAR) { console.log("(ENSAIO — nada gravado. Repita com --confirmar.)"); return; }

  for (const x of aPagar) {
    const { data, error } = await db.rpc("add_extra_credits", {
      p_user_id: p.id, p_amount: x.valor, p_ref_type: "generation_refund", p_ref_id: x.id,
    });
    if (error) { console.error(`RPC FALHOU em ${x.id.slice(0, 8)}:`, error.message); process.exit(1); }
    console.log(`RPC ${x.id.slice(0, 8)} ->`, JSON.stringify(data));
  }

  // CONFERE NO BANCO, não na fala da RPC.
  console.log("\n── CONFERÊNCIA NO BANCO (não na fala da RPC) ──");
  let confirmados = 0;
  for (const x of aPagar) {
    const { data: depois, error: e2 } = await db
      .from("credit_transactions")
      .select("amount,ref_type,kind,created_at,balance_after")
      .eq("ref_id", x.id)
      .eq("ref_type", "generation_refund")
      .gt("amount", 0);
    if (e2) { console.error("ERRO ao reler:", e2.message); process.exit(1); }
    if (!depois.length) { console.log(`⚠️  ${x.id.slice(0, 8)}: ZERO linha — a RPC falou e não gravou. NÃO diga que estornou.`); continue; }
    confirmados++;
    for (const t of depois) console.log(`  ${x.id.slice(0, 8)}: +${t.amount} ${t.ref_type} (kind=${t.kind}) ${t.created_at} saldo_após=${t.balance_after}`);
  }

  const { data: p2 } = await db.from("profiles").select("credits_subscription,credits_extra").eq("id", p.id);
  const saldoDepois = (p2[0].credits_subscription ?? 0) + (p2[0].credits_extra ?? 0);
  console.log(`\nSALDO: ${saldoAntes} -> ${saldoDepois} (delta ${saldoDepois - saldoAntes}, esperado ${total})`);
  console.log(`linhas de estorno confirmadas no banco: ${confirmados}/${aPagar.length}`);
  if (saldoDepois - saldoAntes !== total || confirmados !== aPagar.length) {
    console.log("⚠️  NÃO BATE — confira à mão antes de afirmar que devolveu.");
    process.exit(1);
  }
  console.log("✔ devolvido e conferido no banco.");
})();
