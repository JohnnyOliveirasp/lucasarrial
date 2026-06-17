"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  Download,
  Trash2,
  Pencil,
  Check,
  X,
  AlertTriangle,
  ImageIcon,
  Film,
  Loader2,
} from "lucide-react";

type Img = {
  id: string;
  name: string | null;
  prompt: string;
  aspect_ratio: string;
  resolution: string;
  credits_cost: number;
  status: "pending" | "generating" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
  image_url: string | null;
};

const STATUS_LABEL: Record<Img["status"], string> = {
  pending: "Na fila",
  generating: "Gerando…",
  ready: "Pronto",
  failed: "Falhou",
};

function fallbackName(g: Img): string {
  return g.name?.trim() || `Imagem ${new Date(g.created_at).toLocaleDateString("pt-BR")}`;
}

export function ImageHistory({ reloadKey = 0 }: { reloadKey?: number }) {
  const [items, setItems] = useState<Img[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Img | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/images", { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar histórico");
      const json = await res.json();
      setItems((json.images ?? []) as Img[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  // Auto-refresh enquanto houver imagem em andamento (na fila/gerando).
  const hasInflight = items.some((i) => i.status === "pending" || i.status === "generating");
  useEffect(() => {
    if (!hasInflight) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [hasInflight, load]);

  async function download(url: string, label: string) {
    let ext = "png";
    try {
      const m = new URL(url).pathname.match(/\.([a-z0-9]+)$/i);
      if (m) ext = m[1].toLowerCase();
    } catch {
      /* png */
    }
    const safe =
      (label || "imagem").trim().replace(/[\\/:*?"<>|]+/g, "").slice(0, 120) || "imagem";
    try {
      const res = await fetch(url, { cache: "no-store" });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${safe}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  async function confirmDelete() {
    if (pending.length === 0) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pending }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Falha ao apagar");
      }
      setPending([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setDeleting(false);
    }
  }

  function startEdit(g: Img) {
    setEditingId(g.id);
    setDraft(g.name ?? "");
    requestAnimationFrame(() => editRef.current?.focus());
  }

  async function saveEdit(id: string) {
    const name = draft.trim().slice(0, 120);
    setSavingId(id);
    try {
      const res = await fetch(`/api/v1/images/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Falha ao renomear");
      setItems((prev) =>
        prev.map((g) => (g.id === id ? { ...g, name: name === "" ? null : name } : g)),
      );
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--mute)]">
          Carregando histórico…
        </p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <ImageIcon className="h-10 w-10 text-[var(--ash)]" />
        <p className="text-sm text-[var(--mute)]">
          Nenhuma imagem ainda. Gere a primeira acima e ela aparece aqui.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
        {items.map((g, idx) => (
          <li
            key={g.id}
            className={`flex flex-col gap-3 bg-[var(--surface-card)] px-4 py-4 sm:flex-row sm:items-center ${
              idx > 0 ? "border-t border-[var(--hairline)]" : ""
            }`}
          >
            {/* Thumb / olho */}
            <button
              type="button"
              onClick={() => g.image_url && setLightbox(g)}
              disabled={!g.image_url}
              aria-label="Ver imagem"
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] disabled:cursor-default"
            >
              {g.image_url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.image_url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-[var(--canvas)]/0 opacity-0 transition-opacity hover:bg-[var(--canvas)]/40 hover:opacity-100">
                    <Eye className="h-5 w-5 text-white" />
                  </span>
                </>
              ) : g.status === "failed" ? (
                <span className="flex h-full w-full items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
                </span>
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--ash)]" />
                </span>
              )}
            </button>

            {/* Nome + meta */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {editingId === g.id ? (
                <span className="flex items-center gap-1.5">
                  <input
                    ref={editRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(g.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    maxLength={120}
                    disabled={savingId === g.id}
                    className="w-52 rounded-[var(--radius-sm)] border border-[var(--hairline-bright)] bg-[var(--surface-deep)] px-2 py-1 text-base font-semibold text-[var(--ink)] outline-none disabled:opacity-50"
                    aria-label="Nome da imagem"
                  />
                  <button type="button" onClick={() => saveEdit(g.id)} aria-label="Salvar" className="text-[var(--silver)] hover:text-[var(--ink)]">
                    <Check className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} aria-label="Cancelar" className="text-[var(--mute)] hover:text-[var(--ink)]">
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-base font-semibold text-[var(--ink)]">
                    {fallbackName(g)}
                  </span>
                  <button type="button" onClick={() => startEdit(g)} aria-label="Renomear" className="text-[var(--mute)] hover:text-[var(--ink)]">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-wide text-[var(--ash)]">
                <span>{new Date(g.created_at).toLocaleString("pt-BR")}</span>
                <span>· {g.aspect_ratio} · {g.resolution}</span>
                {g.status !== "ready" && (
                  <span className={g.status === "failed" ? "text-[var(--status-error)]" : "text-[var(--mute)]"}>
                    · {STATUS_LABEL[g.status]}
                  </span>
                )}
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-3 sm:justify-end">
              <button
                type="button"
                disabled
                title="Em breve: gerar vídeo a partir desta imagem"
                aria-label="Usar imagem (em breve)"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline)] px-2.5 py-1.5 font-mono text-[10px] tracking-wide text-[var(--ash)] opacity-50"
              >
                <Film className="h-3.5 w-3.5" />
                Usar
              </button>
              <button
                type="button"
                disabled={!g.image_url}
                onClick={() => g.image_url && download(g.image_url, fallbackName(g))}
                aria-label="Baixar"
                className="text-[var(--mute)] transition-colors hover:text-[var(--ink)] disabled:opacity-30"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setPending([g.id])}
                aria-label="Apagar"
                className="text-[var(--mute)] transition-colors hover:text-[var(--status-error)]"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Lightbox */}
      {lightbox?.image_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]/85 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <div className="flex max-h-[90vh] max-w-3xl flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.image_url}
              alt={fallbackName(lightbox)}
              className="max-h-[78vh] w-auto rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-[var(--mute)]">{fallbackName(lightbox)}</span>
              <button
                type="button"
                onClick={() => download(lightbox.image_url!, fallbackName(lightbox))}
                className="inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-4 text-[13px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
              >
                <Download className="h-4 w-4" />
                Baixar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de delete */}
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
                Apagar imagem?
              </h3>
            </div>
            <p className="text-sm text-[var(--body)]">
              Ação <strong className="text-[var(--ink)]">irreversível</strong>. Remove a imagem do
              armazenamento e do histórico.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !deleting && setPending([])}
                className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--status-error)] hover:border-[var(--hairline-bright)] disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Apagando…" : "Apagar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
