/**
 * Vigia noturno — EXECUTOR da rodada (a espinha).
 *
 * Responsabilidades: mutex, iterar o registro isolando exceções, teto por
 * tabela, memória de "já olhei" (night_watch_seen), histórico da rodada
 * (night_watch_runs) e o relatório — que sai SEMPRE, mesmo com zero achado,
 * porque silêncio confundido com saúde foi o que deixou 43 vozes paradas.
 *
 * DRY-RUN é o padrão: relata o que FARIA e não escreve NADA (nem o histórico
 * da rodada). Live só com ?live=1 explícito no endpoint.
 */
import { getAdmin } from "@/lib/db/admin";
import { DETECTORS, capForTable } from "./registry";
import { buildReport } from "./report";
import type {
  DetectorSummary,
  NightWatchFinding,
  NightWatchRunResult,
} from "./types";

/** Rodada em andamento há mais que isto = morreu sem finalizar; ignora no mutex. */
const MUTEX_STALE_MS = 30 * 60 * 1000;

/**
 * Mutex em memória: o pm2 roda UMA instância do app, então isto barra duas
 * chamadas simultâneas do cron sem escrever nada (importante pro dry-run,
 * que não pode tocar o banco). O live ainda confere night_watch_runs, que
 * sobrevive a restart.
 */
let runningInProcess = false;

type SeenRow = { item_key: string; times_seen: number };

const keyOf = (f: NightWatchFinding) => `${f.table}:${f.id}`;

export async function runNightWatch(opts: { dryRun: boolean }): Promise<NightWatchRunResult> {
  const startedAt = new Date().toISOString();
  const writes: string[] = [];
  const skipped = (why: string): NightWatchRunResult => ({
    ok: true,
    status: "skipped_mutex",
    dryRun: opts.dryRun,
    startedAt,
    finishedAt: new Date().toISOString(),
    detectors: [],
    findings: [],
    report: `📊 FastCloner — Vigia noturno\n\nRodada NÃO executada: ${why}. Saí limpo.`,
    writes,
  });

  if (runningInProcess) return skipped("já existe rodada em andamento neste processo");
  runningInProcess = true;
  try {
    return await execute(opts.dryRun, startedAt, writes, skipped);
  } finally {
    runningInProcess = false;
  }
}

async function execute(
  dryRun: boolean,
  startedAt: string,
  writes: string[],
  skipped: (why: string) => NightWatchRunResult,
): Promise<NightWatchRunResult> {
  const db = getAdmin();
  let runId: string | null = null;

  if (!dryRun) {
    // Mutex persistente: rodada "running" recente em night_watch_runs barra a
    // segunda chamada. Linha running velha = rodada que morreu; marca failed
    // pra não assombrar o histórico.
    const { data: liveRows, error: mutexErr } = await db
      .from("night_watch_runs" as never)
      .select("id, started_at, status")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(5);
    if (mutexErr) {
      // Sem conseguir ler o mutex não dá pra garantir exclusão — sai limpo e
      // reporta, em vez de arriscar rodada dupla.
      return skipped(`não consegui ler night_watch_runs (${mutexErr.message})`);
    }
    const rows = (liveRows ?? []) as unknown as { id: string; started_at: string }[];
    const fresh = rows.filter((r) => Date.now() - new Date(r.started_at).getTime() < MUTEX_STALE_MS);
    if (fresh.length > 0) return skipped("rodada anterior ainda em andamento (night_watch_runs)");
    for (const stale of rows) {
      await db
        .from("night_watch_runs" as never)
        .update({ status: "failed", finished_at: new Date().toISOString(), error: "rodada morreu sem finalizar (marcada pelo mutex)" } as never)
        .eq("id", stale.id);
      writes.push(`night_watch_runs ${stale.id} marcada failed (estava running e velha)`);
    }

    const { data: created, error: createErr } = await db
      .from("night_watch_runs" as never)
      .insert({ started_at: startedAt, status: "running", dry_run: false } as never)
      .select("id")
      .single();
    if (createErr) return skipped(`não consegui registrar a rodada (${createErr.message})`);
    runId = (created as unknown as { id: string }).id;
    writes.push(`night_watch_runs ${runId} criada (running)`);
  } else {
    writes.push("[dry] criaria linha em night_watch_runs");
  }

  // ── Detectores: cada um isolado; exceção vira resultado da rodada, nunca queda.
  const summaries: DetectorSummary[] = [];
  const newFindings: NightWatchFinding[] = [];
  const seenToBump: { f: NightWatchFinding; detector: string }[] = [];

  for (const det of DETECTORS) {
    const s: DetectorSummary = {
      name: det.name,
      table: det.table,
      checked: 0,
      found: 0,
      truncated: 0,
      alreadySeen: 0,
      fixed: 0, // a espinha não corrige nada; a resolvedora (Onda 2) preenche
      error: null,
      anomaly: null,
    };
    try {
      const r = await det.run({ db, now: new Date(), dryRun });
      s.checked = r.checked;
      s.found = r.findings.length;
      if (r.checked === 0 && det.expectRows) {
        s.anomaly = `checou 0 linhas em "${det.table}", que certamente tem linhas — consulta possivelmente quebrada; NÃO tratar como saúde`;
      }

      // Quem espera há mais tempo é quem mais perde: mais antigo primeiro.
      const ordered = [...r.findings].sort((a, b) => b.ageHours - a.ageHours);

      // "Já olhei": item insolúvel não volta a consumir o teto toda rodada
      // (armadilha de 18/08 — ele comia o teto e escondia o resolvível).
      const keys = ordered.map(keyOf);
      let seenKeys = new Set<string>();
      if (keys.length > 0) {
        const { data: seenRows, error: seenErr } = await db
          .from("night_watch_seen" as never)
          .select("item_key, times_seen")
          .in("item_key", keys);
        if (seenErr) throw new Error(`consulta em night_watch_seen falhou: ${seenErr.message}`);
        seenKeys = new Set(((seenRows ?? []) as unknown as SeenRow[]).map((x) => x.item_key));
      }
      const unseen = ordered.filter((f) => !seenKeys.has(keyOf(f)));
      const seen = ordered.filter((f) => seenKeys.has(keyOf(f)));
      s.alreadySeen = seen.length;
      seenToBump.push(...seen.map((f) => ({ f, detector: det.name })));

      const cap = capForTable(det.table);
      const kept = unseen.slice(0, cap);
      s.truncated = unseen.length - kept.length; // teto nunca é silencioso: vai no relatório
      newFindings.push(...kept);
      // Sem resolvedora ainda (Onda 2), todo novo achado vira "já olhei".
      seenToBump.push(...kept.map((f) => ({ f, detector: det.name })));
    } catch (e) {
      s.error = e instanceof Error ? e.message : String(e);
    }
    summaries.push(s);
  }

  newFindings.sort((a, b) => b.ageHours - a.ageHours);

  // ── Memória "já olhei": incrementa quem voltou, insere quem é novo.
  if (seenToBump.length > 0) {
    if (dryRun) {
      writes.push(`[dry] marcaria/incrementaria ${seenToBump.length} item(ns) em night_watch_seen`);
    } else {
      await bumpSeen(seenToBump, writes);
    }
  }

  const finishedAt = new Date().toISOString();
  const errorsTotal = summaries.filter((s) => s.error).length;
  const result: NightWatchRunResult = {
    ok: true,
    status: "done",
    dryRun,
    startedAt,
    finishedAt,
    detectors: summaries,
    findings: newFindings,
    report: "",
    writes,
  };
  result.report = buildReport(result);

  if (!dryRun && runId) {
    const { error: finErr } = await db
      .from("night_watch_runs" as never)
      .update({
        status: "done",
        finished_at: finishedAt,
        detectors: summaries,
        found_total: newFindings.length,
        fixed_total: 0,
        errors_total: errorsTotal,
        report: result.report,
      } as never)
      .eq("id", runId);
    if (finErr) writes.push(`⚠️ falhou ao finalizar night_watch_runs: ${finErr.message}`);
    else writes.push(`night_watch_runs ${runId} finalizada (done)`);
  } else {
    writes.push("[dry] finalizaria a linha de night_watch_runs com o resumo e o relatório");
  }
  return result;
}

/** Upsert manual com contador: times_seen+1 pra quem já existia, insert pro novo. */
async function bumpSeen(
  items: { f: NightWatchFinding; detector: string }[],
  writes: string[],
): Promise<void> {
  const db = getAdmin();
  const unique = new Map(items.map((it) => [keyOf(it.f), it]));
  const keys = [...unique.keys()];
  const { data: existRows, error } = await db
    .from("night_watch_seen" as never)
    .select("item_key, times_seen")
    .in("item_key", keys);
  if (error) {
    writes.push(`⚠️ night_watch_seen ilegível, pulei a marcação: ${error.message}`);
    return;
  }
  const existing = new Map(((existRows ?? []) as unknown as SeenRow[]).map((r) => [r.item_key, r.times_seen]));
  const now = new Date().toISOString();
  let inserted = 0;
  let bumped = 0;
  for (const [key, { f, detector }] of unique) {
    const prev = existing.get(key);
    if (prev === undefined) {
      const { error: e } = await db.from("night_watch_seen" as never).insert({
        item_key: key,
        detector,
        kind: f.kind,
        user_id: f.userId,
        summary: f.summary,
        times_seen: 1,
        first_seen_at: now,
        last_seen_at: now,
      } as never);
      if (!e) inserted += 1;
    } else {
      const { error: e } = await db
        .from("night_watch_seen" as never)
        .update({ times_seen: prev + 1, last_seen_at: now, summary: f.summary } as never)
        .eq("item_key", key);
      if (!e) bumped += 1;
    }
  }
  writes.push(`night_watch_seen: ${inserted} novo(s), ${bumped} incrementado(s)`);
}
