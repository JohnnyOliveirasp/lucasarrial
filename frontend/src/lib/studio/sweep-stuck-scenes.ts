/**
 * Cenas do Estúdio presas — reconciliação por cron (26/08).
 *
 * POR QUE EXISTE: a cena do Estúdio só avançava quando ALGUÉM ABRIA A TELA do
 * projeto — é o GET /api/v1/studio/[id] que chama `syncStudioScene`. Não havia
 * webhook nem cron. Quem fechava a aba ficava com a cena parada para sempre e o
 * projeto inteiro travado por ela (caso Fabio Fiuza, 26/08: "não refaz e eu
 * fico preso sem poder avançar").
 *
 * Medido no dia em que isto foi escrito: **34 cenas presas há mais de 1 hora**,
 * a mais antiga há **317 horas** — o Kie já tinha terminado o trabalho e
 * ninguém foi buscar. É a mesma classe do incidente 69f0aec5 das imagens (row
 * presa 28 dias), que ganhou sweep e deixou o Estúdio de fora.
 *
 * ⚠️ Corrida com a tela: se o aluno estiver com o projeto aberto, os dois vão
 * sincronizar a mesma cena. `syncStudioScene` é idempotente (decide pelo status
 * lido na hora), então o pior caso é uma chamada repetida ao Kie — não duplica
 * cena nem cobra de novo.
 */
import { getAdmin } from "@/lib/db/admin";
import type { StudioSceneRow } from "@/lib/db/types";
import { syncStudioScene } from "@/lib/studio/scenes";

/** Só mexe em cena parada há mais de 3 min — abaixo disso a tela dá conta. */
const IDADE_MINIMA_MS = 3 * 60 * 1000;
/** Teto por rodada: o cron roda a cada 5 min e não pode estourar o tempo. */
const MAX_POR_RODADA = 12;

export type StudioSceneSweep = {
  checked: number;
  ready: number;
  failed: number;
  still_running: number;
  errors: number;
  /** Projetos cujo scenes_status foi fechado (ready/failed) nesta rodada. */
  projects_closed: number;
};

/**
 * Fecha `scenes_status` dos projetos cujas cenas já terminaram. Sem isto o
 * status só virava "ready" no GET da tela — com todas as cenas prontas o
 * projeto seguia "generating", o painel de cena ficava travado e o botão de
 * montar não aparecia (Fabio Fiuza 26/08: 10/10 cenas ready, projeto preso).
 * Mesma guarda do GET: só mexe se ainda estiver "generating".
 */
async function fecharProjetosProntos(admin: ReturnType<typeof getAdmin>): Promise<number> {
  const { data: projetos } = await admin
    .from("studio_projects")
    .select("id, scene_plan")
    .eq("scenes_status", "generating")
    .limit(50);
  let fechados = 0;
  for (const p of (projetos ?? []) as { id: string; scene_plan: { scene_id: string }[] | null }[]) {
    const ids = [...new Set((p.scene_plan ?? []).map((x) => x.scene_id))];
    if (ids.length === 0) continue;
    const { data: cenas } = await admin.from("studio_scenes").select("status").in("id", ids);
    const rows = (cenas ?? []) as { status: string }[];
    if (rows.length === 0) continue;
    const pendente = rows.some((c) => c.status !== "ready" && c.status !== "failed");
    if (pendente) continue;
    const falhou = rows.some((c) => c.status === "failed");
    const { data: upd } = await admin
      .from("studio_projects")
      .update({ scenes_status: falhou ? "failed" : "ready" } as never)
      .eq("id", p.id)
      .eq("scenes_status", "generating")
      .select("id");
    if (upd && upd.length > 0) fechados += 1;
  }
  return fechados;
}

export async function sweepStuckStudioScenes(): Promise<StudioSceneSweep> {
  const admin = getAdmin();
  const out: StudioSceneSweep = { checked: 0, ready: 0, failed: 0, still_running: 0, errors: 0, projects_closed: 0 };

  const cutoff = new Date(Date.now() - IDADE_MINIMA_MS).toISOString();
  const { data, error } = await admin
    .from("studio_scenes")
    .select("*")
    .in("status", ["generating_still", "animating"])
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(MAX_POR_RODADA);
  if (error || !data) return out;

  for (const row of data as StudioSceneRow[]) {
    out.checked += 1;
    try {
      // Duas passadas: o still que ficou pronto já emenda na animação na mesma
      // rodada, em vez de esperar os próximos 5 minutos.
      await syncStudioScene(row);
      const { data: meio } = await admin
        .from("studio_scenes")
        .select("*")
        .eq("id", row.id)
        .maybeSingle();
      if (meio && (meio as StudioSceneRow).status === "animating") {
        await syncStudioScene(meio as StudioSceneRow);
      }
      const { data: fim } = await admin
        .from("studio_scenes")
        .select("status")
        .eq("id", row.id)
        .maybeSingle();
      const st = (fim as { status?: string } | null)?.status;
      if (st === "ready") out.ready += 1;
      else if (st === "failed") out.failed += 1;
      else out.still_running += 1;
    } catch (e) {
      out.errors += 1;
      console.error("[sweep-studio-scenes]", row.id, e instanceof Error ? e.message : e);
    }
  }
  try {
    out.projects_closed = await fecharProjetosProntos(admin);
  } catch (e) {
    out.errors += 1;
    console.error("[sweep-studio-scenes] fechar projetos:", e instanceof Error ? e.message : e);
  }
  return out;
}
