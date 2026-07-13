"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ImagePlus, Sparkles, Wand2, Download, Film, X, Loader2, ShieldAlert } from "lucide-react";
import { SupportError } from "@/components/ui/support-error";
import { PaywallModal } from "@/components/app/paywall-modal";
import { AudioGeneratingIndicator } from "@/components/voice/audio-generating-indicator";
import { FieldHint } from "@/components/image/field-hint";
import {
  ASPECT_RATIOS,
  RESOLUTIONS,
  IMAGE_MIN_CREDITS,
  allowedResolutions,
  resolveResolutionForAspect,
  imageCreditCost,
} from "@/lib/kie/config";

const PILL =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[20px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none";
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[13px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] disabled:opacity-[0.42] disabled:pointer-events-none";
const LABEL = "flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-[var(--mute)]";

const PROMPT_MAX = 2000;
const IDEA_MAX = 600;
const MAX_IMAGES = 6; // gpt-image-2 aceita até 16; 6 cobra bem o caso de uso

type RefImage = { id: string; preview: string; key: string | null; uploading: boolean };
type Step = "form" | "submitting" | "polling" | "done" | "error";
type ImageDto = {
  id: string;
  status: "pending" | "generating" | "ready" | "failed";
  image_url: string | null;
  error_message: string | null;
};

export function ImageStudio({
  creditsTotal,
  unlimited,
  onGenerated,
  onAnimate,
}: {
  creditsTotal: number;
  unlimited: boolean;
  onGenerated?: () => void;
  /** Abre o painel "Animar" desta imagem no histórico (feature Vídeo). */
  onAnimate?: (imageId: string) => void;
}) {
  const t = useTranslations("images.studio");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  // referências (1 ou mais fotos da mesma pessoa)
  const [refs, setRefs] = useState<RefImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // prompt
  const [idea, setIdea] = useState("");
  const [prompt, setPrompt] = useState("");
  const [genPrompting, setGenPrompting] = useState(false);

  // opções
  const [aspect, setAspect] = useState<string>("auto");
  const [resolution, setResolution] = useState<string>("1K");

  // paywall
  const [noCredits, setNoCredits] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [paywallDetail, setPaywallDetail] = useState<string | null>(null);

  const [result, setResult] = useState<ImageDto | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cost = imageCreditCost(resolution);
  // Trava por crédito: precisa do mínimo (12 = 1K) pra gerar qualquer coisa, e
  // do custo da resolução escolhida (ex.: 4K=30) pra aquela resolução.
  const hasMinCredits = unlimited || creditsTotal >= IMAGE_MIN_CREDITS;
  const canAfford = unlimited || creditsTotal >= cost;
  const affordableResolution = (v: string) =>
    unlimited || creditsTotal >= imageCreditCost(v);
  const readyKeys = refs.filter((r) => r.key).map((r) => r.key as string);
  const anyUploading = refs.some((r) => r.uploading);
  const canSubmit =
    readyKeys.length > 0 && !anyUploading && prompt.trim().length > 0 && canAfford;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Clampa a resolução às restrições da proporção E ao saldo: se a escolhida
  // não couber no crédito, cai na mais barata que couber (e seja permitida).
  useEffect(() => {
    setResolution((r) => {
      const next = resolveResolutionForAspect(aspect, r);
      if (affordableResolution(next)) return next;
      const cheapest = allowedResolutions(aspect).find(affordableResolution);
      return cheapest ?? next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, creditsTotal, unlimited]);

  async function uploadOne(file: File, id: string) {
    try {
      const r = await fetch("/api/v1/images/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content_type: file.type }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message || t("errors.prepareUpload"));
      }
      const { key, upload_url } = await r.json();
      const put = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error(t("errors.sendImage"));
      setRefs((prev) =>
        prev.map((x) => (x.id === id ? { ...x, key, uploading: false } : x)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.upload"));
      setRefs((prev) => {
        const found = prev.find((x) => x.id === id);
        if (found) URL.revokeObjectURL(found.preview);
        return prev.filter((x) => x.id !== id);
      });
    }
  }

  function handleFiles(files: FileList | File[]) {
    setError(null);
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) {
      setError(t("errors.invalidFiles"));
      return;
    }
    const room = MAX_IMAGES - refs.length;
    if (room <= 0) {
      setError(t("errors.maxPhotos", { max: MAX_IMAGES }));
      return;
    }
    const take = imgs.slice(0, room);
    if (take.length < imgs.length) {
      setError(t("errors.maxPhotosIgnored", { max: MAX_IMAGES }));
    }
    const created = take.map((file) => ({
      file,
      id: crypto.randomUUID(),
      preview: URL.createObjectURL(file),
    }));
    setRefs((prev) => [
      ...prev,
      ...created.map(({ id, preview }) => ({ id, preview, key: null, uploading: true })),
    ]);
    created.forEach((c) => void uploadOne(c.file, c.id));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeRef(id: string) {
    setRefs((prev) => {
      const found = prev.find((x) => x.id === id);
      if (found) URL.revokeObjectURL(found.preview);
      return prev.filter((x) => x.id !== id);
    });
  }

  function clearImages() {
    setRefs((prev) => {
      prev.forEach((x) => URL.revokeObjectURL(x.preview));
      return [];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function autoPrompt() {
    if (!idea.trim() || genPrompting) return;
    setGenPrompting(true);
    setError(null);
    setBlocked(null);
    try {
      const r = await fetch("/api/v1/images/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j?.error?.code === "content_blocked") {
          setBlocked(j.error.message || t("errors.blockedFallback"));
          return;
        }
        throw new Error(j?.error?.message || t("errors.generatePrompt"));
      }
      const { prompt: out } = await r.json();
      setPrompt(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.generic"));
    } finally {
      setGenPrompting(false);
    }
  }

  function poll(id: string) {
    setStep("polling");
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/v1/images/${id}`, { cache: "no-store" });
        if (!r.ok) return;
        const { image } = await r.json();
        setResult(image as ImageDto);
        if (image.status === "ready" || image.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setStep(image.status === "ready" ? "done" : "error");
          if (image.status === "failed") setError(image.error_message || t("errors.generationFailed"));
          onGenerated?.();
        }
      } catch {
        /* ignore */
      }
    }, 3000);
  }

  async function handleGenerate() {
    if (!canSubmit) return;
    setStep("submitting");
    setError(null);
    setBlocked(null);
    setNoCredits(false);
    try {
      const r = await fetch("/api/v1/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input_image_keys: readyKeys,
          prompt: prompt.trim(),
          idea: idea.trim() || undefined,
          aspect_ratio: aspect,
          resolution,
        }),
      });
      if (r.status === 402) {
        const j = await r.json().catch(() => ({}));
        setSubscribed(Boolean(j?.error?.details?.subscribed));
        setPaywallDetail(j?.error?.message ?? null);
        setNoCredits(true);
        setStep("form");
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j?.error?.code === "content_blocked") {
          setBlocked(j.error.message || t("errors.blockedFallback"));
          setStep("form");
          return;
        }
        throw new Error(j?.error?.message || t("errors.generateImage"));
      }
      const { id } = await r.json();
      poll(id);
      onGenerated?.(); // já aparece como "na fila" no histórico
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.generic"));
      setStep("error");
    }
  }

  async function download(url: string) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `fastcloner-imagem-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  function reset() {
    setStep("form");
    setResult(null);
    setError(null);
    setBlocked(null);
    setPrompt("");
    setIdea("");
    clearImages();
  }

  // ───── resultado ─────
  if (step === "done" && result?.image_url) {
    return (
      <section className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-6">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {t("result.title")}
        </h2>
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)]">
          {/* presigned R2 → <img> simples (sem config de domínio no next/image) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.image_url} alt={t("result.alt")} className="mx-auto max-h-[60vh] w-auto" />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => download(result.image_url!)} className={PILL}>
            <Download className="h-4 w-4" />
            {t("result.download")}
          </button>
          {onAnimate && (
            <button type="button" onClick={() => onAnimate(result.id)} className={SECONDARY}>
              <Film className="h-4 w-4" />
              {t("result.animate")}
            </button>
          )}
          <button type="button" onClick={reset} className={SECONDARY}>
            {t("result.again")}
          </button>
        </div>
      </section>
    );
  }

  if (step === "submitting" || step === "polling") {
    return (
      <AudioGeneratingIndicator
        label={t("generating.label")}
        hint={t("generating.hint")}
      />
    );
  }

  // ───── formulário ─────
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Coluna 1 — referências (1 ou mais fotos) */}
      <div className="flex flex-col gap-2">
        <span className={LABEL}>
          {t("refs.label")}
          <FieldHint text={t("refs.hint")} />
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
          }}
        />
        {refs.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
            }}
            className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-8 text-center transition-colors hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-elevated)]"
          >
            <ImagePlus className="h-10 w-10 text-[var(--ash)]" />
            <span className="text-sm text-[var(--mute)]">
              {t("refs.dropzone")}
            </span>
            <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
              {t("refs.formats", { max: MAX_IMAGES })}
            </span>
          </button>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
            }}
            className="grid grid-cols-3 gap-2 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-3 sm:grid-cols-4"
          >
            {refs.map((r) => (
              <div
                key={r.id}
                className="relative aspect-square overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.preview} alt="" className="h-full w-full object-cover" />
                {r.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--canvas)]/60 backdrop-blur-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeRef(r.id)}
                  aria-label={t("refs.remove")}
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-raised)]/90 text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {refs.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label={t("refs.addMore")}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] text-[var(--ash)] transition-colors hover:border-[var(--hairline-bright)] hover:text-[var(--silver)]"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="font-mono text-[9px]">
                  {refs.length}/{MAX_IMAGES}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Coluna 2 — prompt + opções */}
      <div className="flex flex-col gap-5">
        {/* Ideia → prompt automático */}
        <div className="flex flex-col gap-2">
          <span className={LABEL}>
            {t("idea.label")}
            <FieldHint text={t("idea.hint")} />
          </span>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={IDEA_MAX}
            rows={2}
            placeholder={t("idea.placeholder")}
            className="resize-none rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={autoPrompt}
            disabled={!idea.trim() || genPrompting}
            className={`${SECONDARY} w-fit`}
          >
            {genPrompting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {genPrompting ? t("idea.generatingBtn") : t("idea.generateBtn")}
          </button>
        </div>

        {/* Prompt final */}
        <div className="flex flex-col gap-2">
          <span className={LABEL}>
            {t("prompt.label")}
            <FieldHint text={t("prompt.hint")} />
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={PROMPT_MAX}
            rows={4}
            placeholder={t("prompt.placeholder")}
            className="resize-none rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
          />
          <span className="self-end font-mono text-[10px] tabular-nums text-[var(--ash)]">
            {prompt.length} / {PROMPT_MAX}
          </span>
        </div>

        {/* Proporção */}
        <div className="flex flex-col gap-2">
          <span className={LABEL}>
            {t("aspect.label")}
            <FieldHint text={t("aspect.hint")} />
          </span>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIOS.map((a) => (
              <button
                key={a.value}
                type="button"
                title={t(`aspect.hints.${a.value.replace(":", "x")}`)}
                onClick={() => setAspect(a.value)}
                className={[
                  "rounded-[var(--radius)] border px-3 py-2 text-[13px] font-medium transition-colors",
                  aspect === a.value
                    ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)] text-[var(--ink)]"
                    : "border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--mute)] hover:border-[var(--hairline-bright)] hover:text-[var(--ink)]",
                ].join(" ")}
              >
                {t(`aspect.options.${a.value.replace(":", "x")}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Resolução */}
        <div className="flex flex-col gap-2">
          <span className={LABEL}>
            {t("resolution.label")}
            <FieldHint text={t("resolution.hint")} />
          </span>
          <div className="flex flex-wrap gap-2">
            {RESOLUTIONS.map((r) => {
              const allowedByAspect = allowedResolutions(aspect).includes(r.value);
              const affordable = affordableResolution(r.value);
              const allowed = allowedByAspect && affordable;
              const selected = resolution === r.value;
              const title = !allowedByAspect
                ? t("resolution.unavailable")
                : !affordable
                  ? t("resolution.needCredits", { credits: r.credits, resolution: r.value })
                  : t(`resolution.hints.${r.value}`);
              return (
                <button
                  key={r.value}
                  type="button"
                  disabled={!allowed}
                  title={title}
                  onClick={() => setResolution(r.value)}
                  className={[
                    "flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    selected
                      ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)] text-[var(--ink)]"
                      : "border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--mute)] hover:border-[var(--hairline-bright)] hover:text-[var(--ink)]",
                  ].join(" ")}
                >
                  {r.label}
                  <span className="font-mono text-[10px] text-[var(--ash)]">
                    {r.credits} cr
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {blocked && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3.5 py-3"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" />
            <p className="text-[13px] leading-snug text-[var(--body)]">{blocked}</p>
          </div>
        )}

        {error && <SupportError action={t("supportAction")} />}

        <PaywallModal
          open={noCredits}
          onClose={() => setNoCredits(false)}
          subscribed={subscribed}
          action={t("paywallAction")}
          detail={paywallDetail}
        />

        {/* Gerar */}
        <div className="flex flex-col gap-2">
          <button type="button" onClick={handleGenerate} disabled={!canSubmit} className={PILL}>
            <Wand2 className="h-4 w-4" />
            {hasMinCredits ? t("submit.generate", { cost }) : t("submit.insufficient")}
          </button>
          {!unlimited &&
            (hasMinCredits ? (
              <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
                {t("submit.balance", { credits: creditsTotal.toLocaleString("pt-BR"), cost })}
              </span>
            ) : (
              <span className="text-[12px] leading-snug text-[var(--mute)]">
                {t("submit.minNotice", {
                  credits: creditsTotal.toLocaleString("pt-BR"),
                  min: IMAGE_MIN_CREDITS,
                })}{" "}
                <Link
                  href="/app/credits"
                  className="font-medium text-[var(--ink)] underline underline-offset-2 hover:text-white"
                >
                  {t("submit.buyCredits")}
                </Link>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
