/**
 * PROVA DO TRIGGER (scripts/86_incidents_resolved_guard.sql) num Postgres
 * REAL e ISOLADO (PGlite em memória — nada de produção): aplica a migration
 * 47 (tabela incidents) + a 86 (trigger) e reproduz a FORMA EXATA de escrita
 * de CADA caminho de fechamento encontrado no card 20/08, provando que
 * resolved_at/resolved_by saem preenchidos em todos — inclusive nas formas
 * que HOJE produzem fechamento cego.
 *
 * Rodar:  node _frank/prova/2026-08-20_card_resolvedat/harness_trigger.cjs
 * (usa o PGlite já vendorado em _Bugs/harness_trial_expiry_v2/node_modules)
 */
const path = require("node:path");
const fs = require("node:fs");

const RAIZ = path.resolve(__dirname, "..", "..", "..");
// _Bugs é gitignored: numa worktree ele não existe — cai pro repo principal.
const PGLITE = [RAIZ, "/mnt/Data/Projetos/PlatformLucasArrial"]
  .map((r) => path.join(r, "_Bugs", "harness_trial_expiry_v2", "node_modules", "@electric-sql", "pglite"))
  .find((p) => fs.existsSync(p));
if (!PGLITE) {
  console.error("PGlite vendorado não encontrado (_Bugs/harness_trial_expiry_v2/node_modules).");
  process.exit(1);
}

async function main() {
  const { PGlite } = require(PGLITE);
  const db = new PGlite();

  // Migration 47 (só a parte da tabela incidents) + 86 (o trigger, byte a byte
  // do arquivo que vai pro Johnny aprovar — não uma cópia digitada).
  const m47 = fs
    .readFileSync(path.join(RAIZ, "frontend", "scripts", "47_incidents_agent_state.sql"), "utf8")
    .split("-- Liga cada falha crua")[0]; // até antes de incident_occurrences
  const m86 = fs.readFileSync(path.join(RAIZ, "scripts", "86_incidents_resolved_guard.sql"), "utf8");
  await db.exec(m47.replace(/alter table [^;]*enable row level security;/g, ""));
  await db.exec(m86);

  let falhas = 0;
  const ok = (cond, rotulo, extra) => {
    console.log(`${cond ? "✓" : "✗ FALHOU"}  ${rotulo}${extra ? ` — ${extra}` : ""}`);
    if (!cond) falhas++;
  };
  const insere = async (rotulo) => {
    const r = await db.query(
      `insert into incidents (kind, cause, status, signature, title)
       values ('reported','reported','open',$1,$1) returning id`,
      [rotulo],
    );
    return r.rows[0].id;
  };
  const le = async (id) => {
    const r = await db.query(
      `select status, resolved_at, resolved_by, resolved_commit from incidents where id = $1`,
      [id],
    );
    return r.rows[0];
  };

  console.log("== Caminho 1: aba Falhas (admin PATCH), forma ANTIGA de 'ignorar': só {status, resolution_note} ==");
  const c1 = await insere("teste:admin-ignorar");
  await db.query(`update incidents set status='ignored', resolution_note='n' where id=$1`, [c1]);
  let r = await le(c1);
  ok(r.resolved_at != null && r.resolved_by === "nao-informado (trigger)", "ignored sem campos → trigger preencheu", JSON.stringify(r));

  console.log("\n== Caminho 2: /agent/actions set_status, forma ANTIGA de 'ignored': só {status} ==");
  const c2 = await insere("teste:agent-ignored");
  await db.query(`update incidents set status='ignored' where id=$1`, [c2]);
  r = await le(c2);
  ok(r.resolved_at != null && r.resolved_by != null, "ignored via agente → preenchido", JSON.stringify(r));

  console.log("\n== Caminho 3: script ad-hoc de ronda (forma que produziu o 9b7cc261): {status:'fixed', resolution_note} ==");
  const c3 = await insere("teste:adhoc-fixed");
  await db.query(`update incidents set status='fixed', resolution_note='fechado na ronda' where id=$1`, [c3]);
  r = await le(c3);
  ok(r.resolved_at != null && r.resolved_by === "nao-informado (trigger)", "fixed ad-hoc sem campos → preenchido", JSON.stringify(r));

  console.log("\n== Caminho 4: ingest.ts, nasce 'ignored' (regra 17/08) — forma ANTIGA: resolved_at SEM resolved_by ==");
  const r4 = await db.query(
    `insert into incidents (kind, cause, status, signature, title, resolved_at)
     values ('training','user_dataset','ignored','teste:nasce-ignored','t','2026-08-20T12:00:00Z')
     returning status, resolved_at, resolved_by`,
  );
  ok(
    r4.rows[0].resolved_by != null && new Date(r4.rows[0].resolved_at).toISOString() === "2026-08-20T12:00:00.000Z",
    "insert nascido fechado → resolved_by preenchido e resolved_at do chamador PRESERVADO",
    JSON.stringify(r4.rows[0]),
  );

  console.log("\n== Caminho 5: fechamento correto (código novo / fechar_incidente.cjs): manda tudo ==");
  const c5 = await insere("teste:completo");
  await db.query(
    `update incidents set status='fixed', resolved_by='frank', resolved_at='2026-08-20T21:00:00Z', resolved_commit='abc1234' where id=$1`,
    [c5],
  );
  r = await le(c5);
  ok(
    r.resolved_by === "frank" && new Date(r.resolved_at).toISOString() === "2026-08-20T21:00:00.000Z",
    "valores do chamador NUNCA são sobrescritos",
    JSON.stringify(r),
  );

  console.log("\n== Regra nova A: reabertura LIMPA resolved_at/resolved_by (card 261b295b) ==");
  await db.query(`update incidents set status='open' where id=$1`, [c5]);
  r = await le(c5);
  ok(
    r.status === "open" && r.resolved_by == null && r.resolved_at == null,
    "fixed→open zera resolved_* (carimbo velho mentiria pra próxima medição do detector)",
    JSON.stringify(r),
  );

  console.log("\n== Regra nova A2: reabertura com valor EXPLÍCITO do chamador preserva o que ele mandou ==");
  await db.query(
    `update incidents set status='fixed', resolved_by='frank', resolved_at='2026-08-20T21:00:00Z' where id=$1`,
    [c5],
  );
  await db.query(
    `update incidents set status='open', resolved_at='2026-08-19T00:00:00Z' where id=$1`,
    [c5],
  );
  r = await le(c5);
  ok(
    new Date(r.resolved_at).toISOString() === "2026-08-19T00:00:00.000Z" && r.resolved_by == null,
    "campo que o chamador mexeu fica; campo que ele não mexeu é limpo",
    JSON.stringify(r),
  );

  console.log("\n== Não-regressão B: update qualquer em incidente fechado não mexe nos campos ==");
  await db.query(`update incidents set occurrences = occurrences + 1 where id=$1`, [c3]);
  const antes = r = await le(c3);
  await new Promise((rs) => setTimeout(rs, 20));
  await db.query(`update incidents set occurrences = occurrences + 1 where id=$1`, [c3]);
  const depois = await le(c3);
  ok(
    String(antes.resolved_at) === String(depois.resolved_at),
    "bump de ocorrência não altera resolved_at já gravado",
    `${antes.resolved_at} == ${depois.resolved_at}`,
  );

  console.log("\n== Não-regressão C: incidente aberto segue sem resolved_* ==");
  const c7 = await insere("teste:aberto");
  r = await le(c7);
  ok(r.resolved_at == null && r.resolved_by == null, "open não ganha campo nenhum", JSON.stringify(r));

  console.log("\n== Não-regressão D: linha JÁ fechada e cega (caso 72055f75/bee2fb8b) não ganha data inventada ==");
  // reproduz o estado histórico: fechada sem data, direto no banco, sem passar
  // pelo trigger de transição (o trigger não carimba porque old.status já é fechado)
  const c8 = await insere("teste:cega-historica");
  await db.query(`alter table incidents disable trigger incidents_resolved_guard`);
  await db.query(`update incidents set status='ignored' where id=$1`, [c8]);
  await db.query(`alter table incidents enable trigger incidents_resolved_guard`);
  await db.query(`update incidents set occurrences = occurrences + 1 where id=$1`, [c8]);
  r = await le(c8);
  ok(
    r.resolved_at == null && r.resolved_by == null,
    "bump em fechada-cega NÃO inventa resolved_at (data inventada é pior que campo vazio)",
    JSON.stringify(r),
  );
  console.log("\n== Não-regressão E: reabrir e RE-fechar carimba de novo (transição real) ==");
  await db.query(`update incidents set status='open' where id=$1`, [c8]);
  await db.query(`update incidents set status='fixed' where id=$1`, [c8]);
  r = await le(c8);
  ok(r.resolved_at != null && r.resolved_by != null, "open→fixed depois de reaberta → carimbado", JSON.stringify(r));

  console.log(`\n${falhas === 0 ? "TODOS OS CENÁRIOS PASSARAM" : `${falhas} CENÁRIO(S) FALHARAM`}`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("ERRO DO HARNESS:", e);
  process.exit(1);
});
