"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, AudioLines, Play } from "lucide-react";
import { measureAudioDuration, formatDuration } from "@/lib/audio/duration";

const REF_MIN_SECONDS = 60;
const TEXT_MAX = 1000;

type Props = { voiceId: string };
type Step = "form" | "submitting" | "polling" | "done" | "error";

type GenerationDto = {
  id: string;
  status: "pending" | "generating" | "ready" | "failed";
  audio_url: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  elapsed_seconds: number | null;
};

export function VoiceGenerator({ voiceId }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [text, setText] = useState("");
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refDuration, setRefDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState<GenerationDto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Referência é OPCIONAL: sem ela, gera só com a LoRA. Se enviada, melhora a
  // fidelidade (prosódia/sotaque) e precisa ter >= 60s. A transcrição é feita
  // automaticamente pelo worker (Whisper) — usuário não digita nada.
  const validText = text.trim().length > 0;
  const validRefDuration = (refDuration ?? 0) >= REF_MIN_SECONDS;
  const refOk = !refFile || validRefDuration;
  const canSubmit = validText && refOk;

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  async function pickFile(file: File) {
    setRefFile(file);
    setRefDuration(null);
    const dur = await measureAudioDuration(file);
    setRefDuration(dur);
  }

  function pollGeneration(generationId: string) {
    setStep("polling");
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/v1/generations/${generationId}`, { cache: "no-store" });
        if (!r.ok) return;
        const json = await r.json();
        const gen = json.generation as GenerationDto;
        setGeneration(gen);
        if (gen.status === "ready" || gen.status === "failed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setStep(gen.status === "ready" ? "done" : "error");
          if (gen.status === "failed") setError(gen.error_message || "Geração falhou");
          router.refresh();
        }
      } catch {
        /* ignore */
      }
    }, 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStep("submitting");
    setError(null);

    try {
      // 1+2. Se houver referência, sobe pro R2 (presigned). Sem ela, gera só com a LoRA.
      let referenceAudioKey: string | undefined;
      if (refFile) {
        const prepRes = await fetch(`/api/v1/voices/${voiceId}/generate/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: refFile.name,
            content_type: refFile.type || "audio/mpeg",
          }),
        });
        if (!prepRes.ok) {
          const j = await prepRes.json().catch(() => ({}));
          throw new Error(j?.error?.message || "Falha ao preparar upload");
        }
        const { reference_audio_key, upload_url } = await prepRes.json();

        const putRes = await fetch(upload_url, {
          method: "PUT",
          headers: { "Content-Type": refFile.type || "audio/mpeg" },
          body: refFile,
        });
        if (!putRes.ok) throw new Error(`Upload R2 falhou (${putRes.status})`);
        referenceAudioKey = reference_audio_key;
      }

      // 3. Dispara geração (transcrição da ref é automática no worker via Whisper)
      const genRes = await fetch(`/api/v1/voices/${voiceId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          ...(referenceAudioKey ? { reference_audio_key: referenceAudioKey } : {}),
        }),
      });
      if (!genRes.ok) {
        const j = await genRes.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Falha ao iniciar geração");
      }
      const { generation_id } = await genRes.json();
      pollGeneration(generation_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setStep("error");
    }
  }

  if (step === "done" && generation?.audio_url) {
    return (
      <div className="flex flex-col gap-6">
        <section className="border border-accent bg-accent/5 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Play className="h-5 w-5 text-accent" />
            <h2 className="font-display text-2xl uppercase tracking-tight text-fg">
              Áudio gerado
            </h2>
          </div>
          <audio
            src={generation.audio_url}
            controls
            className="w-full"
            preload="metadata"
          />
          <div className="flex gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
            {generation.duration_seconds && (
              <span>Duração: {formatDuration(generation.duration_seconds)}</span>
            )}
            {generation.elapsed_seconds && (
              <span>Gerou em: {generation.elapsed_seconds.toFixed(1)}s</span>
            )}
          </div>
        </section>
        <button
          type="button"
          onClick={() => {
            setStep("form");
            setText("");
            setGeneration(null);
          }}
          className="bg-fg px-6 py-3 text-sm font-bold uppercase tracking-wide text-bg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-accent hover:text-accent-fg active:scale-[0.99] w-fit"
        >
          Gerar outro
        </button>
      </div>
    );
  }

  if (step === "polling" || step === "submitting") {
    return (
      <section className="border border-dashed border-border bg-surface p-12 text-center flex flex-col items-center gap-4">
        <div className="h-12 w-12 border-4 border-accent border-t-transparent animate-spin" />
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {step === "submitting" ? "Subindo referência…" : "Gerando áudio…"}
        </p>
        <p className="text-xs text-muted-fg">Polling 3s · primeira inferência leva ~10s no cold start</p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Texto */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gen-text" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
          Texto a sintetizar
        </label>
        <textarea
          id="gen-text"
          required
          maxLength={TEXT_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Olá, este é um teste da minha voz clonada…"
          className="border border-border bg-bg px-3 py-3 text-sm text-fg placeholder:text-muted-fg/60 focus:border-accent focus:outline-none resize-none"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg self-end">
          {text.length} / {TEXT_MAX}
        </span>
      </div>

      {/* Referência */}
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
          Áudio de referência (opcional)
        </label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-3 border-2 border-dashed border-border bg-surface px-4 py-6 text-left hover:border-accent transition-colors"
        >
          <Upload className="h-5 w-5 text-muted-fg" />
          {refFile ? (
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-sm text-fg truncate">{refFile.name}</span>
              <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${validRefDuration ? "text-accent" : "text-muted-fg"}`}>
                {refDuration == null
                  ? "Medindo…"
                  : validRefDuration
                  ? `${formatDuration(refDuration)} ✓`
                  : `${formatDuration(refDuration)} — mínimo 1:00`}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-fg">Clique pra escolher áudio (≥60s)</span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
            e.target.value = "";
          }}
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg">
          Sem referência, gera só com a LoRA. Com referência (≥60s), melhora a
          fidelidade — a transcrição é feita automaticamente.
        </p>
      </div>

      {error && (
        <p role="alert" className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-fg hover:text-bg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="flex items-center justify-center gap-2">
          <AudioLines className="h-4 w-4" />
          Gerar áudio
        </div>
      </button>
    </form>
  );
}
