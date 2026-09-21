#!/usr/bin/env node
/**
 * ESTORNA os 5.680 créditos do Vídeo Clone Turbo (480p-v2) de
 * `grupohcmarketing.comercial@gmail.com` que a casa AFIRMOU POR ESCRITO já ter
 * devolvido — e não tinha. Cartão #224 (`7ed72ad0`).
 *
 * ── A frase que a casa mandou, e a medição que a desmente ──
 * Em 02/09 01:20Z (Enviados uid 443, assunto "Seu Video Clone de 71s - olhei os
 * dois videos, e a resposta honesta esta aqui") a casa escreveu, palavra por
 * palavra: *"Isso aconteceu no Turbo (o que você reportou, **e que já foi
 * estornado**)"*. A nota do cartão de 01/09 17:2xZ tinha dito o mesmo: *"os
 * 5.680 cr JA foram estornados, entao nao ha pendencia financeira"*.
 *
 * Medido em 21/09 no ledger inteiro dele (6 linhas, nenhuma positiva):
 *   +100000 subscription_grant  01/09 12:59  (HP110549)
 *    -10000 training/voice      01/09 14:26
 *     -1191 generation          01/09 14:52
 *     -5680 video_clone         01/09 15:00  ← f028733d, o Turbo de 70,02s
 *     -1767 generation          01/09 17:08
 *     -7455 video_clone         01/09 17:13  ← 93895b06, o 480p-v3
 * Soma dos débitos = 26.093. Saldo hoje = 73.907 = 100.000 − 26.093, **exato**.
 * A aritmética do saldo prova o que o filtro já dizia: **estorno nenhum entrou,
 * de ref_type nenhum**. Ele está 5.680 cr no negativo desde 01/09 acreditando
 * que não está, porque a gente disse que não estava.
 *
 * ── Por que ESTE sai e o de 7.455 NÃO sai aqui ──
 * Este estorno **não** é devolução por insatisfação e **não** julga a qualidade
 * do vídeo: é honrar uma frase que a casa já pôs no e-mail dele. É a mesma
 * razão do `2026-09-19_estornar_o_que_a_casa_disse_que_ja_tinha_estornado.cjs`
 * (os 400 cr da Katia). Cabe na 9-B ("estorno de falha nossa até 20.000 cr por
 * caso → você, sozinho"), e devolver o que a casa já declarou devolvido não
 * cria política nova.
 *
 * O **93895b06 (7.455 cr, 480p-v3)** fica de fora DE PROPÓSITO. Ele deriva
 * igual — está medido frame a frame na nota de 02/09 — mas a casa nunca
 * escreveu que ele tinha sido estornado, então devolvê-lo seria decisão NOVA
 * sobre limite técnico do produto, e vale pra classe inteira, não só pra ele.
 * Essa vai pro Johnny (9-D), não pra cá. Quem rodar este script não está
 * decidindo nada sobre o v3.
 *
 * O CAMINHO É O DE PRODUÇÃO: `add_extra_credits` (RPC) com
 * ref_type=`video_clone_refund` (o ref_type real de vídeo clone — ver
 * `_estornos.cjs`; `generation_refund` enxerga 9,4% do universo) e
 * ref_id = id do vídeo clone. Insert na mão em credit_transactions não
 * atualiza saldo e criaria extrato que não bate.
 *
 * ARMADILHAS RESPEITADAS (ordem de 20/08 + `_estornos.cjs`):
 *   - confere estorno por ref_type CASADO COM ref_id, nunca por `kind`;
 *   - usa a LISTA inteira de ref_type de estorno, não só `generation_refund`;
 *   - relê o ledger antes de gravar: se já existe estorno casado, PULA;
 *   - depois de gravar, CONFERE NO BANCO (linha + saldo), não na fala da RPC.
 *
 * Sem `--confirmar` ele SIMULA.
 *
 * USO: node _frank/ferramentas/2026-09-21_estornar_turbo_que_a_carta_disse_que_voltou.cjs [--confirmar]
 */
const { supa } = require("./_comum.cjs");
const { REF_TYPES_ESTORNO } = require("./_estornos.cjs");

const EMAIL = "grupohcmarketing.comercial@gmail.com";
// Só o PREFIXO fica fixo: o uuid completo é resolvido em runtime a partir dos
// vídeos DO ALUNO. Constante com uuid inteiro digitado à mão já virou armadilha
// aqui (prefixo certo, resto do uuid errado, e o script mira no vazio).
const PREFIXO = "f028733d";
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

  // 1) o vídeo clone existe, está ready, é dele, e é o Turbo de 70s?
  const { data: vcs, error: ev } = await db.from("video_clones")
    .select("id,user_id,created_at,status,tier,duration_seconds").eq("user_id", p.id);
  if (ev) { console.error("ERRO video_clones:", ev.message); process.exit(1); }
  const alvos = vcs.filter((v) => v.id.startsWith(PREFIXO));
  if (alvos.length !== 1) { console.error(`esperava 1 video clone com prefixo ${PREFIXO}, achei ${alvos.length} — pare.`); process.exit(1); }
  const v = alvos[0];
  console.log(`VIDEO ${v.id} ${v.created_at} status=${v.status} tier=${v.tier} dur=${v.duration_seconds}s`);
  if (v.status !== "ready") { console.error("vídeo não está ready — o caso é outro, pare."); process.exit(1); }
  if (v.tier !== "480p-v2") { console.error(`tier inesperado (${v.tier}) — este script é do Turbo, pare.`); process.exit(1); }

  // 2) débito e estorno casados por ref_id (NUNCA por kind), com a LISTA inteira
  const { data: tx, error: et } = await db.from("credit_transactions").select("*").eq("ref_id", v.id);
  if (et) { console.error("ERRO credit_transactions:", et.message); process.exit(1); }
  const debito = tx.filter((t) => t.amount < 0).reduce((a, b) => a + b.amount, 0);
  const jaEstornado = tx.filter((t) => t.amount > 0 && REF_TYPES_ESTORNO.includes(t.ref_type));
  console.log(`LEDGER do ref_id: ${tx.length} linha(s) · debito=${debito} · estornos=${jaEstornado.length}`);
  for (const t of tx) console.log(`  ${t.amount > 0 ? "+" : ""}${t.amount} ${t.ref_type} (kind=${t.kind}) ${t.created_at}`);

  if (jaEstornado.length) { console.log("\nJA ESTORNADO — não devolvo em dobro. Nada a fazer."); return; }
  if (debito === 0) { console.error("\nsem débito casado — pare e confira à mão."); process.exit(1); }
  if (debito !== -5680) { console.error(`\ndébito ${debito} != -5680 — o mundo mudou desde a medição, pare e remeça.`); process.exit(1); }

  // 3) teto DIÁRIO da 9-B: some o dia inteiro, do banco, com a lista inteira
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: doDia, error: ed } = await db.from("credit_transactions")
    .select("amount,ref_type").gte("created_at", `${hoje}T00:00:00Z`).gt("amount", 0).in("ref_type", REF_TYPES_ESTORNO);
  if (ed) { console.error("ERRO teto diário:", ed.message); process.exit(1); }
  const devolvidoHoje = doDia.reduce((a, b) => a + b.amount, 0);
  const valor = -debito;
  console.log(`TETO 9-B: já devolvido hoje = ${devolvidoHoje} cr em ${doDia.length} linha(s); este caso = ${valor} cr (limite por caso 20.000, do dia 100.000)`);
  if (valor > 20000) { console.error("acima de 20.000 num caso — 9-B manda PARAR e chamar o Johnny."); process.exit(1); }
  if (devolvidoHoje + valor > 100000) { console.error("teto diário de 100.000 estourado — 9-B manda CONGELAR e chamar."); process.exit(1); }

  console.log(`\nPLANO: devolver +${valor} créditos (ref_type=video_clone_refund, ref_id=${v.id.slice(0, 8)})`);
  console.log("MOTIVO: a carta de 02/09 (Enviados uid 443) já disse a ele que isto tinha sido feito.");
  if (!CONFIRMAR) { console.log("(ENSAIO — nada gravado. Repita com --confirmar para valer.)"); return; }

  const { data, error } = await db.rpc("add_extra_credits", {
    p_user_id: p.id, p_amount: valor, p_ref_type: "video_clone_refund", p_ref_id: v.id,
  });
  if (error) { console.error("RPC FALHOU:", error.message); process.exit(1); }
  console.log("RPC ->", JSON.stringify(data));

  // 4) CONFERE NO BANCO, não na fala da RPC
  const { data: depois, error: e2 } = await db.from("credit_transactions")
    .select("amount,ref_type,kind,ref_id,created_at,balance_after").eq("ref_id", v.id).gt("amount", 0);
  if (e2) { console.error("ERRO ao reler:", e2.message); process.exit(1); }
  console.log(`CONFERIDO NO BANCO: ${depois.length} linha(s) de estorno`);
  for (const t of depois) console.log(`  +${t.amount} ${t.ref_type} (kind=${t.kind}) ${t.created_at} saldo_apos=${t.balance_after}`);

  const { data: p2 } = await db.from("profiles").select("credits_subscription,credits_extra").eq("id", p.id);
  const saldoDepois = (p2[0].credits_subscription ?? 0) + (p2[0].credits_extra ?? 0);
  console.log(`SALDO: ${saldoAntes} -> ${saldoDepois} (delta ${saldoDepois - saldoAntes}, esperado ${valor})`);
  if (saldoDepois - saldoAntes !== valor) console.log("⚠️  DELTA NAO BATE — não diga que devolveu até conferir à mão.");
  if (!depois.length) console.log("⚠️  ZERO linhas de estorno no banco — a RPC falou e não gravou. NÃO diga que devolveu.");
})();
