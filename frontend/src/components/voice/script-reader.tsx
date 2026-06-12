"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Printer, FileText } from "lucide-react";

type ScriptBlock = { emotion: string; text: string };
type VoiceScript = { title: string; style: string; blocks: ScriptBlock[] };

type Status = "loading" | "ready" | "error";

const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]";
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)]";

/**
 * Mostra um roteiro de leitura gerado dinamicamente (Haiku). A pessoa lê em voz
 * alta variando o tom de cada bloco. Botões: gerar outro / baixar-imprimir.
 */
export function ScriptReader() {
  const [status, setStatus] = useState<Status>("loading");
  const [script, setScript] = useState<VoiceScript | null>(null);

  const fetchScript = useCallback(async () => {
    setStatus("loading");
    try {
      const r = await fetch("/api/v1/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error(String(r.status));
      const { script: s } = (await r.json()) as { script: VoiceScript };
      setScript(s);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void fetchScript();
  }, [fetchScript]);

  function printScript() {
    if (!script) return;
    const blocksHtml = script.blocks
      .map(
        (b) =>
          `<section><h2>${escapeHtml(b.emotion)}</h2><p>${escapeHtml(b.text)}</p></section>`,
      )
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapeHtml(script.title)}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.7; max-width: 720px; margin: 0 auto; padding: 24px; }
  .style { font: 600 11px/1 ui-monospace, monospace; letter-spacing: .18em; text-transform: uppercase; color: #555; margin: 0 0 4px; }
  h1 { font-size: 28px; margin: 0 0 24px; }
  section { margin: 0 0 20px; }
  h2 { font: 700 11px/1 ui-monospace, monospace; letter-spacing: .16em; text-transform: uppercase; color: #555; margin: 0 0 6px; }
  p { margin: 0; font-size: 18px; }
</style></head><body>
<p class="style">${escapeHtml(script.style)}</p>
<h1>${escapeHtml(script.title)}</h1>
${blocksHtml}
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  if (status === "loading") {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <div className="h-10 w-10 animate-spin rounded-[var(--radius-full)] border-2 border-[var(--hairline-strong)] border-t-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--silver)]">
          Gerando roteiro…
        </p>
      </section>
    );
  }

  if (status === "error" || !script) {
    return (
      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <p className="text-sm text-[var(--ink)]">Não consegui gerar o roteiro agora.</p>
        <button
          type="button"
          onClick={fetchScript}
          className={`${PILL} w-fit`}
        >
          <RefreshCw className="h-4 w-4" />
          Tentar de novo
        </button>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={fetchScript}
          className={PILL}
        >
          <RefreshCw className="h-4 w-4" />
          Gerar outro roteiro
        </button>
        <button
          type="button"
          onClick={printScript}
          className={SECONDARY}
        >
          <Printer className="h-4 w-4" />
          Baixar / Imprimir
        </button>
      </div>

      <article className="flex flex-col gap-6 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6 md:p-8">
        <header className="flex flex-col gap-2 border-b border-[var(--hairline)] pb-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--silver)]" />
            <span className="font-mono text-[12px] tracking-wide text-[var(--silver)]">
              {script.style}
            </span>
          </div>
          <h2 className="text-3xl font-semibold leading-tight tracking-[-0.01em] text-[var(--ink)]">
            {script.title}
          </h2>
        </header>

        {script.blocks.map((b, i) => (
          <section key={i} className="flex flex-col gap-2">
            <span className="font-mono text-[11px] tracking-wide text-[var(--silver)]">
              {b.emotion}
            </span>
            <p className="text-lg leading-relaxed text-[var(--body)]">{b.text}</p>
          </section>
        ))}
      </article>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
