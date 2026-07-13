"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  AlertTriangle,
  Clapperboard,
  Loader2,
  ChevronRight,
} from "lucide-react";

type Project = {
  id: string;
  name: string | null;
  status: "draft" | "scenes" | "images" | "videos" | "rendering" | "done" | "failed";
  audio_duration_seconds: number | null;
  scene_count: number | null;
  video_tier: string | null;
  final_video_path: string | null;
  error_message: string | null;
  created_at: string;
};

// Estágios "em processamento" → auto-refresh do board.
const INFLIGHT = new Set<Project["status"]>(["rendering"]);

function fmtDuration(secs: number | null): string {
  if (secs == null) return "—";
  const s = Math.round(secs);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}min${r.toString().padStart(2, "0")}s` : `${r}s`;
}

export function VideoBoard({ kind = "story" }: { locale?: string; kind?: "story" | "sales" }) {
  const t = useTranslations("videoWizard.board");
  const tc = useTranslations("videoWizard.common");
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/videos?kind=${kind}`, { cache: "no-store" });
      if (!res.ok) throw new Error(t("loadFailed"));
      const json = await res.json();
      setItems((json.projects ?? []) as Project[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setLoading(false);
    }
  }, [kind, t, tc]);

  useEffect(() => {
    load();
  }, [load]);

  const hasInflight = items.some((i) => INFLIGHT.has(i.status));
  useEffect(() => {
    if (!hasInflight) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [hasInflight, load]);

  async function confirmDelete() {
    if (pending.length === 0) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/videos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pending }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || t("deleteFailed"));
      }
      setPending([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setDeleting(false);
    }
  }

  function startEdit(p: Project) {
    setEditingId(p.id);
    setDraft(p.name ?? "");
    requestAnimationFrame(() => editRef.current?.focus());
  }

  async function saveEdit(id: string) {
    const name = draft.trim().slice(0, 120);
    setSavingId(id);
    try {
      const res = await fetch(`/api/v1/videos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(t("renameFailed"));
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: name === "" ? null : name } : p)),
      );
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setSavingId(null);
    }
  }

  const NewButton = (
    <Link
      href={kind === "sales" ? "/app/videos/vendas/new" : "/app/videos/new"}
      className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98]"
    >
      <Plus className="h-4 w-4" />
      {t("newVideo")}
    </Link>
  );

  if (loading) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--mute)]">{tc("loading")}</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center gap-5 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <Clapperboard className="h-10 w-10 text-[var(--ash)]" />
        <p className="max-w-sm text-sm text-[var(--mute)]">{t("empty")}</p>
        {NewButton}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
          {t("projectCount", { n: items.length })}
        </span>
        {NewButton}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
        {items.map((p, idx) => (
          <li
            key={p.id}
            className={`flex flex-col gap-3 bg-[var(--surface-card)] px-4 py-4 sm:flex-row sm:items-center ${
              idx > 0 ? "border-t border-[var(--hairline)]" : ""
            }`}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--hairline)] ${
                p.status === "failed" ? "text-[var(--status-error)]" : "text-[var(--silver)]"
              }`}
            >
              {p.status === "rendering" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Clapperboard className="h-5 w-5" />
              )}
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {editingId === p.id ? (
                <span className="flex items-center gap-1.5">
                  <input
                    ref={editRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(p.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    maxLength={120}
                    disabled={savingId === p.id}
                    className="w-52 rounded-[var(--radius-sm)] border border-[var(--hairline-bright)] bg-[var(--surface-deep)] px-2 py-1 text-base font-semibold text-[var(--ink)] outline-none disabled:opacity-50"
                    aria-label={t("nameAria")}
                  />
                  <button type="button" onClick={() => saveEdit(p.id)} aria-label={t("save")} className="text-[var(--silver)] hover:text-[var(--ink)]">
                    <Check className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} aria-label={tc("cancel")} className="text-[var(--mute)] hover:text-[var(--ink)]">
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-base font-semibold text-[var(--ink)]">
                    {p.name?.trim() ||
                      tc("videoFallbackName", {
                        date: new Date(p.created_at).toLocaleDateString("pt-BR"),
                      })}
                  </span>
                  <button type="button" onClick={() => startEdit(p)} aria-label={t("rename")} className="text-[var(--mute)] hover:text-[var(--ink)]">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-wide text-[var(--ash)]">
                <span
                  className={
                    p.status === "failed"
                      ? "text-[var(--status-error)]"
                      : p.status === "done"
                        ? "text-[var(--silver)]"
                        : "text-[var(--mute)]"
                  }
                >
                  {t(`status.${p.status}`)}
                </span>
                <span>· {fmtDuration(p.audio_duration_seconds)}</span>
                {p.scene_count != null && <span>· {t("sceneMeta", { n: p.scene_count })}</span>}
                <span>· {new Date(p.created_at).toLocaleString("pt-BR")}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:justify-end">
              <Link
                href={`/app/videos/${p.id}`}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-3 py-1.5 font-sans text-[13px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--hairline-bright)]"
              >
                {t("open")}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setPending([p.id])}
                aria-label={t("delete")}
                className="text-[var(--mute)] transition-colors hover:text-[var(--status-error)]"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {pending.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setPending([])}
        >
          <div
            className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
              <h3 className="text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
                {t("deleteTitle")}
              </h3>
            </div>
            <p className="text-sm text-[var(--body)]">
              {t.rich("deleteWarning", {
                strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong>,
              })}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !deleting && setPending([])}
                className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--status-error)] hover:border-[var(--hairline-bright)] disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? t("deleting") : t("delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
