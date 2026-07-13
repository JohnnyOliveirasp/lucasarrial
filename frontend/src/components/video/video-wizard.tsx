"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
  kind?: "story" | "sales";
  status: "draft" | "scenes" | "images" | "videos" | "rendering" | "done" | "failed";
  audio_duration_seconds: number | null;
  script_text: string | null;
  aspect_ratio: string;
  scene_count: number | null;
  created_at: string;
  audio_url: string | null;
  // Vídeo Vendas: resumo do setup (produto/pessoa/análise) exibido no topo.
  product_images?: Array<{ key: string; url: string }>;
  reference_images?: Array<{ key: string; url: string }>;
  product_analysis?: string | null;
  product_price?: string | null;
};

// Os 5 estágios do pipeline. `key` casa com os status que já "passaram" dele.
const STAGES = [
  { id: "audio", icon: AudioLines },
  { id: "scenes", icon: Layers },
  { id: "images", icon: ImageIcon },
  { id: "videos", icon: Film },
  { id: "final", icon: Clapperboard },
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

export function VideoWizard({ projectId }: { projectId: string }) {
  const t = useTranslations("videoWizard.wizard");
  const tc = useTranslations("videoWizard.common");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/videos/${projectId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(tc("projectNotFound"));
      const json = await res.json();
      setProject(json.project as Project);
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setLoading(false);
    }
  }, [projectId, tc]);

  useEffect(() => {
    load();
  }, [load]);

  const boardHref =
    project?.kind === "sales" ? "/app/videos/vendas" : "/app/videos/history";

  if (loading) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--mute)]">{tc("loadingProject")}</p>
      </section>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm text-[var(--status-error)]">{error ?? tc("projectNotFound")}</p>
        <Link
          href={boardHref}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backBoard")}
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
          href={boardHref}
          className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] tracking-wide text-[var(--ash)] transition-colors hover:text-[var(--ink)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("board")}
        </Link>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="font-sans text-[32px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {project.name?.trim() ||
            tc("videoFallbackName", {
              date: new Date(project.created_at).toLocaleDateString("pt-BR"),
            })}
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
                {t(`stages.${stage.id}`)}
              </span>
              {i < STAGES.length - 1 && (
                <span className="h-px w-4 bg-[var(--hairline)]" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      {/* Vídeo Vendas: produto + apresentador + análise (contexto sempre visível) */}
      {project.kind === "sales" && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
              {t("salesHeader")}
            </h2>
            {project.product_price && (
              <span className="font-mono text-[12px] text-[var(--silver)]">{project.product_price}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {(project.product_images ?? []).map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.key} src={img.url} alt={t("productAlt", { n: i + 1 })} className="h-20 w-20 rounded-[var(--radius)] border border-[var(--hairline-strong)] object-cover" />
            ))}
            {(project.reference_images ?? []).map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={img.key} src={img.url} alt={t("presenterAlt", { n: i + 1 })} className="h-20 w-20 rounded-full border border-[var(--hairline-strong)] object-cover" />
            ))}
          </div>
          {project.product_analysis && (
            <details className="group">
              <summary className="cursor-pointer font-mono text-[11px] tracking-wide text-[var(--ash)] transition-colors hover:text-[var(--ink)]">
                {t("seeAnalysis")}
              </summary>
              <div className="mt-2 whitespace-pre-wrap rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] p-4 text-[13px] leading-relaxed text-[var(--body)]">
                {project.product_analysis}
              </div>
            </details>
          )}
        </section>
      )}

      {/* Estágio 1 — Áudio (concluído) */}
      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--silver)] text-[var(--canvas)]">
            <Check className="h-3.5 w-3.5" />
          </span>
          <h2 className="font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
            {t("audioSelected")}
          </h2>
        </div>
        {project.audio_url ? (
          <audio controls preload="metadata" src={project.audio_url} className="h-9 w-full sm:max-w-md" />
        ) : (
          <p className="font-mono text-[11px] text-[var(--ash)]">{tc("audioUnavailable")}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-wide text-[var(--ash)]">
          <span>{fmtDuration(project.audio_duration_seconds)}</span>
          <span>· {project.aspect_ratio}</span>
          <span>· {t("sceneEstimate", { n: sceneCount, s: SECONDS_PER_SCENE })}</span>
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
        status={project.status}
        estimatedScenes={sceneCount}
        onProjectChanged={load}
      />

      {/* Estágio 3 — Imagens (aparece quando as cenas já existem) */}
      {(project.scene_count ?? 0) > 0 && (
        <ImageStage projectId={project.id} onProjectChanged={load} />
      )}

      {/* Estágio 4 — Vídeos (aparece quando as cenas já existem; gate interno exige imagens prontas) */}
      {(project.scene_count ?? 0) > 0 && (
        <VideoStage projectId={project.id} onProjectChanged={load} />
      )}

    </div>
  );
}
