"use client";

/**
 * Painel de resultado do Vídeo Estúdio: progresso/resultado da limpeza de
 * áudio (F0) + montagem do vídeo de teste (F1). Extraído do workspace pra
 * manter os arquivos <400 linhas.
 */
import { useEffect, useRef, useState } from "react";
import { Clapperboard, Download, Loader2, RefreshCw, UserSquare2 } from "lucide-react";
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
  scenes_status?: "idle" | "generating" | "ready" | "failed";
  scenes?: { id: string; concept: string; status: string; reused: boolean }[];
  face_status?: "idle" | "processing" | "ready" | "failed";
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
  onScenes,
  onFace,
  onReset,
}: {
  project: StudioProjectDetail;
  busy: boolean;
  /** Dispara a montagem com a trilha escolhida (null = sem música). */
  onMontage: (musicKey: string | null) => void;
  /** Gera (ou re-tenta) as cenas do roteiro falado. */
  onScenes: () => void;
  /** Gera a presença (rosto) com a foto escolhida. */
  onFace: (file: File) => void;
  onReset: () => void;
}) {
  const faceInput = useRef<HTMLInputElement>(null);
  const transcript = project.transcript_words?.map((w) => w.word.trim()).join(" ") ?? "";
  const [tracks, setTracks] = useState<{ key: string; label: string }[]>([]);
  const [musicKey, setMusicKey] = useState<string>("");

  // Banco de trilhas (R2 studio-music/) — o usuário escolhe, ou "Sem música".
  useEffect(() => {
    if (project.status !== "audio_ready") return;
    fetch("/api/v1/studio/music", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setTracks(j?.tracks ?? []))
      .catch(() => {});
  }, [project.status]);

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

          {/* ───── F3: cenas do roteiro (banco pessoal) ───── */}
          <div className="mt-1 flex flex-col gap-3 border-t border-dashed border-[var(--hairline-strong)] pt-4">
            <span className={LABEL}>Cenas do roteiro (b-roll gerado por IA)</span>

            {(!project.scenes_status || project.scenes_status === "idle") && (
              <button type="button" onClick={onScenes} disabled={busy} className={`${GHOST} w-fit`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                Gerar cenas do roteiro
              </button>
            )}

            {project.scenes_status === "generating" && (
              <span className="flex items-center gap-2 text-sm text-[var(--ink)]">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />
                Gerando cenas — {(project.scenes ?? []).filter((s) => s.status === "ready").length}/
                {(project.scenes ?? []).length} prontas… (~1-3 min por cena)
              </span>
            )}

            {project.scenes_status === "ready" && (
              <span className="font-mono text-[11px] tracking-wide text-[var(--silver)]">
                ✓ {(project.scenes ?? []).length} cenas prontas
                {(project.scenes ?? []).some((s) => s.reused)
                  ? ` (${(project.scenes ?? []).filter((s) => s.reused).length} do seu banco, de graça)`
                  : ""} — a montagem vai usar as SUAS cenas.
              </span>
            )}

            {project.scenes_status === "failed" && (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[11px] tracking-wide text-[var(--status-error)]">
                  {(project.scenes ?? []).filter((s) => s.status === "failed").length} cena(s) falharam na geração.
                </p>
                <button type="button" onClick={onScenes} disabled={busy} className={`${GHOST} w-fit`}>
                  <RefreshCw className="h-4 w-4" /> Tentar as cenas que falharam
                </button>
              </div>
            )}

            {(project.scenes ?? []).length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {(project.scenes ?? []).map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-card)] px-3 py-1 font-mono text-[10px] tracking-wide text-[var(--mute)]"
                  >
                    {s.status === "ready" ? "✓" : s.status === "failed" ? "✕" : <Loader2 className="h-3 w-3 animate-spin" />}
                    {s.concept}
                    {s.reused && <span className="text-[var(--ash)]">· banco</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ───── F4: presença (rosto lip-sync) no hook e no fechamento ───── */}
          <div className="mt-1 flex flex-col gap-3 border-t border-dashed border-[var(--hairline-strong)] pt-4">
            <span className={LABEL}>Sua presença no vídeo (rosto na abertura e no fechamento)</span>
            <input
              ref={faceInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFace(e.target.files[0])}
            />
            {(!project.face_status || project.face_status === "idle" || project.face_status === "failed") && (
              <div className="flex flex-col gap-2">
                {project.face_status === "failed" && (
                  <p className="font-mono text-[11px] tracking-wide text-[var(--status-error)]">
                    A geração do rosto falhou. Tente novamente.
                  </p>
                )}
                <button type="button" onClick={() => faceInput.current?.click()} disabled={busy} className={`${GHOST} w-fit`}>
                  <UserSquare2 className="h-4 w-4" /> Escolher minha foto e gerar
                </button>
                <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
                  Opcional — sem foto, o vídeo sai só com as cenas.
                </span>
              </div>
            )}
            {project.face_status === "processing" && (
              <span className="flex items-center gap-2 text-sm text-[var(--ink)]">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />
                Gerando você falando (abertura e fechamento)… leva alguns minutos.
              </span>
            )}
            {project.face_status === "ready" && (
              <span className="font-mono text-[11px] tracking-wide text-[var(--silver)]">
                ✓ Presença pronta — você abre e fecha o vídeo falando.
              </span>
            )}
          </div>

          {/* ───── F1/F2: vídeo montado + legenda + música ───── */}
          <div className="mt-1 flex flex-col gap-3 border-t border-dashed border-[var(--hairline-strong)] pt-4">
            <span className={LABEL}>
              {project.scenes_status === "ready"
                ? "Montar o vídeo — com as suas cenas + legenda + música"
                : "Vídeo de teste — montagem + legenda + música (cenas fixas)"}
            </span>

            {(!project.montage_status || project.montage_status === "idle") && (
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={musicKey}
                  onChange={(e) => setMusicKey(e.target.value)}
                  aria-label="Trilha sonora"
                  className="h-11 w-full max-w-xs rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 font-sans text-sm text-[var(--ink)] focus:border-[var(--hairline-bright)] focus:outline-none"
                >
                  <option value="">Sem música</option>
                  {tracks.map((t) => (
                    <option key={t.key} value={t.key}>
                      🎵 {t.label}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => onMontage(musicKey || null)} disabled={busy} className={PILL}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
                  Montar vídeo de teste
                </button>
              </div>
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
                  <select
                    value={musicKey}
                    onChange={(e) => setMusicKey(e.target.value)}
                    aria-label="Trilha sonora"
                    className="h-11 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 font-sans text-sm text-[var(--ink)] focus:border-[var(--hairline-bright)] focus:outline-none"
                  >
                    <option value="">Sem música</option>
                    {tracks.map((t) => (
                      <option key={t.key} value={t.key}>
                        🎵 {t.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => onMontage(musicKey || null)} disabled={busy} className={GHOST}>
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
                <button type="button" onClick={() => onMontage(musicKey || null)} disabled={busy} className={`${GHOST} w-fit`}>
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
