"use client";

/**
 * F4 do Estúdio — multiplicação de variações: 1 vídeo montado vira até 6
 * versões trocando SÓ a legenda de hook queimada (custo ~zero, só ffmpeg no
 * worker). Backend já pronto: POST/GET /api/v1/studio/[id]/variants.
 * Renderizado pelo studio-result quando a montagem está pronta.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Download, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { downloadFromUrl } from "@/components/image/download-file";

const PILL =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-6 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50";
const GHOST =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-6 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98] disabled:opacity-50";
const LABEL = "font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]";
const MAX_VARIANTS = 6;
// Posições validadas no padrão da Máquina (§2.8): hook no topo; o meio testa.
const Y_TOP = 0.14;
const Y_MIDDLE = 0.5;

type Row = { text: string; yfrac: number };
type Status = "idle" | "processing" | "ready" | "failed";

export function StudioVariants({ projectId }: { projectId: string }) {
  const t = useTranslations("studio");
  const [status, setStatus] = useState<Status>("idle");
  const [urls, setUrls] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([{ text: "", yfrac: Y_TOP }, { text: "", yfrac: Y_TOP }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado atual (projeto aberto do histórico pode já ter variações).
  useEffect(() => {
    let alive = true;
    fetch(`/api/v1/studio/${projectId}/variants`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j?.variants) return;
        setStatus(j.variants.status as Status);
        setUrls(j.variants.urls ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Poll enquanto o worker gera (o GET sincroniza o job do RunPod).
  useEffect(() => {
    if (status !== "processing") return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/studio/${projectId}/variants`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (j?.variants) {
          setStatus(j.variants.status as Status);
          setUrls(j.variants.urls ?? []);
        }
      } catch {
        /* próximo tick */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [status, projectId]);

  async function submit() {
    const variants = rows
      .map((r) => ({ text: r.text.trim(), yfrac: r.yfrac }))
      .filter((r) => r.text);
    if (variants.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/studio/${projectId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variants }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || t("variants.errStart"));
      setUrls([]);
      setStatus("processing");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const filled = rows.filter((r) => r.text.trim()).length;
  const showForm = status === "idle" || status === "failed";

  return (
    <div className="mt-1 flex flex-col gap-3 border-t border-dashed border-[var(--hairline-strong)] pt-4">
      <span className={LABEL}>{t("variants.label")}</span>

      {showForm && (
        <div className="flex flex-col gap-2">
          {status === "failed" && (
            <p className="font-mono text-[11px] tracking-wide text-[var(--status-error)]">
              {t("variants.failed")}
            </p>
          )}
          <span className="max-w-2xl font-mono text-[10px] leading-relaxed tracking-wide text-[var(--ash)]">
            {t("variants.hint")}
          </span>
          {rows.map((row, i) => (
            <div key={i} className="flex w-full max-w-2xl items-center gap-2">
              <input
                type="text"
                value={row.text}
                maxLength={120}
                placeholder={t("variants.placeholder", { n: i + 1 })}
                onChange={(e) =>
                  setRows(rows.map((r, j) => (j === i ? { ...r, text: e.target.value } : r)))
                }
                className="h-11 flex-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 font-sans text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus:border-[var(--hairline-bright)] focus:outline-none"
              />
              <select
                value={row.yfrac}
                onChange={(e) =>
                  setRows(rows.map((r, j) => (j === i ? { ...r, yfrac: Number(e.target.value) } : r)))
                }
                aria-label={t("variants.posAria")}
                className="h-11 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-2 font-sans text-sm text-[var(--ink)] focus:border-[var(--hairline-bright)] focus:outline-none"
              >
                <option value={Y_TOP}>{t("variants.posTop")}</option>
                <option value={Y_MIDDLE}>{t("variants.posMiddle")}</option>
              </select>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  aria-label={t("variants.removeAria")}
                  className="flex h-11 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] text-[var(--ash)] transition-colors hover:text-[var(--ink)]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            {rows.length < MAX_VARIANTS && (
              <button
                type="button"
                onClick={() => setRows([...rows, { text: "", yfrac: Y_TOP }])}
                className={GHOST}
              >
                <Plus className="h-4 w-4" /> {t("variants.addRow")}
              </button>
            )}
            <button type="button" onClick={submit} disabled={busy || filled === 0} className={PILL}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              {t("variants.cta", { n: filled })}
            </button>
          </div>
          {error && (
            <p role="alert" className="font-mono text-[11px] tracking-wide text-[var(--status-error)]">
              {error}
            </p>
          )}
        </div>
      )}

      {status === "processing" && (
        <span className="flex items-center gap-2 text-sm text-[var(--ink)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />
          {t("variants.processing")}
        </span>
      )}

      {status === "ready" && (
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[11px] tracking-wide text-[var(--silver)]">
            ✓ {t("variants.readyCount", { n: urls.length })}
          </span>
          <div className="flex flex-wrap gap-4">
            {urls.map((url, i) => (
              <div key={i} className="flex flex-col gap-2">
                <video
                  src={url}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[320px] w-auto max-w-full rounded-[var(--radius)] border border-[var(--hairline-strong)]"
                />
                <button
                  type="button"
                  onClick={() => downloadFromUrl(url, `variacao-${i + 1}`, "mp4")}
                  className={GHOST}
                >
                  <Download className="h-4 w-4" /> {t("variants.download", { n: i + 1 })}
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setStatus("idle")} className={`${GHOST} w-fit`}>
            <RefreshCw className="h-4 w-4" /> {t("variants.regen")}
          </button>
        </div>
      )}
    </div>
  );
}
