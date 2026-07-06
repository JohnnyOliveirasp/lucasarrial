"use client";

/**
 * Upload da PRÓPRIA voz pro wizard de vídeo (alternativa ao áudio gerado).
 * A duração é lida no navegador ANTES de enviar (metadados) — >90s nem sobe.
 * Depois: presigned PUT no R2 → POST /api/v1/videos { uploaded_key } (o server
 * transcreve com Whisper, revalida a duração real e cria o projeto).
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import { MAX_AUDIO_SECONDS } from "@/lib/video/config";

type Phase = "idle" | "reading" | "uploading" | "creating";

/** Duração via metadados, sem enviar nada. Rejeita se o browser não decodificar. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = new Audio();
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(el.duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não conseguimos ler esse arquivo de áudio."));
    };
    el.src = url;
  });
}

function fmt(secs: number): string {
  const s = Math.round(secs);
  return `${Math.floor(s / 60)}min${String(s % 60).padStart(2, "0")}s`;
}

export function AudioUpload({ locale }: { locale: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== "idle";

  async function handleFile(file: File) {
    setError(null);

    if (file.size > 25 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. 25MB).");
      return;
    }

    try {
      // 1) Trava de duração NO NAVEGADOR — nada sobe se passar de 1min30s.
      setPhase("reading");
      const duration = await readDuration(file);
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Não conseguimos ler a duração desse áudio.");
      }
      if (duration > MAX_AUDIO_SECONDS) {
        throw new Error(
          `Seu áudio tem ${fmt(duration)} — o máximo é ${fmt(MAX_AUDIO_SECONDS)}. Corte o áudio e tente de novo.`,
        );
      }

      // 2) Presigned PUT → upload direto pro R2.
      setPhase("uploading");
      const slotRes = await fetch("/api/v1/videos/upload-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type || "audio/mpeg",
          size: file.size,
        }),
      });
      const slot = await slotRes.json().catch(() => ({}));
      if (!slotRes.ok) throw new Error(slot?.error?.message || "Falha ao preparar o upload.");

      const putRes = await fetch(slot.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "audio/mpeg" },
        body: file,
      });
      if (!putRes.ok) throw new Error("Falha ao enviar o áudio. Tente novamente.");

      // 3) Cria o projeto (server transcreve + revalida duração real).
      setPhase("creating");
      const res = await fetch("/api/v1/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploaded_key: slot.key }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao criar o vídeo.");

      router.push(`/${locale}/app/videos/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao processar o áudio.");
      setPhase("idle");
    }
  }

  const PHASE_LABEL: Record<Exclude<Phase, "idle">, string> = {
    reading: "Lendo o áudio…",
    uploading: "Enviando…",
    creating: "Transcrevendo e criando o projeto…",
  };

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-base font-semibold text-[var(--ink)]">Ou envie a sua própria voz</span>
          <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
            MP3, WAV, M4A, OGG ou FLAC · máx. {fmt(MAX_AUDIO_SECONDS)} · o roteiro das cenas vem do que é falado
          </span>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex h-10 w-fit shrink-0 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? PHASE_LABEL[phase as Exclude<Phase, "idle">] : "Enviar áudio"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="inline-flex items-start gap-2 rounded-[var(--radius)] border border-[var(--status-error)]/40 px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // permite re-selecionar o mesmo arquivo
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
