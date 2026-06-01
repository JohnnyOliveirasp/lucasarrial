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
      <section className="border border-dashed border-border bg-surface p-12 flex flex-col items-center gap-4 text-center">
        <div className="h-10 w-10 border-4 border-accent border-t-transparent animate-spin" />
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
          Carregando histórico…
        </p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="border border-dashed border-border bg-surface p-12 flex flex-col items-center gap-4 text-center">
        <HistoryIcon className="h-10 w-10 text-muted-fg" />
        <p className="text-sm text-muted-fg">
          Nenhum áudio gerado ainda. Gere um áudio numa voz pronta e ele aparece aqui.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar de seleção */}
      <div className="flex items-center justify-between gap-4 border border-border bg-surface px-4 py-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.size === items.length && items.length > 0}
            onChange={toggleAll}
            className="accent-[var(--color-accent,#ff5500)]"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
            {selected.size > 0 ? `${selected.size} selecionado(s)` : "Selecionar tudo"}
          </span>
        </label>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setPending([...selected])}
            className="flex items-center gap-2 border border-accent px-4 py-2 text-xs font-bold uppercase tracking-wide text-accent transition-colors hover:bg-accent hover:text-accent-fg"
          >
            <Trash2 className="h-4 w-4" />
            Apagar selecionados
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent"
        >
          {error}
        </p>
      )}

      {/* Lista */}
      <ul className="flex flex-col gap-px bg-border">
        {items.map((g) => {
          const checked = selected.has(g.id);
          return (
            <li
              key={g.id}
              className={`flex flex-col gap-3 bg-bg px-4 py-4 sm:flex-row sm:items-center ${
                checked ? "ring-1 ring-accent ring-inset" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(g.id)}
                className="accent-[var(--color-accent,#ff5500)] self-start sm:self-center"
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
                        className="w-48 border border-accent bg-bg px-2 py-1 font-display text-lg uppercase leading-none text-fg outline-none disabled:opacity-50"
                        aria-label="Nome do áudio"
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(g.id)}
                        disabled={savingId === g.id}
                        aria-label="Salvar nome"
                        className="text-accent hover:opacity-70 disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={savingId === g.id}
                        aria-label="Cancelar"
                        className="text-muted-fg hover:text-fg disabled:opacity-40"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  ) : (
                    <span className="group/name flex items-center gap-1.5">
                      <span className="font-display text-lg uppercase leading-none text-fg">
                        {g.name?.trim() ? g.name : g.voice_name}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(g)}
                        aria-label="Editar nome do áudio"
                        className="text-muted-fg transition-colors hover:text-accent"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg">
                    {new Date(g.created_at).toLocaleString("pt-BR")}
                  </span>
                  {g.name?.trim() && editingId !== g.id && (
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg"
                      title="Voz usada"
                    >
                      · {g.voice_name}
                    </span>
                  )}
                  {g.user_email && (
                    <span
                      className="border border-accent/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-accent"
                      title="Dono da geração"
                    >
                      {g.user_email}
                    </span>
                  )}
                </div>
                <p
                  className={`text-sm text-muted-fg whitespace-pre-wrap ${
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
                    className="flex w-fit items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-accent transition-colors hover:opacity-70"
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
                      className="text-muted-fg hover:text-accent"
                    >
                      <Download className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                      g.status === "failed" ? "text-accent" : "text-muted-fg"
                    }`}
                  >
                    {STATUS_LABEL[g.status]}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setPending([g.id])}
                  aria-label="Apagar este áudio"
                  className="text-muted-fg hover:text-accent"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setPending([])}
        >
          <div
            className="w-full max-w-md border border-accent bg-bg p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-accent" />
              <h3 className="font-display text-xl uppercase tracking-tight text-fg">
                Apagar {pending.length} áudio{pending.length > 1 ? "s" : ""}?
              </h3>
            </div>
            <p className="text-sm text-muted-fg">
              Ação <strong className="text-fg">irreversível</strong>. Remove o(s) áudio(s) do
              armazenamento e do histórico.
            </p>
            {error && (
              <p className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !deleting && setPending([])}
                className="border border-border px-5 py-3 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
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
