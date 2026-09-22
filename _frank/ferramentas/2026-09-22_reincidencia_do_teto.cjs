#!/usr/bin/env node
/**
 * REINCIDENCIA DO TETO — incidente d3d8d1b2 (#15), "Geracao de audio: tempo de
 * execucao estourado".
 *
 *   node _frank/ferramentas/2026-09-22_reincidencia_do_teto.cjs [--desde=ISO]
 *
 * ── POR QUE EXISTE ────────────────────────────────────────────────────────
 * O cartao foi FECHADO em 21/09 11:46Z com o argumento "16 dias limpos"
 * (05/09→21/09: 1.206 geracoes, 0 timeouts). Ele reincidiu em 22/09 12:54Z —
 * menos de 26h depois. A nota de fechamento deixou a ordem escrita:
 *
 *   "Se reincidir, a fase ja esta instrumentada — leia qa.fase_corrente da
 *    geracao nova ANTES de qualquer hipotese."
 *
 * Este script e essa leitura. Ele NAO opina sobre causa: imprime a fase que o
 * worker gravou, o relogio de cada morte e o dinheiro de cada aluno.
 *
 * ── CONTROLE DO ZERO (armadilha 03_ROTINA) ────────────────────────────────
 * Consulta que erra volta VAZIA e o script imprimiria "0 timeouts" alegremente
 * — foi assim que a casa ja relatou "pagante sem acesso: 0". Aqui:
 *   - todo `error` e checado e o script MORRE em vez de reportar zero;
 *   - o denominador (total de geracoes na janela) e impresso junto, entao
 *     "0 timeouts" so vale se o volume estiver saudavel;
 *   - a paginacao e explicita (o Supabase corta em 1000 linhas em silencio).
 *
 * ⚠️ ESTORNO se confere por ref_type='generation_refund', NUNCA por kind — o
 * estorno grava kind='extra_purchase'. Filtrar por kind faz o aluno estornado
 * parecer nao estornado, e foi o que quase pagou 13 alunos duas vezes em 20/08.
 *
 * SO LEITURA. Nao escreve, nao estorna, nao manda e-mail, nao fecha cartao.
 */
const { supa } = require("./_comum.cjs");

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const DESDE = arg("desde", "2026-08-25T00:00:00Z");

function exigir(rotulo, error) {
  if (error) {
    console.error(`\n❌ CONSULTA FALHOU (${rotulo}): ${error.message}`);
    console.error("   Nao acredite em nenhum zero desta rodada.");
    process.exit(1);
  }
}

async function paginar(db, tabela, colunas, aplica) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    let q = db.from(tabela).select(colunas).order("created_at", { ascending: true }).range(de, de + 999);
    q = aplica(q);
    const { data, error } = await q;
    exigir(tabela, error);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const ehTimeout = (g) => /executiontimeout/i.test(g.error_message || "");

(async () => {
  const db = supa();

  const gers = await paginar(
    db,
    "generations",
    "id,user_id,created_at,status,error_message,elapsed_seconds,duration_seconds,text_raw,qa,request_attempts",
    (q) => q.gte("created_at", DESDE)
  );

  const timeouts = gers.filter(ehTimeout);

  console.log(`\n📐 DENOMINADOR (o zero so vale com volume): ${gers.length} geracao(oes) desde ${DESDE}`);
  console.log(`   destas, ${timeouts.length} morreram por executionTimeout\n`);

  if (!gers.length) {
    console.error("❌ ZERO GERACAO na janela — isso nao e 'sistema saudavel', e instrumento cego. Pare.");
    process.exit(1);
  }

  // ── por semana, pra ver se "parou de reincidir" ainda se sustenta ────────
  const semana = (iso) => {
    const d = new Date(iso);
    const dia = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    dia.setUTCDate(dia.getUTCDate() - dia.getUTCDay());
    return dia.toISOString().slice(0, 10);
  };
  const porSem = new Map();
  for (const g of gers) {
    const k = semana(g.created_at);
    if (!porSem.has(k)) porSem.set(k, { tot: 0, to: 0 });
    porSem.get(k).tot++;
    if (ehTimeout(g)) porSem.get(k).to++;
  }
  console.log("── VOLUME x MORTE, por semana (domingo) ──");
  for (const [k, v] of [...porSem.entries()].sort()) {
    console.log(`   ${k}  ${String(v.tot).padStart(5)} geracoes  ${String(v.to).padStart(3)} timeout(s)`);
  }

  // ── cada morte, com a FASE que o worker gravou ───────────────────────────
  const ids = timeouts.map((g) => g.user_id).filter(Boolean);
  const perfis = new Map();
  if (ids.length) {
    const { data: ps, error: ep } = await db.from("profiles").select("id,email").in("id", [...new Set(ids)]);
    exigir("profiles", ep);
    ps.forEach((p) => perfis.set(p.id, p.email));
  }

  console.log(`\n── AS ${timeouts.length} MORTES, DA MAIS NOVA PRA MAIS VELHA ──`);
  for (const g of [...timeouts].reverse()) {
    const fase = g.qa && g.qa.fase_corrente ? g.qa.fase_corrente : null;
    console.log(`\n  ${g.id.slice(0, 8)} · ${g.created_at} · ${perfis.get(g.user_id) || g.user_id}`);
    console.log(`     elapsed=${g.elapsed_seconds}s · texto=${(g.text_raw || "").length} chars · attempts=${g.request_attempts ?? "null"}`);
    console.log(`     erro: ${String(g.error_message || "").slice(0, 200)}`);
    console.log(`     qa.fase_corrente: ${fase ? JSON.stringify(fase) : "(SEM FASE INSTRUMENTADA)"}`);
  }

  // ── dinheiro: o aluno foi estornado? (ref_type, NUNCA kind) ──────────────
  console.log(`\n── DINHEIRO: estorno por ref_type='generation_refund' (nunca por kind) ──`);
  for (const g of [...timeouts].reverse()) {
    const { data: tx, error: et } = await db
      .from("credit_transactions")
      .select("id,amount,ref_type,ref_id,kind,created_at")
      .eq("ref_id", g.id);
    exigir("credit_transactions", et);
    const estorno = tx.filter((t) => t.ref_type === "generation_refund");
    const debito = tx.filter((t) => t.ref_type !== "generation_refund");
    const atraso = estorno.length
      ? Math.round((new Date(estorno[0].created_at) - new Date(g.created_at)) / 1000)
      : null;
    console.log(
      `  ${g.id.slice(0, 8)} ${perfis.get(g.user_id) || ""} · debito=${debito.map((d) => d.amount).join(",") || "nenhum"} · ` +
        `estorno=${estorno.map((e) => "+" + e.amount).join(",") || "❌ NENHUM"}` +
        (atraso !== null ? ` (em ${Math.floor(atraso / 60)}min${atraso % 60}s)` : "")
    );
  }

  const semEstorno = [];
  for (const g of timeouts) {
    const { data: tx, error: et } = await db
      .from("credit_transactions").select("ref_type").eq("ref_id", g.id);
    exigir("credit_transactions(2)", et);
    if (!tx.some((t) => t.ref_type === "generation_refund")) semEstorno.push(g);
  }
  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`>>> MORTES NA JANELA: ${timeouts.length} · SEM ESTORNO: ${semEstorno.length}`);
  if (semEstorno.length) {
    semEstorno.forEach((g) =>
      console.log(`    ❌ ${g.id.slice(0, 8)} ${perfis.get(g.user_id) || g.user_id} ${g.created_at}`)
    );
  }
  console.log(`══════════════════════════════════════════════════════════════`);
})();
