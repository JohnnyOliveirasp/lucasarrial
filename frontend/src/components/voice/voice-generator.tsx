"use client";

/**
 * Gerar Áudio — padrão "estúdio" (estilo ElevenLabs): o formulário fica SEMPRE
 * visível e cada geração vira um "take" numa lista logo abaixo, na MESMA tela
 * (player + duração + baixar). O texto não some — regenerar é clicar de novo.
 * O Histórico continua existindo como acervo; aqui é a sessão de trabalho.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AudioLines, Download, Loader2, AlertTriangle } from "lucide-react";
import { formatDuration } from "@/lib/audio/duration";
import { SupportError } from "@/components/ui/support-error";
import { PaywallModal } from "@/components/app/paywall-modal";

// Limite generoso pra cobrir ~2 min de fala em pt-BR (~150 wpm, ~5 chars/word).
// Bate com o TEXT_MAX da rota /api/v1/voices/[id]/generate.
const TEXT_MAX = 2000;

type Props = { voiceId: string };

const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none";

type Take = {
  id: string;
  status: "pending" | "generating" | "ready" | "failed";
  text: string;
  audio_url: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  elapsed_seconds: number | null;
  startedAt: number;
};

const ANIM_CSS = `
@keyframes vg-shimmer { 0% { transform: translateX(-120%) skewX(-12deg); } 100% { transform: translateX(220%) skewX(-12deg); } }
.vg-shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent); animation: vg-shimmer 1.8s ease-in-out infinite; }
@keyframes vg-dots { 0%,20%{content:'';} 40%{content:'.';} 60%{content:'..';} 80%,100%{content:'...';} }
.vg-dots::after { content:''; animation: vg-dots 1.6s steps(1) infinite; }
`;

export function VoiceGenerator({ voiceId }: Props) {
  const t = useTranslations("voice");
  const router = useRouter();
  const [text, setText] = useState("");
  // Pausa entre frases (vai como chunk_silence_ms; backend já aceita).
  const [pauseMs, setPauseMs] = useState<number | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [paywallDetail, setPaywallDetail] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inflight = takes.some((t) => t.status === "pending" || t.status === "generating");
  const canSubmit = text.trim().length > 0 && !submitting && !inflight;

  // Poll dos takes em andamento — atualiza a lista in place.
  useEffect(() => {
    if (!inflight) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const pending = takes.filter((t) => t.status === "pending" || t.status === "generating");
      for (const t of pending) {
        try {
          const r = await fetch(`/api/v1/generations/${t.id}`, { cache: "no-store" });
          if (!r.ok) continue;
          const json = await r.json();
          const gen = json.generation as Omit<Take, "text" | "startedAt">;
          setTakes((prev) =>
            prev.map((p) => (p.id === t.id ? { ...p, ...gen } : p)),
          );
          if (gen.status === "ready" || gen.status === "failed") router.refresh();
        } catch {
          /* próximo tick */
        }
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [inflight, takes, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setNoCredits(false);

    try {
      // A referência (se houver) é lida da voz no backend — nada de upload aqui.
      const genRes = await fetch(`/api/v1/voices/${voiceId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          ...(pauseMs !== null ? { chunk_silence_ms: pauseMs } : {}),
        }),
      });
      if (genRes.status === 402) {
        const j = await genRes.json().catch(() => ({}));
        setSubscribed(Boolean(j?.error?.details?.subscribed));
        setPaywallDetail(j?.error?.message ?? null);
        setNoCredits(true);
        return;
      }
      if (!genRes.ok) {
        const j = await genRes.json().catch(() => ({}));
        throw new Error(j?.error?.message || t("generator.startError"));
      }
      const { generation_id } = await genRes.json();
      setTakes((prev) => [
        {
          id: generation_id,
          status: "pending",
          text: text.trim(),
          audio_url: null,
          error_message: null,
          duration_seconds: null,
          elapsed_seconds: null,
          startedAt: Date.now(),
        },
        ...prev,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSubmitting(false);
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

  return (
    <div className="flex flex-col gap-6">
      <style>{ANIM_CSS}</style>

      {/* Formulário — nunca some */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gen-text" className="font-mono text-[11px] tracking-wide text-[var(--mute)]">
            {t("generator.textLabel")}
          </label>
          <textarea
            id="gen-text"
            required
            maxLength={TEXT_MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={t("generator.placeholder")}
            className="resize-none rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
          />
          <span className="self-end font-mono text-[10px] tabular-nums text-[var(--ash)]">
            {text.length} / {TEXT_MAX}
          </span>
        </div>

        {/* Ritmo da fala — controle simples por cima do chunk_silence_ms */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">
            {t("generator.pauseLabel")}
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { v: null, label: t("generator.pauseNatural") },
              { v: 250, label: t("generator.pauseMedium") },
              { v: 550, label: t("generator.pauseLong") },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setPauseMs(opt.v)}
                aria-pressed={pauseMs === opt.v}
                className={`rounded-[var(--radius)] border px-3 py-1.5 font-mono text-[11px] tracking-wide transition-colors ${
                  pauseMs === opt.v
                    ? "border-[var(--hairline-bright)] text-[var(--ink)]"
                    : "border-[var(--hairline)] text-[var(--ash)] hover:text-[var(--ink)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && <SupportError action={t("generator.supportAction")} />}

        <button type="submit" disabled={!canSubmit} className={`${PILL} w-fit`}>
          {submitting || inflight ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <AudioLines className="h-4 w-4" />
          )}
          {inflight ? t("generator.generating") : t("generator.generate")}
        </button>
      </form>

      {/* Takes da sessão — mesma janela, mais novo em cima */}
      {takes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]">
            {t("generator.sessionTitle")}
          </h2>
          <ul className="flex flex-col gap-2">
            {takes.map((take) => (
              <li
                key={take.id}
                className="relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-3"
              >
                {(take.status === "pending" || take.status === "generating") && (
                  <>
                    <span className="vg-shimmer pointer-events-none absolute inset-0" aria-hidden />
                    <span className="flex items-center gap-2 text-sm text-[var(--body)]">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--silver)]" />
                      {t("generator.generatingWord")}<span className="vg-dots" />
                    </span>
                  </>
                )}
                {take.status === "failed" && (
                  <span className="flex items-center gap-2 font-mono text-[11px] text-[var(--status-error)]">
                    <AlertTriangle className="h-4 w-4" />
                    {take.error_message || t("generator.failed")}
                  </span>
                )}
                {take.status === "ready" && take.audio_url && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <audio src={take.audio_url} controls preload="metadata" className="w-full sm:flex-1" />
                    <button
                      type="button"
                      onClick={() => downloadAudio(take.audio_url!)}
                      aria-label={t("generator.downloadAria")}
                      className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-3 text-[13px] text-[var(--ink)] hover:border-[var(--hairline-bright)]"
                    >
                      <Download className="h-4 w-4" /> {t("generator.download")}
                    </button>
                  </div>
                )}
                <p className="line-clamp-2 text-[12px] leading-snug text-[var(--mute)]">“{take.text}”</p>
                <div className="flex gap-3 font-mono text-[10px] tracking-wide text-[var(--ash)]">
                  <span>{new Date(take.startedAt).toLocaleTimeString("pt-BR")}</span>
                  {take.duration_seconds ? <span>· {formatDuration(take.duration_seconds)}</span> : null}
                  {take.elapsed_seconds ? (
                    <span>{t("generator.generatedIn", { s: take.elapsed_seconds.toFixed(1) })}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <p className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
            {t("generator.savedNote")}
          </p>
        </section>
      )}

      <PaywallModal
        open={noCredits}
        onClose={() => setNoCredits(false)}
        subscribed={subscribed}
        action={t("generator.paywallAction")}
        detail={paywallDetail}
      />
    </div>
  );
}
