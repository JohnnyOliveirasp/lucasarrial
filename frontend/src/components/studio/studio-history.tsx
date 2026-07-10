"use client";

/**
 * Histórico do Vídeo Estúdio: lista os áudios preparados. Clicar num pronto
 * abre o resultado (player + transcrição) no topo da página.
 */
import { useEffect, useState } from "react";
import { AudioLines, CheckCircle2, Loader2, XCircle } from "lucide-react";

type Item = {
  id: string;
  name: string | null;
  status: "processing" | "audio_ready" | "failed";
  duration_raw_seconds: number | null;
  duration_clean_seconds: number | null;
  removed_takes: number | null;
  error_message: string | null;
  created_at: string;
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function StudioHistory({
  reloadKey,
  onOpen,
}: {
  reloadKey: number;
  onOpen: (id: string) => void;
}) {
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/studio", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setItems(j?.projects ?? []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  if (items === null) {
    return (
      <p className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-[var(--ash)]">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
        Nenhum áudio preparado ainda — grave o primeiro acima.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => (
        <li key={it.id}>
          <button
            type="button"
            onClick={() => it.status !== "processing" && onOpen(it.id)}
            disabled={it.status === "processing"}
            className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3 text-left transition-[border-color] duration-[var(--dur-base)] hover:border-[var(--hairline-bright)] disabled:cursor-default disabled:hover:border-[var(--hairline-strong)]"
          >
            <span className="flex min-w-0 items-center gap-3">
              <AudioLines className="h-4 w-4 shrink-0 text-[var(--ash)]" />
              <span className="truncate font-sans text-sm text-[var(--ink)]">
                {it.name || "Áudio sem nome"}
              </span>
            </span>
            <span className="flex items-center gap-4 font-mono text-[10px] tracking-wide text-[var(--ash)]">
              {it.status === "audio_ready" && (
                <>
                  {typeof it.duration_clean_seconds === "number" && (
                    <span>{Math.round(it.duration_clean_seconds)}s limpos</span>
                  )}
                  {!!it.removed_takes && <span>{it.removed_takes} corte(s)</span>}
                  <span className="flex items-center gap-1 text-[var(--status-ok,#4ade80)]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> pronto
                  </span>
                </>
              )}
              {it.status === "processing" && (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> processando
                </span>
              )}
              {it.status === "failed" && (
                <span className="flex items-center gap-1 text-[var(--status-error)]">
                  <XCircle className="h-3.5 w-3.5" /> falhou
                </span>
              )}
              <span>{fmtDate(it.created_at)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
