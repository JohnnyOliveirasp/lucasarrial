"use client";

/**
 * E4 · b-roll POR CIMA do vídeo clone (W5 fase 4 — "planner sugere, pessoa
 * ajusta", decisão do Johnny 12/08). Esteira: áudio da E2 vira projeto do
 * Estúdio (import-audio, MESMO fluxo do caminho Cenas) → planner sugere 1
 * cena por frase (plan_only, sem custo) → pessoa desmarca frases → gera SÓ
 * as escolhidas (1.800 cr/nova, reuso grátis) → job broll_overlay aplica as
 * cenas nas janelas das frases (áudio/duração do clone intocados).
 * Resultado → draft.videoEditadoKey (a legenda encadeia por cima dele).
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Clapperboard, Film, Loader2, X } from "lucide-react";
import { STUDIO_SCENE_COST } from "@/lib/studio/pricing";
import { STUDIO_CLEAN_COST } from "@/lib/credits/config";
import { EDICAO_BROLL_COST } from "@/lib/edicao/pricing";
import type { AudioSel, EdicaoDraft } from "./edicao-wizard";

type Sugestao = { sentence: number; text: string; reused: boolean };
type Cena = { id: string; concept: string; status: string; reused: boolean };
type Projeto = {
  id: string;
  status: string;
  error_message: string | null;
  scenes_status: "idle" | "generating" | "ready" | "failed";
  scenes: Cena[];
};

type Props = {
  draft: EdicaoDraft;
  onChange: (patch: Partial<EdicaoDraft>) => void;
};

async function importarAudio(audio: AudioSel): Promise<string> {
  const body = audio.kind === "generation" ? { generation_id: audio.id } : { take_key: audio.key };
  const res = await fetch("/api/v1/studio/import-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? "");
  return (j?.data?.audio_key ?? j?.audio_key) as string;
}

export function EditarCloneBroll({ draft, onChange }: Props) {
  const t = useTranslations("edicao.editar.broll");
  const projectId = draft.brollProjectId;
  const [proj, setProj] = useState<Projeto | null>(null);
  const [plano, setPlano] = useState<Sugestao[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const job = draft.brollJob;

  const carregar = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/v1/studio/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      const p = (j?.data?.project ?? j?.project) as Projeto | undefined;
      if (p) setProj(p);
    } catch {
      /* próximo tick */
    }
  }, []);

  // Poll do projeto (o GET é o motor do Estúdio).
  const ativo = !!proj && (proj.status === "processing" || proj.scenes_status === "generating");
  useEffect(() => {
    if (!projectId) return;
    void carregar(projectId);
  }, [projectId, carregar]);
  useEffect(() => {
    if (!projectId || !ativo) return;
    const timer = setInterval(() => void carregar(projectId), 5000);
    return () => clearInterval(timer);
  }, [projectId, ativo, carregar]);

  // Sugestão do planner assim que o áudio fica pronto (sem custo).
  useEffect(() => {
    if (!projectId || !proj || proj.status !== "audio_ready" || proj.scenes_status !== "idle" || plano) return;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/studio/${projectId}/scenes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_only: true }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error?.message ?? "");
        const p = ((j?.data?.plan ?? j?.plan ?? []) as Sugestao[]);
        setPlano(p);
        setMarcadas(new Set(p.map((s) => s.sentence)));
      } catch {
        setErro(t("erroPlanejar"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, proj?.status, proj?.scenes_status]);

  // Poll do job de overlay.
  useEffect(() => {
    if (!job) return;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/v1/edicao/broll?job=${encodeURIComponent(job.job)}&key=${encodeURIComponent(job.key)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const d = (await res.json())?.data ?? {};
        if (d.status === "ready") {
          setVideoUrl(d.video_url ?? null);
          onChange({ videoEditadoKey: job.key, brollJob: null });
        } else if (d.status === "failed") {
          setErro(d.error ?? t("erroAplicar"));
          onChange({ brollJob: null });
        }
      } catch {
        /* próximo tick */
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.job]);

  async function iniciar() {
    if (!draft.audio) return;
    setBusy("iniciar");
    setErro(null);
    try {
      const audioKey = await importarAudio(draft.audio);
      const res = await fetch("/api/v1/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_key: audioKey, name: "Vídeo Edição 2.0 — b-roll" }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(t("semCreditos"));
      if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? t("erroIniciar"));
      onChange({ brollProjectId: (j?.data?.project?.id ?? j?.project?.id) as string });
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erroIniciar"));
    } finally {
      setBusy(null);
    }
  }

  async function gerarCenas() {
    if (!projectId) return;
    setBusy("cenas");
    setErro(null);
    try {
      const res = await fetch(`/api/v1/studio/${projectId}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentences: [...marcadas] }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(t("semCreditos"));
      if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? t("erroCenas"));
      await carregar(projectId);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erroCenas"));
    } finally {
      setBusy(null);
    }
  }

  async function aplicar() {
    if (!projectId || !draft.video || draft.video.kind === "cenas") return;
    setBusy("aplicar");
    setErro(null);
    try {
      const res = await fetch("/api/v1/edicao/broll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, video: { kind: draft.video.kind, id: draft.video.id } }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(t("semCreditos"));
      if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? t("erroAplicar"));
      const d = j?.data ?? j;
      onChange({ brollJob: { job: d.job_id, key: d.output_key } });
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erroAplicar"));
    } finally {
      setBusy(null);
    }
  }

  const novasMarcadas = plano ? plano.filter((s) => marcadas.has(s.sentence) && !s.reused).length : 0;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--ink)]">
        <Clapperboard className="size-4" /> {t("titulo")}
      </p>

      {job ? (
        <p className="flex items-center gap-2 text-[13.5px] text-[var(--ink)]">
          <Loader2 className="size-4 animate-spin" /> {t("aplicando")}
        </p>
      ) : !projectId ? (
        <>
          <p className="text-[13px] text-[var(--mute)]">{t("intro")}</p>
          <button
            type="button"
            onClick={() => void iniciar()}
            disabled={busy !== null}
            className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            {busy === "iniciar" ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
            {t("iniciar", { custo: STUDIO_CLEAN_COST })}
          </button>
        </>
      ) : !proj || proj.status === "processing" ? (
        <p className="flex items-center gap-2 text-[13px] text-[var(--mute)]">
          <Loader2 className="size-4 animate-spin" /> {t("preparando")}
        </p>
      ) : proj.status === "failed" ? (
        <p className="text-[13px] text-red-400">{proj.error_message || t("erroIniciar")}</p>
      ) : proj.scenes_status === "idle" && plano ? (
        <>
          <p className="text-[13px] text-[var(--mute)]">{t("sugestao")}</p>
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
            {plano.map((s) => (
              <li key={s.sentence}>
                <label className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2">
                  <input
                    type="checkbox"
                    checked={marcadas.has(s.sentence)}
                    onChange={(e) => {
                      const novo = new Set(marcadas);
                      if (e.target.checked) novo.add(s.sentence);
                      else novo.delete(s.sentence);
                      setMarcadas(novo);
                    }}
                    className="mt-0.5 accent-[var(--ink)]"
                  />
                  <span className="text-[12.5px] leading-snug text-[var(--ink)]">
                    “{s.text}”{" "}
                    {s.reused && <span className="text-[10.5px] text-emerald-400">{t("gratis")}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void gerarCenas()}
            disabled={busy !== null || marcadas.size === 0}
            className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            {busy === "cenas" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {t("gerarCenas", { n: marcadas.size, custo: novasMarcadas * STUDIO_SCENE_COST })}
          </button>
        </>
      ) : proj.scenes_status === "idle" ? (
        <p className="flex items-center gap-2 text-[13px] text-[var(--mute)]">
          <Loader2 className="size-4 animate-spin" /> {t("planejando")}
        </p>
      ) : proj.scenes_status === "generating" ? (
        <p className="flex items-center gap-2 text-[13px] text-[var(--ink)]">
          <Loader2 className="size-4 animate-spin" />
          {t("gerandoCenas", {
            prontas: proj.scenes.filter((c) => c.status === "ready").length,
            total: proj.scenes.length,
          })}
        </p>
      ) : proj.scenes_status === "failed" ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[13px] text-amber-300">
            <X className="size-3.5" /> {t("cenasFalharam")}
          </p>
          <button
            type="button"
            onClick={() => void gerarCenas()}
            disabled={busy !== null}
            className="w-fit rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3.5 py-2 text-[13px] text-[var(--ink)] disabled:opacity-40"
          >
            {t("tentarDeNovo")}
          </button>
        </div>
      ) : (
        <>
          {videoUrl && <video src={videoUrl} controls className="max-h-96 w-full rounded-[var(--radius-sm)]" />}
          <button
            type="button"
            onClick={() => void aplicar()}
            disabled={busy !== null}
            className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            {busy === "aplicar" ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
            {t("aplicar", { custo: EDICAO_BROLL_COST })}
          </button>
        </>
      )}

      {erro && <p className="text-[13px] text-red-400">{erro}</p>}
    </div>
  );
}
