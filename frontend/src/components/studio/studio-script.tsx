"use client";

/**
 * Vídeo Estúdio F5 — roteirista documentário viral (opcional, antes de
 * gravar). Ideia → roteiro no formato do Estúdio, exibido como teleprompter
 * EDITÁVEL. A pessoa lê gravando e pode improvisar — a edição ancora no que
 * for FALADO (transcrição da F0), nunca neste texto.
 */
import { useState } from "react";
import { Loader2, PenLine, RefreshCw } from "lucide-react";
import { STUDIO_SCRIPT_COST } from "@/lib/studio/pricing";

const GHOST =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-6 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98] disabled:opacity-50";
const LABEL = "font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]";
const FIELD =
  "rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 font-sans text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus:border-[var(--hairline-bright)] focus:outline-none";

const DURATIONS = [30, 45, 60] as const;

export function StudioScript() {
  const [idea, setIdea] = useState("");
  const [seconds, setSeconds] = useState<number>(45);
  const [script, setScript] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/studio/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, seconds }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || "Falha ao gerar o roteiro");
      setScript(j.script as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-b border-dashed border-[var(--hairline-strong)] pb-6">
      <span className={LABEL}>Roteiro (opcional) — a IA escreve no formato documentário viral</span>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          maxLength={600}
          placeholder="Qual a ideia do vídeo? Ex.: como montei um sistema que edita vídeo sozinho"
          className={`${FIELD} h-11 w-full max-w-md`}
        />
        <select
          value={seconds}
          onChange={(e) => setSeconds(Number(e.target.value))}
          aria-label="Duração alvo do roteiro"
          className={`${FIELD} h-11`}
        >
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              ~{d}s de fala
            </option>
          ))}
        </select>
        <button type="button" onClick={generate} disabled={busy || idea.trim().length < 5} className={GHOST}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : script ? <RefreshCw className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
          {busy ? "Escrevendo…" : `${script ? "Refazer" : "Gerar roteiro"} · ${STUDIO_SCRIPT_COST} cr`}
        </button>
      </div>

      {error && (
        <p role="alert" className="font-mono text-[11px] tracking-wide text-[var(--status-error)]">
          {error}
        </p>
      )}

      {script && (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={8}
            aria-label="Roteiro gerado (editável)"
            className={`${FIELD} w-full max-w-2xl py-3 text-[17px] leading-relaxed`}
          />
          <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
            Leia gravando do seu jeito — pode improvisar. A edição segue o que você FALAR, não este texto.
          </span>
        </div>
      )}
    </div>
  );
}
