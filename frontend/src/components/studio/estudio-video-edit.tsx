"use client";

/**
 * Estúdio F2 — "CapCut automático": sobe a gravação crua, o Cérebro 2 corta
 * erros/silêncios (mesma EDL em A/V) e devolve o vídeo editado com legenda.
 * Fluxo: upload (presigned PUT c/ progresso) → POST /studio {video_key} →
 * poll GET /studio/[id] até video_ready | failed.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UploadCloud, Loader2, AlertCircle, Download, Sparkles } from "lucide-react";

type Phase = "pick" | "uploading" | "processing" | "done" | "error";

type Project = {
  id: string;
  status: string;
  duration_raw_seconds: number | null;
  duration_clean_seconds: number | null;
  kept_takes: number | null;
  removed_takes: number | null;
  edit_report: string | null;
  error_message: string | null;
  edited_video_url: string | null;
};

const ACCEPT = ".mp4,.mov,.webm,.mkv,video/mp4,video/quicktime,video/webm";
const POLL_MS = 10000;

export function EstudioVideoEdit() {
  const t = useTranslations("studio.videoEdit");
  const [phase, setPhase] = useState<Phase>("pick");
  const [profile, setProfile] = useState<"dinamico" | "natural">("dinamico");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  function startPolling(id: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/v1/studio/${id}`);
        if (!r.ok) return;
        const j = await r.json();
        const p: Project = j.project;
        setProject(p);
        if (p.status === "video_ready") {
          setPhase("done");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (p.status === "failed") {
          setError(p.error_message || t("errors.failed"));
          setPhase("error");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        /* próximo tick tenta de novo */
      }
    }, POLL_MS);
  }

  async function onFile(file: File | null) {
    if (!file || phase === "uploading" || phase === "processing") return;
    setError(null);
    setPhase("uploading");
    setProgress(0);
    try {
      // 1. presigned PUT
      const slot = await fetch("/api/v1/studio/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "video",
          filename: file.name,
          content_type: file.type || "video/mp4",
          size: file.size,
        }),
      });
      if (!slot.ok) {
        const b = await slot.json().catch(() => ({}));
        throw new Error(b?.error?.message || t("errors.upload"));
      }
      const { key, upload_url } = await slot.json();

      // 2. PUT com progresso
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", upload_url);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("network"));
        xhr.send(file);
      });

      // 3. cria o projeto (dispara o job)
      const create = await fetch("/api/v1/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_key: key, name: file.name, edit_profile: profile }),
      });
      if (!create.ok) {
        const b = await create.json().catch(() => ({}));
        throw new Error(b?.error?.message || t("errors.start"));
      }
      const { project: created } = await create.json();
      setPhase("processing");
      startPolling(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.upload"));
      setPhase("error");
    }
  }

  const fmt = (s: number | null | undefined) =>
    s == null ? "—" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

  if (phase === "done" && project) {
    return (
      <section className="flex flex-col gap-5">
        <p className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-[var(--status-online)]">
          <Sparkles className="h-4 w-4" /> {t("done.title")}
        </p>
        {project.edited_video_url && (
          <video src={project.edited_video_url} controls className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]" />
        )}
        <div className="flex flex-wrap gap-4 font-mono text-[11px] text-[var(--mute)]">
          <span>{t("done.raw")}: {fmt(project.duration_raw_seconds)}</span>
          <span>{t("done.clean")}: {fmt(project.duration_clean_seconds)}</span>
          <span>{t("done.removed", { n: project.removed_takes ?? 0 })}</span>
        </div>
        {project.edited_video_url && (
          <a
            href={project.edited_video_url}
            download
            className="inline-flex h-10 w-fit items-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium text-[var(--pill-ink)] transition-transform active:scale-[0.98]"
          >
            <Download className="h-4 w-4" /> {t("done.download")}
          </a>
        )}
        {project.edit_report && (
          <details className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4">
            <summary className="cursor-pointer font-mono text-[11px] tracking-wide text-[var(--silver)]">
              {t("done.report")}
            </summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-[var(--mute)]">
              {project.edit_report}
            </pre>
          </details>
        )}
        <button type="button" onClick={() => { setPhase("pick"); setProject(null); }} className="w-fit font-mono text-[12px] text-[var(--mute)] hover:text-[var(--ink)]">
          ← {t("done.again")}
        </button>
      </section>
    );
  }

  if (phase === "processing") {
    return (
      <section className="flex flex-col items-start gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-8">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--silver)]" />
        <p className="text-sm font-medium text-[var(--ink)]">{t("processing.title")}</p>
        <p className="max-w-md text-xs text-[var(--mute)]">{t("processing.hint")}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      {/* Perfil de corte (F1): Dinâmico = padrão da casa; Natural = mais respiro */}
      <div className="flex items-center gap-2">
        {(["dinamico", "natural"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setProfile(p)}
            className={[
              "h-9 rounded-[var(--radius-full)] border px-4 font-mono text-[11px] tracking-wide transition-colors",
              profile === p
                ? "border-[var(--hairline-bright)] bg-[var(--surface-raised)] text-[var(--ink)]"
                : "border-[var(--hairline-strong)] text-[var(--mute)] hover:text-[var(--ink)]",
            ].join(" ")}
          >
            {t(`profiles.${p}`)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={phase === "uploading"}
        className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 transition-colors hover:border-[var(--hairline-bright)] disabled:opacity-60"
      >
        <UploadCloud className="h-8 w-8 text-[var(--mute)]" />
        <span className="text-sm font-medium text-[var(--ink)]">
          {phase === "uploading" ? t("uploading", { pct: progress }) : t("pick.title")}
        </span>
        <span className="text-xs text-[var(--mute)]">{t("pick.hint")}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] text-[var(--status-error)]">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
    </section>
  );
}
