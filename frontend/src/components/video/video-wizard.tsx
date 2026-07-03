"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AudioLines,
  Clapperboard,
  ImageIcon,
  Film,
  Layers,
  Check,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { sceneCountForDuration, SECONDS_PER_SCENE } from "@/lib/video/config";
import { Eyebrow } from "@/components/ui";
import { SceneStage } from "@/components/video/scene-stage";
import { ImageStage } from "@/components/video/image-stage";
import { VideoStage } from "@/components/video/video-stage";

type Project = {
  id: string;
  name: string | null;
  status: "draft" | "scenes" | "images" | "videos" | "rendering" | "done" | "failed";
  audio_duration_seconds: number | null;
  script_text: string | null;
  aspect_ratio: string;
  scene_count: number | null;
  created_at: string;
  audio_url: string | null;
};

// Os 5 estágios do pipeline. `key` casa com os status que já "passaram" dele.
const STAGES = [
  { id: "audio", label: "Áudio", icon: AudioLines },
  { id: "scenes", label: "Cenas", icon: Layers },
  { id: "images", label: "Imagens", icon: ImageIcon },
  { id: "videos", label: "Vídeos", icon: Film },
  { id: "final", label: "Final", icon: Clapperboard },
] as const;

// Índice do estágio "atual" a partir do status do projeto.
// done = 5 (além do último índice) → todos os 5 pills aparecem concluídos.
const STEP_BY_STATUS: Record<Project["status"], number> = {
  draft: 1,
  scenes: 1,
  images: 2,
  videos: 3,
  rendering: 4,
  done: 5,
  failed: 1,
};

function fmtDuration(secs: number | null): string {
  if (secs == null) return "—";
  const s = Math.round(secs);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}min${r.toString().padStart(2, "0")}s` : `${r}s`;
}

export function VideoWizard({ projectId, locale }: { projectId: string; locale: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/videos/${projectId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Projeto não encontrado");
      const json = await res.json();
      setProject(json.project as Project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--mute)]">Carregando projeto…</p>
      </section>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-[var(--status-error)]">{error ?? "Projeto não encontrado"}</p>
        <Link
          href={`/${locale}/app/videos/history`}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao board
        </Link>
      </div>
    );
  }

  const currentStep = STEP_BY_STATUS[project.status];
  const sceneCount =
    project.scene_count ?? sceneCountForDuration(project.audio_duration_seconds ?? 0);

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Link
          href={`/${locale}/app/videos/history`}
          className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] tracking-wide text-[var(--ash)] transition-colors hover:text-[var(--ink)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Board
        </Link>
        <Eyebrow>Wizard de vídeo</Eyebrow>
        <h1 className="font-sans text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {project.name?.trim() ||
            `Vídeo ${new Date(project.created_at).toLocaleDateString("pt-BR")}`}
        </h1>
      </header>

      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2">
        {STAGES.map((stage, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          const Icon = done ? Check : stage.icon;
          return (
            <li key={stage.id} className="flex items-center gap-2">
              <span
                className={[
                  "inline-flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-[13px] font-medium",
                  done
                    ? "border-[var(--hairline-strong)] bg-[var(--surface-elevated)] text-[var(--ink)]"
                    : active
                      ? "border-[var(--hairline-bright)] bg-[var(--surface-card)] text-[var(--ink)]"
                      : "border-[var(--hairline)] bg-transparent text-[var(--ash)]",
                ].join(" ")}
              >
                <Icon className={`h-4 w-4 ${done ? "text-[var(--silver)]" : ""}`} />
                {stage.label}
              </span>
              {i < STAGES.length - 1 && (
                <span className="h-px w-4 bg-[var(--hairline)]" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      {/* Estágio 1 — Áudio (concluído) */}
      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--silver)] text-[var(--canvas)]">
            <Check className="h-3.5 w-3.5" />
          </span>
          <h2 className="font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
            Áudio selecionado
          </h2>
        </div>
        {project.audio_url ? (
          <audio controls preload="metadata" src={project.audio_url} className="h-9 w-full sm:max-w-md" />
        ) : (
          <p className="font-mono text-[11px] text-[var(--ash)]">áudio indisponível</p>
        )}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-wide text-[var(--ash)]">
          <span>{fmtDuration(project.audio_duration_seconds)}</span>
          <span>· {project.aspect_ratio}</span>
          <span>
            · ~{sceneCount} cenas de {SECONDS_PER_SCENE}s
          </span>
        </div>
        {project.script_text && (
          <p className="line-clamp-3 max-w-2xl rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] p-3 text-[13px] text-[var(--mute)]">
            {project.script_text}
          </p>
        )}
      </section>

      {/* Estágio 2 — Cenas */}
      <SceneStage
        projectId={project.id}
        locale={locale}
        status={project.status}
        estimatedScenes={sceneCount}
        onProjectChanged={load}
      />

      {/* Estágio 3 — Imagens (aparece quando as cenas já existem) */}
      {(project.scene_count ?? 0) > 0 && (
        <ImageStage projectId={project.id} locale={locale} onProjectChanged={load} />
      )}

      {/* Estágio 4 — Vídeos (aparece quando as cenas já existem; gate interno exige imagens prontas) */}
      {(project.scene_count ?? 0) > 0 && (
        <VideoStage projectId={project.id} locale={locale} onProjectChanged={load} />
      )}

    </div>
  );
}
