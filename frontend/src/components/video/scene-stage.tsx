"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  locale: string;
  status: string;
  /** Nº estimado de cenas (pra mostrar antes de gerar). */
  estimatedScenes: number;
  /** Chamado após gerar cenas (pra o wizard atualizar status/stepper). */
  onProjectChanged: () => void;
};

export function SceneStage({ projectId, locale, status, estimatedScenes, onProjectChanged }: Props) {
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
      if (!res.ok) throw new Error("Falha ao carregar cenas");
      const json = await res.json();
      const list = (json.scenes ?? []) as Scene[];
      setScenes(list);
      setDrafts(Object.fromEntries(list.map((s) => [s.id, s.prompt_pt])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/scenes`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao gerar cenas");
      const list = (json.scenes ?? []) as Scene[];
      setScenes(list);
      setDrafts(Object.fromEntries(list.map((s) => [s.id, s.prompt_pt])));
      onProjectChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
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
      if (!res.ok) throw new Error("Falha ao salvar");
      setScenes((prev) => prev.map((s) => (s.id === scene.id ? { ...s, prompt_pt: next } : s)));
      setSavedId(scene.id);
      setTimeout(() => setSavedId((cur) => (cur === scene.id ? null : cur)), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
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
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao melhorar");
      const improved = json.scene.prompt_pt as string;
      setScenes((prev) => prev.map((s) => (s.id === scene.id ? { ...s, prompt_pt: improved } : s)));
      setDrafts((prev) => ({ ...prev, [scene.id]: improved }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setImprovingId(null);
    }
  }

  if (loading) {
    return (
      <section className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />
        <span className="font-mono text-[12px] tracking-wide text-[var(--mute)]">Carregando cenas…</span>
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
            Gerar cenas
          </h2>
        </div>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          A IA vai dividir o seu roteiro em <strong className="text-[var(--ink)]">~{estimatedScenes} cenas</strong> em
          ordem, com um prompt visual em português pra cada uma. Você pode editar
          tudo depois. Gerar as cenas é grátis.
        </p>
        {error && <p className="text-sm text-[var(--status-error)]">{error}</p>}
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Gerando cenas…" : "Gerar cenas"}
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
          <Layers className="h-5 w-5 text-[var(--silver)]" />
          {scenes.length} cenas
        </h2>
        <span className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
          edite à mão ou use a ✨ (1 crédito)
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
                    <Check className="h-3 w-3" /> salvo
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => improve(s)}
                  disabled={improvingId === s.id}
                  title="Melhorar prompt com IA (1 crédito)"
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-2.5 py-1.5 font-sans text-[12px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--hairline-bright)] disabled:opacity-50"
                >
                  {improvingId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5 text-[var(--silver)]" />
                  )}
                  Melhorar
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
              aria-label={`Prompt da cena ${s.idx}`}
            />
          </li>
        ))}
      </ul>

      <p className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-[var(--ash)]">
        <ImageIcon className="h-3.5 w-3.5" /> Quando as cenas estiverem boas, gere as imagens abaixo.
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
              {paywall.subscribed ? "Créditos insuficientes" : "Assine para usar a IA"}
            </h3>
            <p className="text-sm text-[var(--body)]">
              Melhorar o prompt com IA custa 1 crédito.{" "}
              {paywall.subscribed
                ? "Compre um pacote para continuar."
                : "Assine o plano para liberar créditos."}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPaywall(null)}
                className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
              >
                Fechar
              </button>
              <Link
                href={paywall.subscribed ? `/${locale}/app/credits` : `/${locale}/planos`}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] text-[14px] font-medium text-[var(--pill-ink)] hover:brightness-95"
              >
                {paywall.subscribed ? "Comprar créditos" : "Assinar agora"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
