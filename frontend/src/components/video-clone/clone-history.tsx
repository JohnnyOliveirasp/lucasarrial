"use client";

/**
 * Histórico do Vídeo Clone: lista com thumb da foto, status, player (lightbox
 * simples via expandir), renomear, baixar e apagar. Auto-refresh enquanto
 * houver job em andamento (o GET individual sincroniza com o RunPod; aqui a
 * lista só recarrega).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clapperboard,
  Download,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { downloadFromUrl } from "@/components/image/download-file";
import { CLONE_ANIM_CSS } from "./clone-anim";

type Clone = {
  id: string;
  name: string | null;
  duration_seconds: number;
  tier: string;
  credits_cost: number;
  status: "pending" | "generating" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
  video_url: string | null;
  image_url: string | null;
};

const STATUS_LABEL: Record<Clone["status"], string> = {
  pending: "Na fila",
  generating: "Gerando…",
  ready: "Pronto",
  failed: "Falhou",
};

function fallbackName(c: Clone): string {
  return c.name?.trim() || `Vídeo Clone ${new Date(c.created_at).toLocaleDateString("pt-BR")}`;
}

export function CloneHistory({ reloadKey = 0 }: { reloadKey?: number }) {
  const [items, setItems] = useState<Clone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/video-clone", { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar histórico");
      const json = await res.json();
      setItems((json.clones ?? []) as Clone[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const hasInflight = items.some((i) => i.status === "pending" || i.status === "generating");
  useEffect(() => {
    if (!hasInflight) return;
    // Cutuca o sync de cada job em andamento e recarrega a lista.
    const t = setInterval(async () => {
      await Promise.all(
        items
          .filter((i) => i.status === "pending" || i.status === "generating")
          .map((i) => fetch(`/api/v1/video-clone/${i.id}`, { cache: "no-store" }).catch(() => null)),
      );
      load();
    }, 6000);
    return () => clearInterval(t);
  }, [hasInflight, items, load]);

  async function confirmDelete() {
    if (pendingDelete.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/v1/video-clone", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingDelete }),
      });
      if (!res.ok) throw new Error("Falha ao apagar");
      setPendingDelete([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setDeleting(false);
    }
  }

  async function saveName(id: string) {
    const name = draft.trim().slice(0, 120);
    try {
      const res = await fetch(`/api/v1/video-clone/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Falha ao renomear");
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, name: name || null } : c)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  if (loading) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--mute)]">Carregando…</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <Clapperboard className="h-10 w-10 text-[var(--ash)]" />
        <p className="text-sm text-[var(--mute)]">Nenhum Vídeo Clone ainda. Gere o primeiro acima.</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <style>{CLONE_ANIM_CSS}</style>

      {hasInflight && (
        <div className="flex items-center gap-3 overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3">
          <span className="vc-reel relative flex h-5 w-5 shrink-0 items-center justify-center">
            <Clapperboard className="h-5 w-5 text-[var(--silver)]" />
          </span>
          <span className="text-[13px] text-[var(--body)]">
            Gerando seu Vídeo Clone<span className="vc-dots" /> — pode levar alguns minutos. Pode sair e voltar.
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
          {error}
        </p>
      )}

      <ul className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
        {items.map((c, idx) => (
          <li
            key={c.id}
            className={`flex flex-col gap-3 bg-[var(--surface-card)] px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center ${idx > 0 ? "border-t border-[var(--hairline)]" : ""}`}
          >
            {/* Thumb (com shimmer + spinner enquanto gera) */}
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)]">
              {c.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image_url} alt="" className="h-full w-full object-cover" />
              ) : c.status === "failed" ? (
                <span className="flex h-full w-full items-center justify-center"><AlertTriangle className="h-5 w-5 text-[var(--status-error)]" /></span>
              ) : null}
              {(c.status === "pending" || c.status === "generating") && (
                <span className="absolute inset-0 flex items-center justify-center bg-[var(--canvas)]/45">
                  <span className="vc-shimmer absolute inset-0" aria-hidden />
                  <Loader2 className="relative h-5 w-5 animate-spin text-white" />
                </span>
              )}
            </span>

            {/* Nome + meta */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {editingId === c.id ? (
                <span className="flex items-center gap-1.5">
                  <input
                    ref={editRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName(c.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    maxLength={120}
                    className="w-52 rounded-[var(--radius-sm)] border border-[var(--hairline-bright)] bg-[var(--surface-deep)] px-2 py-1 text-base font-semibold text-[var(--ink)] outline-none"
                    aria-label="Nome do vídeo"
                  />
                  <button type="button" onClick={() => saveName(c.id)} aria-label="Salvar" className="text-[var(--silver)] hover:text-[var(--ink)]"><Check className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setEditingId(null)} aria-label="Cancelar" className="text-[var(--mute)] hover:text-[var(--ink)]"><X className="h-4 w-4" /></button>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-base font-semibold text-[var(--ink)]">{fallbackName(c)}</span>
                  <button type="button" onClick={() => { setEditingId(c.id); setDraft(c.name ?? ""); requestAnimationFrame(() => editRef.current?.focus()); }} aria-label="Renomear" className="text-[var(--mute)] hover:text-[var(--ink)]"><Pencil className="h-3.5 w-3.5" /></button>
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-wide text-[var(--ash)]">
                <span>{new Date(c.created_at).toLocaleString("pt-BR")}</span>
                <span>· {Math.ceil(c.duration_seconds)}s · {c.tier}</span>
                <span>· {c.credits_cost.toLocaleString("pt-BR")} cr</span>
                {c.status !== "ready" && (
                  <span className={c.status === "failed" ? "text-[var(--status-error)]" : "text-[var(--mute)]"}>
                    · {STATUS_LABEL[c.status]}
                    {(c.status === "pending" || c.status === "generating") && <span className="vc-dots" />}
                  </span>
                )}
              </div>
              {c.status === "failed" && c.error_message && (
                <span className="font-mono text-[10px] text-[var(--status-error)]">{c.error_message}</span>
              )}
            </div>

            {/* Ações */}
            <div className="flex items-center gap-3 sm:justify-end">
              <button
                type="button"
                disabled={c.status !== "ready" || !c.video_url}
                onClick={() => setOpenId(openId === c.id ? null : c.id)}
                aria-expanded={openId === c.id}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline)] px-2.5 py-1.5 font-mono text-[10px] tracking-wide text-[var(--silver)] transition-colors hover:border-[var(--hairline-bright)] hover:text-[var(--ink)] disabled:opacity-40"
              >
                <Clapperboard className="h-3.5 w-3.5" /> Assistir
              </button>
              <button
                type="button"
                disabled={!c.video_url}
                onClick={() => c.video_url && downloadFromUrl(c.video_url, fallbackName(c), "mp4")}
                aria-label="Baixar"
                className="text-[var(--mute)] transition-colors hover:text-[var(--ink)] disabled:opacity-30"
              >
                <Download className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => setPendingDelete([c.id])} aria-label="Apagar" className="text-[var(--mute)] transition-colors hover:text-[var(--status-error)]">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>

            {openId === c.id && c.video_url && (
              <div className="w-full sm:basis-full">
                <video src={c.video_url} controls loop playsInline preload="metadata" className="max-h-[420px] w-auto max-w-full rounded-[var(--radius)] border border-[var(--hairline-strong)]" />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Confirmação de delete */}
      {pendingDelete.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur" role="dialog" aria-modal="true" onClick={() => !deleting && setPendingDelete([])}>
          <div className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
              <h3 className="text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">Apagar vídeo?</h3>
            </div>
            <p className="text-sm text-[var(--body)]">
              Ação <strong className="text-[var(--ink)]">irreversível</strong>. Remove o vídeo, a foto e o áudio do armazenamento.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => !deleting && setPendingDelete([])} className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]">
                Cancelar
              </button>
              <button type="button" onClick={confirmDelete} disabled={deleting} className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--status-error)] hover:border-[var(--hairline-bright)] disabled:opacity-40">
                <Trash2 className="h-4 w-4" /> {deleting ? "Apagando…" : "Apagar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
