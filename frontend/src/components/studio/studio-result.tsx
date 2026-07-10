"use client";

/**
 * Painel de resultado do Vídeo Estúdio: progresso/resultado da limpeza de
 * áudio (F0) + montagem do vídeo de teste (F1). Extraído do workspace pra
 * manter os arquivos <400 linhas.
 */
import { Clapperboard, Download, Loader2, RefreshCw } from "lucide-react";
import { downloadFromUrl } from "@/components/image/download-file";

const PILL =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-6 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50";
const GHOST =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-6 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98] disabled:opacity-50";
const LABEL = "font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]";

export type StudioProjectDetail = {
  id: string;
  name: string | null;
  status: "processing" | "audio_ready" | "failed";
  duration_raw_seconds: number | null;
  duration_clean_seconds: number | null;
  kept_takes: number | null;
  removed_takes: number | null;
  transcript_words: { start: number; end: number; word: string }[] | null;
  edit_report: string | null;
  error_message: string | null;
  clean_audio_url: string | null;
  montage_status?: "idle" | "processing" | "ready" | "failed";
  montage_error?: string | null;
  montage_report?: string | null;
  video_url?: string | null;
};

export function fmtSecs(s: number | null | undefined): string {
  if (!s || s <= 0) return "–";
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return m > 0 ? `${m}min${String(r).padStart(2, "0")}s` : `${r}s`;
}

export function StudioResult({
  project,
  busy,
  onMontage,
  onReset,
}: {
  project: StudioProjectDetail;
  busy: boolean;
  onMontage: () => void;
  onReset: () => void;
}) {
  const transcript = project.transcript_words?.map((w) => w.word.trim()).join(" ") ?? "";

  return (
    <div className="flex flex-col gap-5">
      {project.status === "processing" && (
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--silver)]" />
          <div className="flex flex-col">
            <span className="text-sm text-[var(--ink)]">
              Editando seu áudio — cortando erros e pausas…
            </span>
            <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
              Leva ~1-2 minutos. Pode sair e voltar — fica salvo no histórico.
            </span>
          </div>
        </div>
      )}

      {project.status === "audio_ready" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] tracking-wide text-[var(--silver)]">
            <span>bruto: {fmtSecs(project.duration_raw_seconds)}</span>
            <span>→ limpo: {fmtSecs(project.duration_clean_seconds)}</span>
            <span>
              {project.removed_takes
                ? `${project.removed_takes} trecho(s) errado(s) removido(s)`
                : "nenhuma repetição detectada"}
            </span>
          </div>
          {project.clean_audio_url && (
            <audio src={project.clean_audio_url} controls preload="metadata" className="w-full max-w-xl" />
          )}
          {transcript && (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>O que ficou no áudio</span>
              <p className="max-w-2xl text-sm leading-relaxed text-[var(--mute)]">{transcript}</p>
            </div>
          )}
          {project.edit_report && (
            <details className="max-w-2xl">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wide text-[var(--ash)] hover:text-[var(--silver)]">
                Relatório da edição (fala a fala)
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-3 font-mono text-[11px] leading-relaxed text-[var(--mute)]">
                {project.edit_report}
              </pre>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            {project.clean_audio_url && (
              <button
                type="button"
                onClick={() => downloadFromUrl(project.clean_audio_url!, project.name || "audio-limpo", "wav")}
                className={GHOST}
              >
                <Download className="h-4 w-4" /> Baixar áudio limpo
              </button>
            )}
            <button type="button" onClick={onReset} className={GHOST}>
              <RefreshCw className="h-4 w-4" /> Preparar outro áudio
            </button>
          </div>

          {/* ───── F1: vídeo de teste montado a partir do áudio limpo ───── */}
          <div className="mt-1 flex flex-col gap-3 border-t border-dashed border-[var(--hairline-strong)] pt-4">
            <span className={LABEL}>Vídeo de teste — motor de montagem (cenas fixas)</span>

            {(!project.montage_status || project.montage_status === "idle") && (
              <button type="button" onClick={onMontage} disabled={busy} className={`${PILL} w-fit`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                Montar vídeo de teste
              </button>
            )}

            {project.montage_status === "processing" && (
              <span className="flex items-center gap-2 text-sm text-[var(--ink)]">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />
                Montando o vídeo — J-cuts, ritmo e zoom… (~2-4 min)
              </span>
            )}

            {project.montage_status === "ready" && project.video_url && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <video
                  src={project.video_url}
                  controls
                  loop
                  playsInline
                  preload="metadata"
                  className="max-h-[480px] w-auto max-w-full rounded-[var(--radius)] border border-[var(--hairline-strong)]"
                />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => downloadFromUrl(project.video_url!, project.name || "video-estudio", "mp4")}
                    className={PILL}
                  >
                    <Download className="h-4 w-4" /> Baixar vídeo
                  </button>
                  <button type="button" onClick={onMontage} disabled={busy} className={GHOST}>
                    <RefreshCw className="h-4 w-4" /> Montar de novo
                  </button>
                  {project.montage_report && (
                    <details className="max-w-md">
                      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wide text-[var(--ash)] hover:text-[var(--silver)]">
                        Plano de cortes
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-3 font-mono text-[11px] leading-relaxed text-[var(--mute)]">
                        {project.montage_report}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            {project.montage_status === "failed" && (
              <div className="flex flex-col gap-2">
                <p className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
                  {project.montage_error || "A montagem falhou. Tente novamente."}
                </p>
                <button type="button" onClick={onMontage} disabled={busy} className={`${GHOST} w-fit`}>
                  <RefreshCw className="h-4 w-4" /> Tentar montar de novo
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {project.status === "failed" && (
        <div className="flex flex-col gap-3">
          <p className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
            {project.error_message || "O processamento falhou. Tente novamente."}
          </p>
          <button type="button" onClick={onReset} className={`${GHOST} w-fit`}>
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}
