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
 * ── CORRECAO DE 26/09 ~16hZ: O TETO DO DIA CONTAVA COMPRA COMO DEVOLUCAO ────
 * A conta do teto era `amount > 0 E ref_type != 'payment_event'`. Isso NAO e
 * "devolucao": qualquer credito positivo que nao seja grant de ciclo entrava,
 * inclusive PACOTE COMPRADO pelo aluno (`stripe_session`), que e dinheiro
 * ENTRANDO, nao saindo.
 *
 * MEDIDO HOJE, e foi assim que o defeito apareceu: o guarda somou 141.100 cr e
 * BLOQUEOU o estorno de um aluno. Abrindo por ref_type, o dia era
 *   stripe_session      +120.000   <- COMPRA de pacote, nao e devolucao
 *   video_clone_refund   +14.910
 *   generation_refund     +4.270
 *   image_refund          +1.920
 * ou seja **21.100 cr** de devolucao real, a um quinto do teto. O guarda
 * negou pagar 7.920 cr devidos porque OUTRO aluno comprou creditos de manha.
 *
 * Isto nao e afrouxar a trava: e a trava medir o que a regra 9-B manda medir
 * ("soma de tudo que foi DEVOLVIDO no dia"). A casa ja tinha a lista canonica
 * dessa classificacao em `_estornos.cjs` — com `stripe_session` ja cadastrado
 * como NAO-devolucao desde antes — e o teste `_estornos.test.cjs:53` ja diz com
 * todas as letras "somar payment_event estoura o teto diario de mentira". Esta
 * ferramenta simplesmente nao chamava o modulo. Agora chama.
 *
 * E ficou MAIS rigorosa num ponto: ref_type positivo que a lista canonica NAO
 * conhece nao e mais ignorado — conta como devolucao E imprime aviso. Lista fixa
 * envelhece calada, e envelhecer calada aqui custa dinheiro (#185).
 *
 * SEM --confirmar ele SIMULA e nao grava nada.
 * USO: node 2026-09-17_estornar_video_sobrescrito.cjs <uuid-da-imagem> [--confirmar]
 */
const { supa } = require("./_comum.cjs");
const { ehEstorno, NAO_SAO_DEVOLUCAO } = require("./_estornos.cjs");

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

  // 3) teto do DIA, somado do banco.
  // PAGINA: o PostgREST corta em 1000 linhas EM SILENCIO, e um guarda que so ve
  // o comeco da tabela soma menos do que existe — erraria pro lado de PAGAR.
  const HOJE = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
  const dia = [];
  for (let pag = 0; ; pag += 500) {
    const { data, error: e3 } = await db.from("credit_transactions")
      .select("amount,ref_type").gte("created_at", HOJE).gt("amount", 0)
      .order("created_at", { ascending: true }).range(pag, pag + 499);
    if (e3) { console.error("ERRO teto do dia:", e3.message); process.exit(1); }
    dia.push(...data);
    if (data.length < 500) break;
  }
  const { count: contaDia, error: e3c } = await db.from("credit_transactions")
    .select("id", { count: "exact", head: true }).gte("created_at", HOJE).gt("amount", 0);
  if (e3c) { console.error("ERRO count do dia:", e3c.message); process.exit(1); }
  if (dia.length !== contaDia) { console.error(`🔴 paginacao do teto nao fechou (${dia.length} != ${contaDia}) — instrumento cego NAO decide dinheiro. PARANDO.`); process.exit(1); }

  // Devolucao e o que a lista CANONICA (_estornos.cjs) diz que e. Nao basta
  // "nao ser payment_event": pacote comprado (stripe_session) tambem tem
  // amount>0 e nao devolve nada a ninguem. Ver cabecalho, correcao de 26/09.
  const desconhecidos = [...new Set(dia.map(t => t.ref_type).filter(t => !ehEstorno(t) && !NAO_SAO_DEVOLUCAO.includes(t)))];
  const devolvidoHoje = dia
    .filter(t => ehEstorno(t.ref_type) || desconhecidos.includes(t.ref_type))
    .reduce((a, t) => a + t.amount, 0);
  const naoDevolucao = dia.filter(t => NAO_SAO_DEVOLUCAO.includes(t.ref_type)).reduce((a, t) => a + t.amount, 0);
  console.log(`DEVOLVIDO HOJE (do banco, ${dia.length} linhas positivas, classificado por _estornos.cjs): ${devolvidoHoje} cr`);
  console.log(`   (nao entram na conta por NAO serem devolucao: ${naoDevolucao} cr — grant de ciclo, pacote comprado etc.)`);
  if (desconhecidos.length) {
    console.log(`⚠️  ref_type positivo DESCONHECIDO da lista canonica: ${desconhecidos.join(", ")}`);
    console.log("    contei como devolucao (erra pro lado seguro), mas cadastre em _estornos.cjs.");
  }
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
