#!/usr/bin/env node
/**
 * ESTORNA os 3 b-rolls da Leonice que a NOSSA chave determinística apagou (#302).
 *
 * ── O que aconteceu, medido em 19/09 ──────────────────────────────────────
 * Ela aplicou b-roll QUATRO vezes no mesmo vídeo (clone 3632c228), entre
 * 20:51:10Z e 20:54:26Z — 3m16s — e pagou 200 cr por cada uma (800 no total).
 * Em `credit_transactions`, ref_type='edicao_broll', quatro linhas, ZERO
 * estornos.
 *
 * Só que a saída do b-roll é DETERMINÍSTICA por vídeo:
 *   broll/route.ts:118 → `${user_id}/edicao/broll/${kind}-${id}.mp4`
 * Ou seja: cada aplicação SOBRESCREVE a anterior. Conferido no R2, objeto por
 * objeto, nos SETE clones dela: existe UM único arquivo em `edicao/broll/`
 * (7,52 MB, gravado 20:54:31Z). Os outros três renders que ela pagou não
 * existem em lugar nenhum — não é que ela não goste deles, é que eles foram
 * apagados pela nossa própria chave antes que ela pudesse voltar a qualquer um.
 *
 * ⚠️ POR QUE ISTO NÃO CONTRARIA A REGRA #960 (não se estorna limitação de
 * produto). Não estou devolvendo porque o resultado ficou aquém do esperado —
 * esse seria o caso se ela tivesse 4 arquivos e não gostado deles. Estou
 * devolvendo porque a casa COBROU QUATRO VEZES E ENTREGA UM. Três coisas pagas
 * deixaram de existir por decisão de engenharia nossa, e isso é falha de
 * entrega, que é exatamente o que a #960 manda estornar.
 *
 * E por que ela aplicou quatro vezes: ela queria TIRAR o b-roll. Não existe
 * botão de desfazer (a rota só tem a ação "aplicar o b-roll", sem reverter nem
 * DELETE). A única alavanca que a tela oferecia era aplicar de novo — então
 * cada tentativa de voltar atrás custava 200 cr e afastava mais do que ela
 * queria. A casa cobrou pela ausência do próprio botão.
 *
 * FICA COBRADA a quarta (200 cr): esse arquivo existe e está na conta dela.
 *
 * O CAMINHO É O DE PRODUÇÃO: `add_extra_credits` (RPC) com
 * ref_type='edicao_broll_refund' — o MESMO refundRefType que
 * broll/route.ts:200 usa — e ref_id = o id do job de cada linha.
 *
 * ARMADILHAS RESPEITADAS:
 *   - confere estorno por ref_type CASADO COM ref_id, nunca por `kind`;
 *   - relê o ledger antes de gravar: linha que já tem estorno casado é PULADA;
 *   - confere NO BANCO depois de gravar (linha + saldo), não na fala da RPC.
 *
 * Sem `--confirmar` ele SIMULA.
 *
 * USO: node _frank/ferramentas/2026-09-19_estornar_broll_sobrescrito.cjs [--confirmar]
 */
const { supa } = require("./_comum.cjs");
const { REF_TYPES_ESTORNO } = require("./_estornos.cjs");

const EMAIL = "leonicemleandrosociedadeadvoca@gmail.com";
/** Os TRÊS primeiros jobs — os que foram sobrescritos. O 4º (40f85307) fica cobrado. */
const SOBRESCRITOS = [
  "328a518b-2577-497d-a0f1-347ab08a9325-e1",
  "d090ffca-4073-4ad3-a9e6-54c39e571191-e2",
  "8a9459dd-d1b2-43d5-bfba-c30ec38dd531-e2",
];
const SOBREVIVENTE = "40f85307-f1ab-4a8c-b58a-51972753d744-e2";
const CONFIRMAR = process.argv.includes("--confirmar");

(async () => {
  const db = supa();

  const { data: profs, error: ep } = await db.from("profiles")
    .select("id,email,display_name,credits_subscription,credits_extra").eq("email", EMAIL);
  if (ep) { console.error("ERRO profiles:", ep.message); process.exit(1); }
  if (profs.length !== 1) { console.error(`esperava 1 perfil, achei ${profs.length} — pare.`); process.exit(1); }
  const p = profs[0];
  const saldoAntes = (p.credits_subscription ?? 0) + (p.credits_extra ?? 0);
  console.log(`ALUNA: ${p.email} (${p.display_name || "-"})  saldo=${saldoAntes}`);

  // O sobrevivente CONTINUA COBRADO — imprime pra ninguém achar que sumiu.
  console.log(`\nFICA COBRADO (o arquivo existe): ${SOBREVIVENTE.slice(0, 8)} — 200 cr`);

  let total = 0;
  const plano = [];
  for (const job of SOBRESCRITOS) {
    const { data: tx, error } = await db.from("credit_transactions").select("*").eq("ref_id", job);
    if (error) { console.error("ERRO ledger:", error.message); process.exit(1); }
    const deb = tx.filter((t) => t.amount < 0);
    const est = tx.filter((t) => t.amount > 0 && REF_TYPES_ESTORNO.includes(t.ref_type));
    if (est.length) { console.log(`  ${job.slice(0, 8)}: JA ESTORNADO — pulo.`); continue; }
    if (deb.length !== 1) { console.log(`  ${job.slice(0, 8)}: esperava 1 debito, achei ${deb.length} — pulo por seguranca.`); continue; }
    if (deb[0].user_id !== p.id) { console.log(`  ${job.slice(0, 8)}: debito NAO e dela — pulo.`); continue; }
    const v = -deb[0].amount;
    plano.push({ job, v });
    total += v;
    console.log(`  ${job.slice(0, 8)}: debito ${deb[0].amount} em ${deb[0].created_at} -> devolver +${v}`);
  }

  console.log(`\nPLANO: devolver ${total} cr em ${plano.length} linha(s) (ref_type=edicao_broll_refund)`);
  if (!plano.length) { console.log("nada a fazer."); return; }
  if (!CONFIRMAR) { console.log("(ENSAIO — nada gravado. Repita com --confirmar.)"); return; }

  for (const { job, v } of plano) {
    const { data, error } = await db.rpc("add_extra_credits", {
      p_user_id: p.id, p_amount: v, p_ref_type: "edicao_broll_refund", p_ref_id: job,
    });
    if (error) { console.error(`RPC FALHOU em ${job}:`, error.message); process.exit(1); }
    console.log(`RPC ${job.slice(0, 8)} ->`, JSON.stringify(data));
  }

  // CONFERE NO BANCO, não na fala da RPC
  let confirmadas = 0;
  for (const { job } of plano) {
    const { data } = await db.from("credit_transactions")
      .select("amount,ref_type,kind,created_at,balance_after").eq("ref_id", job).gt("amount", 0);
    for (const t of data ?? []) { console.log(`  CONFERIDO +${t.amount} ${t.ref_type} (kind=${t.kind}) ${t.created_at} saldo_apos=${t.balance_after}`); confirmadas++; }
  }
  const { data: p2 } = await db.from("profiles").select("credits_subscription,credits_extra").eq("id", p.id);
  const saldoDepois = (p2[0].credits_subscription ?? 0) + (p2[0].credits_extra ?? 0);
  console.log(`SALDO: ${saldoAntes} -> ${saldoDepois} (delta ${saldoDepois - saldoAntes}, esperado ${total})`);
  if (confirmadas !== plano.length) console.log("⚠️  numero de linhas conferidas nao bate — NAO diga que devolveu tudo.");
  if (saldoDepois - saldoAntes !== total) console.log("⚠️  DELTA NAO BATE — confira a mao antes de afirmar.");
})();
