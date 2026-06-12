"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Trash2,
  AlertTriangle,
  History as HistoryIcon,
  Pencil,
  Check,
  X,
  ChevronDown,
} from "lucide-react";

type Gen = {
  id: string;
  voice_id: string;
  voice_name: string;
  name: string | null;
  text_raw: string;
  status: "pending" | "generating" | "ready" | "failed";
  duration_seconds: number | null;
  created_at: string;
  audio_url: string | null;
  // Vem preenchido SOMENTE em admin view (rota detecta via ADMIN_EMAILS).
  user_email?: string | null;
};

const STATUS_LABEL: Record<Gen["status"], string> = {
  pending: "Na fila",
  generating: "Gerando…",
  ready: "Pronto",
  failed: "Falhou",
};

export function GenerationsHistory() {
  const [items, setItems] = useState<Gen[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string[]>([]); // ids aguardando confirmação
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const editInputRef = useRef<HTMLInputElement>(null);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/generations", { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar histórico");
      const json = await res.json();
      setItems((json.generations ?? []) as Gen[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((g) => g.id)),
    );
  }

  async function download(url: string, label: string) {
    // Extensão real do arquivo (no R2 é .mp3); deriva do path da URL, fallback mp3.
    let ext = "mp3";
    try {
      const m = new URL(url).pathname.match(/\.([a-z0-9]+)$/i);
      if (m) ext = m[1].toLowerCase();
    } catch {
      /* mantém mp3 */
    }
    // Nome do arquivo = nome do áudio (ou voz). Remove chars inválidos p/ filename.
    const safe =
      (label || "audio")
        .trim()
        .replace(/[\\/:*?"<>|]+/g, "")
        .replace(/\s+/g, " ")
        .slice(0, 120) || "audio";
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
      const res = await fetch("/api/v1/generations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pending }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Falha ao apagar");
      }
      setSelected(new Set());
      setPending([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setDeleting(false);
    }
  }

  function startEdit(g: Gen) {
    setEditingId(g.id);
    setDraft(g.name ?? "");
    setError(null);
    // foca no input no próximo tick (após render)
    requestAnimationFrame(() => editInputRef.current?.focus());
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft("");
  }

  async function saveEdit(id: string) {
    const name = draft.trim().slice(0, 120);
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/generations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Falha ao renomear");
      }
      setItems((prev) =>
        prev.map((g) => (g.id === id ? { ...g, name: name === "" ? null : name } : g)),
      );
      setEditingId(null);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <div className="h-10 w-10 animate-spin rounded-[var(--radius-full)] border-2 border-[var(--hairline-strong)] border-t-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--mute)]">
          Carregando histórico…
        </p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <HistoryIcon className="h-10 w-10 text-[var(--ash)]" />
        <p className="text-sm text-[var(--mute)]">
          Nenhum áudio gerado ainda. Gere um áudio numa voz pronta e ele aparece aqui.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar de seleção */}
      <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={selected.size === items.length && items.length > 0}
            onChange={toggleAll}
            className="accent-[var(--ink)]"
          />
          <span className="font-mono text-[10px] tracking-wide text-[var(--mute)]">
            {selected.size > 0 ? `${selected.size} selecionado(s)` : "Selecionar tudo"}
          </span>
        </label>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setPending([...selected])}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-4 font-sans text-[13px] font-medium text-[var(--status-error)] transition-colors hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)]"
          >
            <Trash2 className="h-4 w-4" />
            Apagar selecionados
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
        >
          {error}
        </p>
      )}

      {/* Lista */}
      <ul className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
        {items.map((g, idx) => {
          const checked = selected.has(g.id);
          return (
            <li
              key={g.id}
              className={`flex flex-col gap-3 bg-[var(--surface-card)] px-4 py-4 sm:flex-row sm:items-center ${
                idx > 0 ? "border-t border-[var(--hairline)]" : ""
              } ${checked ? "bg-[var(--surface-elevated)] ring-1 ring-inset ring-[var(--hairline-bright)]" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(g.id)}
                className="self-start accent-[var(--ink)] sm:self-center"
              />
              <div className="flex flex-1 flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {editingId === g.id ? (
                    <span className="flex items-center gap-1.5">
                      <input
                        ref={editInputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(g.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        maxLength={120}
                        placeholder={g.voice_name}
                        disabled={savingId === g.id}
                        className="w-48 rounded-[var(--radius-sm)] border border-[var(--hairline-bright)] bg-[var(--surface-deep)] px-2 py-1 text-lg font-semibold leading-none text-[var(--ink)] outline-none disabled:opacity-50"
                        aria-label="Nome do áudio"
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(g.id)}
                        disabled={savingId === g.id}
                        aria-label="Salvar nome"
                        className="text-[var(--silver)] transition-colors hover:text-[var(--ink)] disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={savingId === g.id}
                        aria-label="Cancelar"
                        className="text-[var(--mute)] transition-colors hover:text-[var(--ink)] disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ) : (
                    <span className="group/name flex items-center gap-1.5">
                      <span className="text-lg font-semibold leading-none text-[var(--ink)]">
                        {g.name?.trim() ? g.name : g.voice_name}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(g)}
                        aria-label="Editar nome do áudio"
                        className="text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                  <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
                    {new Date(g.created_at).toLocaleString("pt-BR")}
                  </span>
                  {g.name?.trim() && editingId !== g.id && (
                    <span
                      className="font-mono text-[10px] tracking-wide text-[var(--ash)]"
                      title="Voz usada"
                    >
                      · {g.voice_name}
                    </span>
                  )}
                  {g.user_email && (
                    <span
                      className="rounded-[var(--radius-full)] border border-[var(--hairline-strong)] px-2 py-0.5 font-mono text-[9px] tracking-wide text-[var(--silver)]"
                      title="Dono da geração"
                    >
                      {g.user_email}
                    </span>
                  )}
                </div>
                <p
                  className={`whitespace-pre-wrap text-sm text-[var(--body)] ${
                    expanded.has(g.id) ? "" : "line-clamp-2"
                  }`}
                >
                  {g.text_raw}
                </p>
                {g.text_raw.length > 120 && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(g.id)}
                    aria-expanded={expanded.has(g.id)}
                    className="flex w-fit items-center gap-1 font-mono text-[10px] tracking-wide text-[var(--silver)] transition-colors hover:text-[var(--ink)]"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        expanded.has(g.id) ? "rotate-180" : ""
                      }`}
                    />
                    {expanded.has(g.id) ? "ver menos" : "ver texto completo"}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 sm:w-[420px] sm:justify-end">
                {g.status === "ready" && g.audio_url ? (
                  <>
                    <audio
                      src={g.audio_url}
                      controls
                      controlsList="nodownload"
                      preload="metadata"
                      className="h-9 max-w-[220px]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        download(g.audio_url!, g.name?.trim() ? g.name : g.voice_name)
                      }
                      aria-label="Baixar"
                      className="text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <span
                    className={`font-mono text-[10px] tracking-wide ${
                      g.status === "failed" ? "text-[var(--status-error)]" : "text-[var(--mute)]"
                    }`}
                  >
                    {STATUS_LABEL[g.status]}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPending([g.id])}
                  aria-label="Apagar este áudio"
                  className="text-[var(--mute)] transition-colors hover:text-[var(--status-error)]"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

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
                Apagar {pending.length} áudio{pending.length > 1 ? "s" : ""}?
              </h3>
            </div>
            <p className="text-sm text-[var(--body)]">
              Ação <strong className="text-[var(--ink)]">irreversível</strong>. Remove o(s) áudio(s) do
              armazenamento e do histórico.
            </p>
            {error && (
              <p className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-deep)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !deleting && setPending([])}
                className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium text-[var(--status-error)] transition-colors hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98] disabled:opacity-40"
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
