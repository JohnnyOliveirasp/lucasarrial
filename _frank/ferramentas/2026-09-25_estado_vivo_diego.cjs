#!/usr/bin/env node
/**
 * ESTADO VIVO do caso Diego Vargas (cartão #37bacb68, o mais velho da fila em
 * 25/09) — SÓ LEITURA. Não move crédito, não escreve e-mail, não toca incidente.
 *
 * POR QUE EXISTE (regra 25-B): a ronda de 25/09 18hZ afirma quatro números que
 * decidem o que fazer com o aluno, e afirmação que ninguém pode reconferir não
 * é prova. Os quatro:
 *   (1) ele VOLTOU ou não desde a última falha (23/09 11:48Z);
 *   (2) quantos dias de acesso restam (se acabar, estorno não repara nada);
 *   (3) o dinheiro do áudio defeituoso está pago — casado por ref_id, nunca
 *       por valor nem por kind (os dois débitos têm o MESMO valor 1944, e
 *       filtrar por kind acha o estorno do irmão e conclui, errado, que já
 *       devolveu);
 *   (4) o total devolvido HOJE na casa inteira, porque o teto de 100.000 cr/dia
 *       da regra 9-B se conta do banco, não da memória da ronda.
 *
 * ⚠️ ARMADILHA RESPEITADA (regra "consulta que erra volta VAZIA"): toda
 * consulta tem o `error` checado antes de acreditar no zero, e o script SAI
 * != 0 se o perfil não resolver em exatamente 1 linha. Zero que vem de
 * instrumento cego não é zero medido.
 *
 * USO: node _frank/ferramentas/2026-09-25_estado_vivo_diego.cjs
 */
const { supa } = require("./_comum.cjs");

const EMAIL = "diegoavnunes@gmail.com";
const ULTIMA_FALHA = "2026-09-23T11:48:19Z";
const GERACAO_DEFEITO = "1c761a52-addd-4861-b6f6-6e374d944ed4";

function morre(rotulo, error) {
  if (error) { console.error(`ERRO ${rotulo}:`, error.message); process.exit(1); }
}

(async () => {
  const db = supa();
  const agora = new Date();
  console.log(`agora: ${agora.toISOString()}\n`);

  // (1) perfil — exatamente 1, senão para (nunca confie no e-mail do cartão)
  const { data: profs, error: ep } = await db.from("profiles")
    .select("id,email,credits_subscription,credits_extra,access_until")
    .eq("email", EMAIL);
  morre("profiles", ep);
  if (!profs || profs.length !== 1) {
    console.error(`esperava 1 perfil para ${EMAIL}, achei ${profs ? profs.length : 0} — PARE.`);
    process.exit(2);
  }
  const p = profs[0];
  const saldo = (p.credits_subscription || 0) + (p.credits_extra || 0);
  const diasAcesso = p.access_until
    ? (new Date(p.access_until) - agora) / 86400000 : null;
  console.log("=== 1. QUEM ===");
  console.log(`  perfil ...... ${p.id}`);
  console.log(`  saldo ....... ${saldo} (assinatura ${p.credits_subscription} + extra ${p.credits_extra})`);
  console.log(`  access_until  ${p.access_until} => ${diasAcesso === null ? "?" : diasAcesso.toFixed(2)} dia(s)`);

  // (2) VOLTOU? toda geração da vida dele, e o que houve DEPOIS da última falha
  const { data: gens, error: eg } = await db.from("generations")
    .select("id,status,created_at,elapsed_seconds,text_normalized,qa")
    .eq("user_id", p.id).order("created_at", { ascending: true });
  morre("generations", eg);
  console.log(`\n=== 2. GERAÇÕES (${gens.length} na vida) ===`);
  for (const g of gens) {
    const n = (g.text_normalized || "").length;
    console.log(`  ${g.created_at} · ${String(g.status).padEnd(10)} · ${String(n).padStart(5)}ch · ${g.id.slice(0, 8)}`);
  }
  const depois = gens.filter((g) => g.created_at > ULTIMA_FALHA);
  console.log(`\n  DEPOIS da última falha (${ULTIMA_FALHA}): ${depois.length} geração(ões)`);
  console.log(`  >>> ${depois.length === 0 ? "NÃO VOLTOU — segue sem o áudio dele" : "VOLTOU — conferir se se serviu"}`);
  const horasParado = (agora - new Date(ULTIMA_FALHA)) / 3600000;
  console.log(`  parado há ${horasParado.toFixed(1)}h`);

  // (3) dinheiro — casado por ref_id, jamais por valor ou kind
  const { data: tx, error: et } = await db.from("credit_transactions")
    .select("amount,kind,ref_type,ref_id,created_at")
    .eq("user_id", p.id).order("created_at", { ascending: true });
  morre("credit_transactions", et);
  console.log(`\n=== 3. DINHEIRO (${tx.length} lançamentos) ===`);
  for (const t of tx) {
    console.log(`  ${t.created_at} · ${String(t.amount).padStart(8)} · ${String(t.kind).padEnd(16)} · ${String(t.ref_type).padEnd(18)} · ${t.ref_id ? t.ref_id.slice(0, 8) : "-"}`);
  }
  const doDefeito = tx.filter((t) => t.ref_id === GERACAO_DEFEITO);
  const deb = doDefeito.filter((t) => t.amount < 0);
  const est = doDefeito.filter((t) => t.ref_type === "generation_refund");
  console.log(`\n  áudio defeituoso ${GERACAO_DEFEITO.slice(0, 8)}: ${deb.length} débito(s), ${est.length} estorno(s) casado(s) por ref_id`);
  console.log(`  >>> ${est.length >= 1 && deb.length >= 1 ? "PAGO — o aluno não está no prejuízo por este áudio" : "EM ABERTO — há dinheiro a devolver"}`);

  // (4) teto diário da regra 9-B — some do BANCO, não da memória da ronda
  const inicioDoDia = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())).toISOString();
  const { data: hoje, error: eh } = await db.from("credit_transactions")
    .select("amount").eq("ref_type", "generation_refund").gte("created_at", inicioDoDia);
  morre("teto diario", eh);
  const somaHoje = (hoje || []).reduce((a, t) => a + (t.amount || 0), 0);
  console.log(`\n=== 4. TETO DIÁRIO (regra 9-B) ===`);
  console.log(`  devolvido hoje (desde ${inicioDoDia}): ${somaHoje} cr em ${hoje.length} lançamento(s)`);
  console.log(`  teto 100.000/dia => ${somaHoje < 100000 ? "FOLGA" : "🔴 CONGELA E CHAMA O JOHNNY"}`);
})();
