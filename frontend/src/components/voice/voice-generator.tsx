"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Play, Download, Mic2 } from "lucide-react";
import { formatDuration } from "@/lib/audio/duration";
import { SupportError } from "@/components/ui/support-error";

const TEXT_MAX = 1000;

type Props = { voiceId: string; hasReference: boolean };
type Step = "form" | "submitting" | "polling" | "done" | "error";

type GenerationDto = {
  id: string;
  status: "pending" | "generating" | "ready" | "failed";
  audio_url: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  elapsed_seconds: number | null;
};

export function VoiceGenerator({ voiceId, hasReference }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState<GenerationDto | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // A referência é PERSISTENTE por voz: o usuário sobe/troca/apaga na página da
  // voz. Aqui a geração só a reusa automaticamente (quando existe). Sem ela,
  // gera só com a LoRA. A transcrição é feita pelo worker.
  const canSubmit = text.trim().length > 0;

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

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
      // A referência (se houver) é lida da voz no backend — nada de upload aqui.
      const genRes = await fetch(`/api/v1/voices/${voiceId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
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

  async function downloadAudio(url: string) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `aiverse-voz-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank"); // fallback: abre em nova aba
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
          <button
            type="button"
            onClick={() => generation.audio_url && downloadAudio(generation.audio_url)}
            className="flex items-center justify-center gap-2 bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-fg hover:text-bg active:scale-[0.99] w-fit"
          >
            <Download className="h-4 w-4" />
            Baixar áudio
          </button>
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
          Gerando áudio…
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

      {/* Status da referência (gerenciada na página da voz) */}
      <div
        className={`flex items-start gap-3 border p-3 ${
          hasReference ? "border-accent/40 bg-accent/5" : "border-border bg-surface"
        }`}
      >
        <Mic2 className={`mt-0.5 h-4 w-4 ${hasReference ? "text-accent" : "text-muted-fg"}`} />
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg leading-relaxed">
          {hasReference ? (
            <>
              Usando seu <span className="text-accent">áudio de referência salvo</span>. Pra
              trocar ou remover, use a página da voz.
            </>
          ) : (
            <>
              Sem referência — gera só com a LoRA. Adicione um áudio de referência na
              página da voz pra melhorar a fidelidade.
            </>
          )}
        </p>
      </div>

      {error && <SupportError action="gerar o áudio" />}

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
