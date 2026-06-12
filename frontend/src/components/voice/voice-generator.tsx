"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Play, Download } from "lucide-react";
import { formatDuration } from "@/lib/audio/duration";
import { SupportError } from "@/components/ui/support-error";
import { PaywallModal } from "@/components/app/paywall-modal";

// Limite generoso pra cobrir ~2 min de fala em pt-BR (~150 wpm, ~5 chars/word).
// Bate com o TEXT_MAX da rota /api/v1/voices/[id]/generate.
const TEXT_MAX = 2000;

type Props = { voiceId: string };
type Step = "form" | "submitting" | "polling" | "done" | "error";

const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none";
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] disabled:opacity-[0.42] disabled:pointer-events-none";

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
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [paywallDetail, setPaywallDetail] = useState<string | null>(null);
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
    setNoCredits(false);

    try {
      // A referência (se houver) é lida da voz no backend — nada de upload aqui.
      const genRes = await fetch(`/api/v1/voices/${voiceId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (genRes.status === 402) {
        const j = await genRes.json().catch(() => ({}));
        setSubscribed(Boolean(j?.error?.details?.subscribed));
        setPaywallDetail(j?.error?.message ?? null);
        setNoCredits(true);
        setStep("form");
        return;
      }
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
      a.download = `fastpost-voz-${Date.now()}.mp3`;
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
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-6">
          <div className="flex items-center gap-3">
            <Play className="h-5 w-5 text-[var(--silver)]" />
            <h2 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
              Áudio gerado
            </h2>
          </div>
          <audio
            src={generation.audio_url}
            controls
            className="w-full"
            preload="metadata"
          />
          <div className="flex gap-4 font-mono text-[10px] tracking-wide text-[var(--ash)]">
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
            className={`${PILL} w-fit`}
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
          className={`${SECONDARY} w-fit`}
        >
          Gerar outro
        </button>
      </div>
    );
  }

  if (step === "polling" || step === "submitting") {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <div className="h-12 w-12 animate-spin rounded-[var(--radius-full)] border-2 border-[var(--hairline-strong)] border-t-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--silver)]">
          Gerando áudio…
        </p>
        <p className="text-xs text-[var(--mute)]">Polling 3s · primeira inferência leva ~10s no cold start</p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Texto */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="gen-text" className="font-mono text-[11px] tracking-wide text-[var(--mute)]">
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
          className="resize-none rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
        />
        <span className="self-end font-mono text-[10px] tabular-nums text-[var(--ash)]">
          {text.length} / {TEXT_MAX}
        </span>
      </div>

      {error && <SupportError action="gerar o áudio" />}

      <PaywallModal
        open={noCredits}
        onClose={() => setNoCredits(false)}
        subscribed={subscribed}
        action="gerar áudio"
        detail={paywallDetail}
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className={`${PILL} w-fit`}
      >
        <AudioLines className="h-4 w-4" />
        Gerar áudio
      </button>
    </form>
  );
}
