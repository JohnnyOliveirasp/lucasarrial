"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ImageIcon,
  Upload,
  X,
  Loader2,
  Wand2,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

type Scene = {
  id: string;
  idx: number;
  prompt_pt: string;
  image_status: "pending" | "generating" | "ready" | "failed" | null;
  resolution: string;
  image_error: string | null;
  image_url: string | null;
};

type RefImg = { id: string; preview: string; key: string | null; uploading: boolean };

const MAX_REFS = 6;
const RES_OPTIONS = ["1K", "2K", "4K"] as const;

const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50";

export function ImageStage({
  projectId,
  locale,
  onProjectChanged,
}: {
  projectId: string;
  locale: string;
  onProjectChanged: () => void;
}) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [hasReference, setHasReference] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ subscribed: boolean } | null>(null);

  // upload da referência
  const [refs, setRefs] = useState<RefImg[]>([]);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenId, setRegenId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/images`, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar imagens");
      const j = await res.json();
      setScenes((j.scenes ?? []) as Scene[]);
      setHasReference(!!j.has_reference);
      setHasConsent(!!j.has_consent);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const inflight = scenes.some((s) => s.image_status === "pending" || s.image_status === "generating");
  useEffect(() => {
    if (!inflight) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [inflight, load]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX_REFS - refs.length;
    const pick = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    for (const file of pick) {
      const id = `${file.name}-${file.size}-${refs.length}-${file.lastModified}`;
      const preview = URL.createObjectURL(file);
      setRefs((p) => [...p, { id, preview, key: null, uploading: true }]);
      try {
        const up = await fetch("/api/v1/images/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, content_type: file.type }),
        });
        if (!up.ok) throw new Error("upload-url");
        const { key, upload_url } = await up.json();
        const put = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!put.ok) throw new Error("PUT");
        setRefs((p) => p.map((r) => (r.id === id ? { ...r, key, uploading: false } : r)));
      } catch {
        setRefs((p) => p.filter((r) => r.id !== id));
        setError("Falha ao enviar uma das fotos. Tente de novo.");
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const readyKeys = refs.filter((r) => r.key && !r.uploading).map((r) => r.key as string);
  const canSave = readyKeys.length > 0 && consent && !saving && !refs.some((r) => r.uploading);

  async function saveReferenceAndGenerate() {
    setSaving(true);
    setError(null);
    try {
      const ref = await fetch(`/api/v1/videos/${projectId}/reference`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: readyKeys, consent: true }),
      });
      if (!ref.ok) {
        const j = await ref.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Falha ao salvar a referência");
      }
      setHasReference(true);
      setHasConsent(true);
      await generateBatch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function generateBatch() {
    setGenerating(true);
    setError(null);
    setBlockedMsg(null);
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/images`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setPaywall({ subscribed: !!j?.error?.details?.subscribed });
        return;
      }
      if (!res.ok) throw new Error(j?.error?.message || "Falha ao gerar imagens");
      if (j.blocked > 0) setBlockedMsg(`${j.blocked} cena(s) foram bloqueadas pela moderação de conteúdo.`);
      onProjectChanged();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate(sceneId: string, resolution: string) {
    setRegenId(sceneId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/images/${sceneId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setPaywall({ subscribed: !!j?.error?.details?.subscribed });
        return;
      }
      if (res.status === 400 && j?.error?.code === "content_blocked") {
        setBlockedMsg("Conteúdo bloqueado pela moderação nessa cena.");
        return;
      }
      if (!res.ok) throw new Error(j?.error?.message || "Falha ao regerar");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRegenId(null);
    }
  }

  if (loading) {
    return (
      <section className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />
        <span className="font-mono text-[12px] tracking-wide text-[var(--mute)]">Carregando…</span>
      </section>
    );
  }

  const errorBanner = error && (
    <p role="alert" className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
      {error}
    </p>
  );
  const blockedBanner = blockedMsg && (
    <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 py-2 text-[12px] text-[var(--body)]">
      <ShieldAlert className="h-4 w-4 text-[var(--silver)]" /> {blockedMsg}
    </p>
  );

  // ── Ainda sem referência/ciência: formulário de upload ──
  if (!hasReference || !hasConsent) {
    return (
      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-[var(--silver)]" />
          <h2 className="font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
            Sua foto de referência
          </h2>
        </div>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          Envie de <strong className="text-[var(--ink)]">1 a 6 fotos suas</strong> (rosto ou da
          cintura pra cima). Recomendado: 2–3 ângulos. Essa foto vira o padrão e é usada em
          <strong className="text-[var(--ink)]"> todas as cenas</strong>.
        </p>

        <div className="flex flex-wrap gap-3">
          {refs.map((r) => (
            <div key={r.id} className="relative h-24 w-24 overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.preview} alt="" className="h-full w-full object-cover" />
              {r.uploading && (
                <span className="absolute inset-0 flex items-center justify-center bg-[var(--canvas)]/50">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </span>
              )}
              <button
                type="button"
                onClick={() => setRefs((p) => p.filter((x) => x.id !== r.id))}
                className="absolute right-1 top-1 rounded-full bg-[var(--canvas)]/70 p-0.5 text-white"
                aria-label="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {refs.length < MAX_REFS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] text-[var(--mute)] hover:border-[var(--hairline-bright)] hover:text-[var(--ink)]"
            >
              <Upload className="h-5 w-5" />
              <span className="font-mono text-[10px]">Enviar</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </div>

        <label className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] p-3 text-[13px] text-[var(--body)]">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>
            Estou ciente de que a(s) foto(s) que enviei serão usadas em <strong className="text-[var(--ink)]">todas as cenas</strong>,
            que devo enviar uma foto <strong className="text-[var(--ink)]">minha e nítida</strong> (rosto ou da cintura pra cima),
            e que o resultado ruim por foto inadequada é de minha responsabilidade.
          </span>
        </label>

        {errorBanner}

        <button type="button" onClick={saveReferenceAndGenerate} disabled={!canSave} className={PILL}>
          {saving || generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {saving || generating ? "Gerando imagens…" : "Salvar e gerar imagens"}
        </button>
        <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
          Cada imagem custa 12 créditos (1K). Pode levar alguns minutos.
        </span>

        {paywall && <PaywallInline locale={locale} subscribed={paywall.subscribed} onClose={() => setPaywall(null)} />}
      </section>
    );
  }

  const pendingCount = scenes.filter((s) => s.image_status == null || s.image_status === "failed").length;

  // ── Referência ok: grade das imagens por cena ──
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
          <ImageIcon className="h-5 w-5 text-[var(--silver)]" /> Imagens das cenas
        </h2>
        {pendingCount > 0 && (
          <button type="button" onClick={generateBatch} disabled={generating} className={PILL}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {generating ? "Gerando…" : `Gerar ${pendingCount} imagem(ns)`}
          </button>
        )}
      </div>

      {errorBanner}
      {blockedBanner}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {scenes.map((s) => (
          <li key={s.id} className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-3">
            <div className="relative aspect-[9/16] overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)]">
              {s.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={s.image_url} alt={`Cena ${s.idx}`} className="h-full w-full object-cover" />
              ) : s.image_status === "failed" ? (
                <span className="flex h-full w-full items-center justify-center"><AlertTriangle className="h-6 w-6 text-[var(--status-error)]" /></span>
              ) : s.image_status === "pending" || s.image_status === "generating" ? (
                <span className="flex h-full w-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--ash)]" /></span>
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[var(--ash)]"><ImageIcon className="h-6 w-6" /></span>
              )}
              <span className="absolute left-1 top-1 rounded-full bg-[var(--canvas)]/70 px-1.5 font-mono text-[10px] text-white">{s.idx}</span>
            </div>
            <p className="line-clamp-2 text-[11px] leading-snug text-[var(--mute)]">{s.prompt_pt}</p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => regenerate(s.id, "1K")}
                disabled={regenId === s.id || s.image_status === "pending" || s.image_status === "generating"}
                title="Gerar novamente (1K, 12 créditos)"
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] py-1.5 font-sans text-[11px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)] disabled:opacity-50"
              >
                {regenId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3 text-[var(--silver)]" />}
                Regerar
              </button>
              <select
                aria-label={`Resolução da cena ${s.idx}`}
                defaultValue="1K"
                onChange={(e) => regenerate(s.id, e.target.value)}
                disabled={regenId === s.id}
                className="h-[26px] rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-deep)] px-1 font-mono text-[10px] text-[var(--mute)]"
              >
                {RES_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ul>

      {/* A geração de vídeos (Fase 4) vive no próprio estágio, logo abaixo. */}

      {paywall && <PaywallInline locale={locale} subscribed={paywall.subscribed} onClose={() => setPaywall(null)} />}
    </section>
  );
}

function PaywallInline({ locale, subscribed, onClose }: { locale: string; subscribed: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {subscribed ? "Créditos insuficientes" : "Assine para gerar"}
        </h3>
        <p className="text-sm text-[var(--body)]">
          {subscribed ? "Compre um pacote de créditos para continuar." : "Assine o plano para liberar créditos e gerar as imagens."}
        </p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]">Fechar</button>
          <Link href={subscribed ? `/${locale}/app/credits` : `/${locale}/planos`} className={PILL}>
            {subscribed ? "Comprar créditos" : "Assinar agora"}
          </Link>
        </div>
      </div>
    </div>
  );
}
