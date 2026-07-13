"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Sparkles, Layers, Loader2, Check, ImageIcon, Wand2 } from "lucide-react";

type Scene = {
  id: string;
  idx: number;
  prompt_pt: string;
  prompt_en: string | null;
  script_excerpt: string | null;
  created_at: string;
};

type Props = {
  projectId: string;
  status: string;
  /** Nº estimado de cenas (pra mostrar antes de gerar). */
  estimatedScenes: number;
  /** Chamado após gerar cenas (pra o wizard atualizar status/stepper). */
  onProjectChanged: () => void;
};

export function SceneStage({ projectId, status, estimatedScenes, onProjectChanged }: Props) {
  const t = useTranslations("videoWizard.scenes");
  const tc = useTranslations("videoWizard.common");
  const tp = useTranslations("videoWizard.paywall");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [improvingId, setImprovingId] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ subscribed: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/scenes`, { cache: "no-store" });
      if (!res.ok) throw new Error(t("loadFailed"));
      const json = await res.json();
      const list = (json.scenes ?? []) as Scene[];
      setScenes(list);
      setDrafts(Object.fromEntries(list.map((s) => [s.id, s.prompt_pt])));
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setLoading(false);
    }
  }, [projectId, t, tc]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/scenes`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || t("generateFailed"));
      const list = (json.scenes ?? []) as Scene[];
      setScenes(list);
      setDrafts(Object.fromEntries(list.map((s) => [s.id, s.prompt_pt])));
      onProjectChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setGenerating(false);
    }
  }

  async function saveScene(scene: Scene) {
    const next = (drafts[scene.id] ?? "").trim();
    if (!next || next === scene.prompt_pt) return;
    setSavingId(scene.id);
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/scenes/${scene.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_pt: next }),
      });
      if (!res.ok) throw new Error(t("saveFailed"));
      setScenes((prev) => prev.map((s) => (s.id === scene.id ? { ...s, prompt_pt: next } : s)));
      setSavedId(scene.id);
      setTimeout(() => setSavedId((cur) => (cur === scene.id ? null : cur)), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setSavingId(null);
    }
  }

  async function improve(scene: Scene) {
    setImprovingId(scene.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/scenes/${scene.id}/improve`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setPaywall({ subscribed: !!json?.error?.details?.subscribed });
        return;
      }
      if (!res.ok) throw new Error(json?.error?.message || t("improveFailed"));
      const improved = json.scene.prompt_pt as string;
      setScenes((prev) => prev.map((s) => (s.id === scene.id ? { ...s, prompt_pt: improved } : s)));
      setDrafts((prev) => ({ ...prev, [scene.id]: improved }));
    } catch (e) {
      setError(e instanceof Error ? e.message : tc("error"));
    } finally {
      setImprovingId(null);
    }
  }

  if (loading) {
    return (
      <section className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />
        <span className="font-mono text-[12px] tracking-wide text-[var(--mute)]">{t("loading")}</span>
      </section>
    );
  }

  // Ainda não gerou: CTA de geração (grátis).
  if (scenes.length === 0) {
    return (
      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-[var(--silver)]" />
          <h2 className="font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
            {t("generateTitle")}
          </h2>
        </div>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          {t.rich("intro", {
            n: estimatedScenes,
            strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong>,
          })}
        </p>
        {error && <p className="text-sm text-[var(--status-error)]">{error}</p>}
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? t("generating") : t("generateTitle")}
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
          <Layers className="h-5 w-5 text-[var(--silver)]" />
          {t("count", { n: scenes.length })}
        </h2>
        <span className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
          {t("editHint")}
        </span>
      </div>

      {error && <p className="text-sm text-[var(--status-error)]">{error}</p>}

      <ul className="flex flex-col gap-3">
        {scenes.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-[var(--hairline-strong)] px-2 font-mono text-[11px] text-[var(--silver)]">
                {s.idx}
              </span>
              <div className="flex items-center gap-3">
                {savingId === s.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--ash)]" />}
                {savedId === s.id && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wide text-[var(--silver)]">
                    <Check className="h-3 w-3" /> {t("saved")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => improve(s)}
                  disabled={improvingId === s.id}
                  title={t("improveTitle")}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-2.5 py-1.5 font-sans text-[12px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--hairline-bright)] disabled:opacity-50"
                >
                  {improvingId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5 text-[var(--silver)]" />
                  )}
                  {t("improve")}
                </button>
              </div>
            </div>

            {s.script_excerpt && (
              <p className="font-mono text-[10px] leading-relaxed tracking-wide text-[var(--ash)]">
                “{s.script_excerpt}”
              </p>
            )}

            <textarea
              value={drafts[s.id] ?? ""}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))}
              onBlur={() => saveScene(s)}
              rows={3}
              maxLength={2000}
              className="w-full resize-y rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] p-3 text-[14px] leading-relaxed text-[var(--ink)] outline-none transition-colors focus:border-[var(--hairline-bright)]"
              aria-label={t("promptAria", { n: s.idx })}
            />
          </li>
        ))}
      </ul>

      <p className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-[var(--ash)]">
        <ImageIcon className="h-3.5 w-3.5" /> {t("nextHint")}
      </p>

      {/* Paywall do Improve (1 crédito) */}
      {paywall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => setPaywall(null)}
        >
          <div
            className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
              {paywall.subscribed ? tp("insufficientTitle") : tp("subscribeAiTitle")}
            </h3>
            <p className="text-sm text-[var(--body)]">
              {tp("improveCost")}{" "}
              {paywall.subscribed ? tp("buyPackShort") : tp("subscribePlain")}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPaywall(null)}
                className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
              >
                {tp("close")}
              </button>
              <Link
                href={paywall.subscribed ? "/app/credits" : "/planos"}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] text-[14px] font-medium text-[var(--pill-ink)] hover:brightness-95"
              >
                {paywall.subscribed ? tp("buyCredits") : tp("subscribeNow")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
