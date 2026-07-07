"use client";

/**
 * Vídeo Vendas TikTok — etapa de SETUP (Fase 1 do wizard):
 *   1. Fotos do PRODUTO (1-4) + preço/link/descrição opcionais
 *   2. Foto de quem APRESENTA (+ ciência de uso de imagem)
 *   3. Análise da IA (15cr) → 4. Roteiro de venda (gerar/refazer/varinha 15cr;
 *   editar na mão é grátis). A voz (TTS ou upload) é a próxima etapa.
 *
 * Usado em /videos/vendas/new (cria o projeto no 1º passo pago) e reaberto
 * pelo board via /videos/[id] (carrega o projeto existente).
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  UserRound,
  Sparkles,
  Wand2,
  RefreshCcw,
  Loader2,
  X,
  Check,
  ArrowLeft,
} from "lucide-react";
import { SALES_AI_COST } from "@/lib/video/config";
import { SalesVoice } from "@/components/video/sales-voice";

type LocalPhoto = { key: string; previewUrl: string };

type Project = {
  id: string;
  status: string;
  script_text: string | null;
  product_price: string | null;
  product_link: string | null;
  product_description: string | null;
  product_analysis: string | null;
  product_image_paths: string[] | null;
  reference_image_paths: string[] | null;
  product_images?: Array<{ key: string; url: string }>;
  reference_images?: Array<{ key: string; url: string }>;
};

async function uploadImage(file: File): Promise<string> {
  const slotRes = await fetch("/api/v1/images/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, content_type: file.type || "image/jpeg" }),
  });
  const slot = await slotRes.json().catch(() => ({}));
  if (!slotRes.ok) throw new Error(slot?.error?.message || "Falha ao preparar o upload.");
  const put = await fetch(slot.upload_url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!put.ok) throw new Error("Falha ao enviar a foto.");
  return slot.key as string;
}

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || "Algo deu errado.");
  return json;
}

export function SalesSetup({ locale, projectId }: { locale: string; projectId?: string }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(projectId ?? null);
  const [productPhotos, setProductPhotos] = useState<LocalPhoto[]>([]);
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [personPhotos, setPersonPhotos] = useState<LocalPhoto[]>([]);
  const [consent, setConsent] = useState(false);
  const [savedProduct, setSavedProduct] = useState(0);
  const [savedPerson, setSavedPerson] = useState(0);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [scriptDirty, setScriptDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // qual ação está rodando
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));

  // Reabrindo um projeto existente: hidrata análise/roteiro/campos.
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const json = await api(`/api/v1/videos/${projectId}`, "GET");
        const p = json.project as Project;
        setId(p.id);
        setPrice(p.product_price ?? "");
        setLink(p.product_link ?? "");
        setDescription(p.product_description ?? "");
        setAnalysis(p.product_analysis);
        setScript(p.script_text);
        setSavedProduct(p.product_image_paths?.length ?? 0);
        setSavedPerson(p.reference_image_paths?.length ?? 0);
        // F5/reabertura: re-hidrata as MINIATURAS com URLs assinadas do R2.
        setProductPhotos((p.product_images ?? []).map((x) => ({ key: x.key, previewUrl: x.url })));
        setPersonPhotos((p.reference_images ?? []).map((x) => ({ key: x.key, previewUrl: x.url })));
        // Ciência já foi dada quando as fotos da pessoa foram salvas.
        if ((p.reference_images ?? []).length > 0) setConsent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar o projeto");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const addProductPhotos = useCallback(
    async (files: FileList) => {
      setError(null);
      setBusy("upload");
      try {
        const room = 4 - productPhotos.length;
        for (const file of Array.from(files).slice(0, room)) {
          const key = await uploadImage(file);
          setProductPhotos((prev) => [...prev, { key, previewUrl: URL.createObjectURL(file) }]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro no upload");
      } finally {
        setBusy(null);
      }
    },
    [productPhotos.length],
  );

  const addPersonPhotos = useCallback(
    async (files: FileList) => {
      setError(null);
      setBusy("upload");
      try {
        const room = 6 - personPhotos.length;
        for (const file of Array.from(files).slice(0, room)) {
          const key = await uploadImage(file);
          setPersonPhotos((prev) => [...prev, { key, previewUrl: URL.createObjectURL(file) }]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro no upload");
      } finally {
        setBusy(null);
      }
    },
    [personPhotos.length],
  );

  /** Garante projeto criado + produto/pessoa salvos; devolve o id. */
  async function persistSetup(): Promise<string> {
    let pid = id;
    if (!pid) {
      const created = await api("/api/v1/videos", "POST", { kind: "sales" });
      pid = created.id as string;
      setId(pid);
      // URL passa a apontar pro projeto — F5 não perde nada.
      window.history.replaceState(null, "", `/${locale}/app/videos/${pid}`);
    }
    if (productPhotos.length > 0) {
      await api(`/api/v1/videos/${pid}/product`, "PATCH", {
        keys: productPhotos.map((p) => p.key),
        price,
        link,
        description,
      });
      setSavedProduct(productPhotos.length);
    }
    if (personPhotos.length > 0) {
      await api(`/api/v1/videos/${pid}/reference`, "PATCH", {
        keys: personPhotos.map((p) => p.key),
        consent: true,
      });
      setSavedPerson(personPhotos.length);
    }
    return pid;
  }

  const hasProduct = productPhotos.length > 0 || savedProduct > 0;
  const hasPerson = personPhotos.length > 0 || savedPerson > 0;
  const personConsentOk = personPhotos.length === 0 || consent;
  const canAnalyze = hasProduct && hasPerson && personConsentOk;

  async function runAnalyze() {
    setError(null);
    if (!hasProduct) {
      setError("Envie ao menos 1 foto do produto.");
      return;
    }
    if (!hasPerson) {
      setError("Envie a foto de quem vai apresentar — a análise usa as duas.");
      return;
    }
    if (!personConsentOk) {
      setError("Confirme a ciência sobre o uso da foto da pessoa.");
      return;
    }
    setBusy("analyze");
    try {
      const pid = await persistSetup();
      const json = await api(`/api/v1/videos/${pid}/analyze`, "POST");
      setAnalysis(json.analysis as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na análise");
    } finally {
      setBusy(null);
    }
  }

  async function runScript() {
    setError(null);
    setBusy("script");
    try {
      const json = await api(`/api/v1/videos/${id}/script`, "POST");
      setScript(json.script as string);
      setScriptDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no roteiro");
    } finally {
      setBusy(null);
    }
  }

  async function runWand() {
    setError(null);
    setBusy("wand");
    try {
      if (scriptDirty && script) {
        await api(`/api/v1/videos/${id}/script`, "PATCH", { script });
        setScriptDirty(false);
      }
      const json = await api(`/api/v1/videos/${id}/script-wand`, "POST");
      setScript(json.script as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na varinha");
    } finally {
      setBusy(null);
    }
  }

  async function saveScript() {
    if (!scriptDirty || !script?.trim()) return;
    setError(null);
    setBusy("save");
    try {
      await api(`/api/v1/videos/${id}/script`, "PATCH", { script });
      setScriptDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--mute)]">Carregando projeto…</p>
      </section>
    );
  }

  const inputCls =
    "h-10 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--ash)] focus:border-[var(--hairline-bright)] focus:outline-none";
  const btnCls =
    "inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50";
  const ghostBtnCls =
    "inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)] disabled:opacity-50";

  return (
    <div className="flex flex-col gap-8">
      <button
        type="button"
        onClick={() => router.push(`/${locale}/app/videos/vendas`)}
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] tracking-wide text-[var(--ash)] transition-colors hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Board
      </button>

      {error && (
        <p role="alert" className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
          {error}
        </p>
      )}

      {/* 1 — Produto */}
      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-[var(--silver)]" />
          <h2 className="font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">1 · O produto</h2>
          <span className="font-mono text-[11px] text-[var(--ash)]">{productPhotos.length}/4 fotos</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {productPhotos.map((p, i) => (
            <div key={p.key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt={`produto ${i + 1}`} className="h-24 w-24 rounded-[var(--radius)] border border-[var(--hairline-strong)] object-cover" />
              <button
                type="button"
                aria-label="Remover foto"
                onClick={() => setProductPhotos((prev) => prev.filter((x) => x.key !== p.key))}
                className="absolute -right-2 -top-2 inline-flex size-5 items-center justify-center rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] text-[var(--mute)] hover:text-[var(--ink)]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {productPhotos.length < 4 && (
            <label className={`${ghostBtnCls} h-24 w-24 cursor-pointer flex-col gap-1 font-mono text-[10px] text-[var(--ash)]`}>
              {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
              + adicionar ({productPhotos.length}/4)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addProductPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <p className="font-mono text-[11px] text-[var(--ash)]">
          Envie de 1 a 4 fotos do produto — dá pra selecionar várias de uma vez; ângulos diferentes ajudam a IA.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={inputCls} placeholder="Preço (opcional) — ex: R$ 89,90" value={price} onChange={(e) => setPrice(e.target.value)} maxLength={60} />
          <input className={inputCls} placeholder="Link do produto (opcional)" value={link} onChange={(e) => setLink(e.target.value)} maxLength={300} />
        </div>
        <textarea
          className={`${inputCls} h-auto min-h-[72px] py-2`}
          placeholder="Descreva o produto e o que você quer destacar (opcional) — a IA usa isso no roteiro."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
        />
      </section>

      {/* 2 — Quem apresenta */}
      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <div className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-[var(--silver)]" />
          <h2 className="font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">2 · Quem apresenta</h2>
          <span className="font-mono text-[11px] text-[var(--ash)]">{personPhotos.length}/6 fotos</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {personPhotos.map((p, i) => (
            <div key={p.key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.previewUrl} alt={`apresentador(a) ${i + 1}`} className="h-24 w-24 rounded-[var(--radius)] border border-[var(--hairline-strong)] object-cover" />
              <button
                type="button"
                aria-label="Remover foto"
                onClick={() => setPersonPhotos((prev) => prev.filter((x) => x.key !== p.key))}
                className="absolute -right-2 -top-2 inline-flex size-5 items-center justify-center rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] text-[var(--mute)] hover:text-[var(--ink)]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {personPhotos.length < 6 && (
            <label className={`${ghostBtnCls} h-24 w-24 cursor-pointer flex-col gap-1 font-mono text-[10px] text-[var(--ash)]`}>
              {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
              + adicionar ({personPhotos.length}/6)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addPersonPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <p className="max-w-sm text-[13px] text-[var(--mute)]">
            A pessoa que aparece nas cenas apresentando o produto — envie de 1 a
            6 fotos (quanto mais ângulos, mais fiel o rosto sai nas cenas).
          </p>
        </div>
        {personPhotos.length > 0 && (
          <label className="inline-flex cursor-pointer items-start gap-2 text-[13px] text-[var(--mute)]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            Confirmo que tenho autorização pra usar a imagem dessa pessoa.
          </label>
        )}
      </section>

      {/* 3 — Análise */}
      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--silver)]" />
            <h2 className="font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">3 · Análise do Produto</h2>
          </div>
          <button
            type="button"
            onClick={runAnalyze}
            disabled={busy !== null || !canAnalyze}
            title={canAnalyze ? "" : "Envie as fotos do produto E de quem apresenta (com a ciência marcada) pra liberar a análise."}
            className={btnCls}
          >
            {busy === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analysis ? `Analisar de novo (${SALES_AI_COST} cr)` : `Analisar produto (${SALES_AI_COST} cr)`}
          </button>
        </div>
        {analysis ? (
          <div className="whitespace-pre-wrap rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] p-4 text-[13px] leading-relaxed text-[var(--body)]">
            {analysis}
          </div>
        ) : (
          <p className="font-mono text-[11px] text-[var(--ash)]">
            A IA olha as fotos (e o que você informou) e monta o ângulo de venda — base do roteiro.
          </p>
        )}
      </section>

      {/* 4 — Roteiro */}
      {analysis && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-[var(--silver)]" />
              <h2 className="font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">4 · Roteiro de venda (máx. 60s)</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {script && (
                <button type="button" onClick={runWand} disabled={busy !== null} className={ghostBtnCls} title="A IA melhora o roteiro atual">
                  {busy === "wand" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  Varinha ({SALES_AI_COST} cr)
                </button>
              )}
              <button type="button" onClick={runScript} disabled={busy !== null} className={btnCls}>
                {busy === "script" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {script ? `Refazer (${SALES_AI_COST} cr)` : `Gerar roteiro (${SALES_AI_COST} cr)`}
              </button>
            </div>
          </div>
          {script != null && (
            <>
              <textarea
                className={`${inputCls} h-auto min-h-[160px] py-3 leading-relaxed`}
                value={script}
                onChange={(e) => {
                  setScript(e.target.value);
                  setScriptDirty(true);
                }}
                maxLength={2000}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-[var(--ash)]">
                  editar na mão é grátis · {script.trim().split(/\s+/).filter(Boolean).length} palavras
                </span>
                {scriptDirty && (
                  <button type="button" onClick={saveScript} disabled={busy !== null} className={ghostBtnCls}>
                    {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Salvar edição
                  </button>
                )}
              </div>

            </>
          )}
        </section>
      )}

      {/* 5 — Voz (aparece com roteiro salvo; anexou → converge pro pipeline) */}
      {analysis && script?.trim() && id && !scriptDirty && (
        <SalesVoice
          projectId={id}
          script={script}
          onAttached={() => window.location.reload()}
        />
      )}
    </div>
  );
}
