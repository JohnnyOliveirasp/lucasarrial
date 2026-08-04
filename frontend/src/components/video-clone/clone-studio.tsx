"use client";

/**
 * Estúdio do Vídeo Clone: foto (histórico do Gerador de Imagem OU upload) +
 * áudio (TTS gerado OU upload) → qualidade (Padrão/Turbo, preço por segundo) →
 * custo SEMPRE visível → Gerar → poll até ficar pronto.
 * Quem não tem foto/áudio cria nas telas próprias (links nos seletores).
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Clock, Download, Film, Info, Loader2, RefreshCw } from "lucide-react";
import {
  CLONE_MAX_AUDIO_SECONDS,
  CLONE_TIERS,
  CloneTierId,
  cloneCreditsCost,
  getCloneTier,
} from "@/lib/video-clone/config";
import { PaywallModal } from "@/components/app/paywall-modal";
import { downloadFromUrl } from "@/components/image/download-file";
import { AudioChoice, AudioPicker, ImageChoice, ImagePicker } from "./clone-pickers";
import { CLONE_ANIM_CSS } from "./clone-anim";
import { ensureUploadableImage, IMAGE_ACCEPT_WITH_HEIC } from "@/lib/images/heic";

const PILL =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-6 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50";
const LABEL = "font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]";

async function presignAndPut(kind: "image" | "audio", file: File): Promise<string> {
  const res = await fetch("/api/v1/video-clone/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, filename: file.name, content_type: file.type, size: file.size }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message || "");
  const put = await fetch(j.upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error("");
  return j.key as string;
}

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(a.duration) ? a.duration : 0);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    a.src = url;
  });
}

export function CloneStudio({
  creditsTotal,
  unlimited,
  onChanged,
}: {
  creditsTotal: number;
  unlimited: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("videoClone.studio");
  const [image, setImage] = useState<ImageChoice | null>(null);
  const [audio, setAudio] = useState<AudioChoice | null>(null);
  const [uploading, setUploading] = useState<"image" | "audio" | null>(null);
  const [tierId, setTierId] = useState<CloneTierId>("480p");
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<{ id: string; status: string; video_url: string | null; error: string | null } | null>(null);
  // Foto que vira o "palco" da geração (borrada enquanto gera; poster do vídeo pronto).
  const [poster, setPoster] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ subscribed: boolean } | null>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const audInput = useRef<HTMLInputElement>(null);

  const tier = getCloneTier(tierId)!;
  const cost = audio ? cloneCreditsCost(tier, audio.seconds) : 0;
  const canAfford = unlimited || creditsTotal >= cost;
  const inflight = job?.status === "pending" || job?.status === "generating";

  async function pickImageFile(file: File) {
    setError(null);
    setUploading("image");
    try {
      file = await ensureUploadableImage(file); // iPhone .heic -> jpeg
      const key = await presignAndPut("image", file);
      setImage({ kind: "upload", key, preview: URL.createObjectURL(file) });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("errors.upload"));
    } finally {
      setUploading(null);
    }
  }

  async function pickAudioFile(file: File) {
    setError(null);
    const seconds = await readAudioDuration(file);
    if (seconds <= 0) {
      setError(t("errors.readAudio"));
      return;
    }
    if (seconds > CLONE_MAX_AUDIO_SECONDS) {
      setError(t("errors.tooLong", { n: Math.round(seconds), max: CLONE_MAX_AUDIO_SECONDS }));
      return;
    }
    setUploading("audio");
    try {
      const key = await presignAndPut("audio", file);
      setAudio({ kind: "upload", key, seconds, preview: URL.createObjectURL(file), label: file.name, text: null });
      // Transcreve em background pra pessoa VER o que o áudio fala (a duração
      // do Whisper também é mais confiável que a do browser).
      fetch("/api/v1/video-clone/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_key: key }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j) return;
          setAudio((prev) =>
            prev && prev.kind === "upload" && prev.key === key
              ? {
                  ...prev,
                  text: (j.text as string)?.trim() || t("noSpeech"),
                  seconds: typeof j.duration_seconds === "number" && j.duration_seconds > 0 ? j.duration_seconds : prev.seconds,
                }
              : prev,
          );
        })
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("errors.upload"));
    } finally {
      setUploading(null);
    }
  }

  async function generate() {
    if (!image || !audio) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, string> = { tier: tierId };
      if (image.kind === "history") payload.image_generation_id = image.id;
      else payload.image_key = image.key;
      if (audio.kind === "history") payload.generation_id = audio.id;
      else payload.audio_key = audio.key;

      const res = await fetch("/api/v1/video-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setPaywall({ subscribed: !!j?.error?.details?.subscribed });
        return;
      }
      if (!res.ok) throw new Error(j?.error?.message || t("errors.start"));
      setPoster(image.preview);
      setJob({ id: j.clone.id, status: "pending", video_url: null, error: null });
      onChanged();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  // Retoma o job em andamento ao abrir a tela (ex.: a pessoa recarregou a
  // página no meio) — sem isso o formulário voltava sem nenhuma animação.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/video-clone", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        const running = ((j.clones ?? []) as { id: string; status: string; image_url: string | null }[]).find(
          (c) => c.status === "pending" || c.status === "generating",
        );
        if (running && !cancelled) {
          setPoster(running.image_url);
          setJob((prev) => prev ?? { id: running.id, status: running.status, video_url: null, error: null });
        }
      } catch {
        /* segue no formulário */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll do job em andamento (o GET sincroniza com o RunPod).
  useEffect(() => {
    if (!job || !inflight) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/video-clone/${job.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        const c = j.clone ?? {};
        setJob({ id: job.id, status: c.status, video_url: c.video_url ?? null, error: c.error_message ?? null });
        if (c.status === "ready" || c.status === "failed") onChanged();
      } catch {
        /* próximo tick */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [job, inflight, onChanged]);

  function reset() {
    setJob(null);
    setPoster(null);
    setImage(null);
    setAudio(null);
    setError(null);
  }

  // ───── resultado / progresso ─────
  if (job) {
    return (
      <section className="flex flex-col gap-5">
        <style>{CLONE_ANIM_CSS}</style>
        {inflight && (
          /* Estilo HeyGen: a PRÓPRIA foto vira o palco — borrada, com anel
             animado e recado de que dá pra ir fazer outra coisa. */
          <div className="relative w-full max-w-[420px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)]">
            {(poster ?? image?.preview) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(poster ?? image?.preview)!}
                alt=""
                className="w-full scale-105 object-cover opacity-60 blur-md"
              />
            ) : (
              <div className="aspect-[3/4] w-full" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[var(--canvas)]/45 p-6 text-center">
              <span className="vc-shimmer absolute inset-0" aria-hidden />
              <span className="vc-ring relative" aria-hidden />
              <span className="relative text-[15px] font-semibold tracking-[-0.01em] text-white">
                {t("generatingTitle")}<span className="vc-dots" />
              </span>
              <span className="relative flex max-w-[300px] items-start justify-center gap-1.5 font-mono text-[11px] leading-relaxed tracking-wide text-white/80">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t("generatingHint")}
              </span>
            </div>
          </div>
        )}
        {job.status === "ready" && job.video_url && (
          /* Vídeo pronto toca NO MESMO quadro onde estava a foto (poster = ela). */
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <video
              src={job.video_url}
              poster={poster ?? image?.preview ?? undefined}
              controls
              loop
              playsInline
              preload="metadata"
              className="w-full max-w-[420px] rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-black"
            />
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => downloadFromUrl(job.video_url!, "video-clone", "mp4")} className={PILL}>
                <Download className="h-4 w-4" /> {t("download")}
              </button>
              <button type="button" onClick={reset} className={PILL}>
                <RefreshCw className="h-4 w-4" /> {t("again")}
              </button>
            </div>
          </div>
        )}
        {job.status === "failed" && (
          <div className="flex flex-col gap-3">
            <p className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
              {job.error || t("errors.failed")}
            </p>
            <button type="button" onClick={reset} className={`${PILL} w-fit`}>
              <RefreshCw className="h-4 w-4" /> {t("retry")}
            </button>
          </div>
        )}
      </section>
    );
  }

  // ───── formulário ─────
  return (
    <section className="flex flex-col gap-6">
      <input
        ref={imgInput}
        type="file"
        accept={IMAGE_ACCEPT_WITH_HEIC}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && pickImageFile(e.target.files[0])}
      />
      <input
        ref={audInput}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && pickAudioFile(e.target.files[0])}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className={LABEL}>{t("stepImage")}</span>
          <ImagePicker
            selected={image}
            onSelect={setImage}
            onUploadClick={() => imgInput.current?.click()}
            uploading={uploading === "image"}
          />
        </div>

        <div className="flex flex-col gap-3">
          <span className={LABEL}>{t("stepAudio", { max: CLONE_MAX_AUDIO_SECONDS })}</span>
          <AudioPicker
            selected={audio}
            onSelect={setAudio}
            onUploadClick={() => audInput.current?.click()}
            uploading={uploading === "audio"}
            maxSeconds={CLONE_MAX_AUDIO_SECONDS}
          />
        </div>
      </div>

      {/* Qualidade */}
      <div className="flex flex-col gap-2">
        <span className={LABEL}>{t("stepQuality")}</span>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CLONE_TIERS.map((opt) => {
            const active = tierId === opt.id;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => setTierId(opt.id)}
                  aria-pressed={active}
                  className={[
                    "flex w-full flex-col gap-1.5 rounded-[var(--radius)] border p-3 text-left transition-[border-color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-out)]",
                    active
                      ? "border-[var(--hairline-bright)] bg-[var(--surface-card)] shadow-[0_0_0_1px_var(--hairline-bright)]"
                      : "border-[var(--hairline-strong)] bg-[var(--surface-card)] hover:border-[var(--hairline-bright)]",
                  ].join(" ")}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-sans text-[14px] font-semibold text-[var(--ink)]">
                      {opt.label}{" "}
                      <span className="font-mono text-[10px] font-normal text-[var(--ash)]">
                        480p
                      </span>
                    </span>
                    {active && <Check className="h-4 w-4 text-[var(--silver)]" />}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--silver)]">
                    {t("perSecond", { n: opt.creditsPerSecond })}
                  </span>
                  <span className="text-[12px] leading-snug text-[var(--mute)]">{opt.blurb}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="flex items-start gap-2 text-[12px] leading-snug text-[var(--mute)]">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--ash)]" />
          <span>{t("tierNote")}</span>
        </p>
      </div>

      {error && (
        <p role="alert" className="font-mono text-[11px] tracking-wide text-[var(--status-error)]">
          {error}
        </p>
      )}

      {/* Custo + gerar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4">
        <span className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
          {audio
            ? `${t("cost", { seconds: Math.max(5, Math.ceil(audio.seconds)), rate: tier.creditsPerSecond, cost: cost.toLocaleString("pt-BR") })}${!canAfford ? ` ${t("costBalance", { have: creditsTotal.toLocaleString("pt-BR") })}` : ""}`
            : t("pickToSeeCost")}
        </span>
        <button type="button" disabled={!image || !audio || submitting || !!uploading} onClick={generate} className={PILL}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
          {submitting ? t("sending") : audio ? t("generateWithCost", { cost: cost.toLocaleString("pt-BR") }) : t("generate")}
        </button>
      </div>

      <PaywallModal
        open={!!paywall}
        onClose={() => setPaywall(null)}
        subscribed={paywall?.subscribed ?? false}
        action={t("paywallAction")}
      />
    </section>
  );
}
