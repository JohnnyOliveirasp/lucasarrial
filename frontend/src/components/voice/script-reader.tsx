"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Printer, FileText } from "lucide-react";

type ScriptBlock = { emotion: string; text: string };
type VoiceScript = { title: string; style: string; blocks: ScriptBlock[] };

type Status = "loading" | "ready" | "error";

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
  .style { font: 600 11px/1 ui-monospace, monospace; letter-spacing: .18em; text-transform: uppercase; color: #d35400; margin: 0 0 4px; }
  h1 { font-size: 28px; margin: 0 0 24px; }
  section { margin: 0 0 20px; }
  h2 { font: 700 11px/1 ui-monospace, monospace; letter-spacing: .16em; text-transform: uppercase; color: #d35400; margin: 0 0 6px; }
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
      <section className="border border-dashed border-border bg-surface p-12 text-center flex flex-col items-center gap-4">
        <div className="h-10 w-10 border-4 border-accent border-t-transparent animate-spin" />
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          Gerando roteiro…
        </p>
      </section>
    );
  }

  if (status === "error" || !script) {
    return (
      <section className="border border-accent/40 bg-accent/5 p-6 flex flex-col gap-4">
        <p className="text-sm text-fg">Não consegui gerar o roteiro agora.</p>
        <button
          type="button"
          onClick={fetchScript}
          className="flex items-center gap-2 bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wide text-bg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:bg-accent hover:text-accent-fg w-fit"
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
          className="flex items-center gap-2 bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wide text-bg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-accent hover:text-accent-fg active:scale-[0.99]"
        >
          <RefreshCw className="h-4 w-4" />
          Gerar outro roteiro
        </button>
        <button
          type="button"
          onClick={printScript}
          className="flex items-center gap-2 border border-border px-5 py-3 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:bg-surface"
        >
          <Printer className="h-4 w-4" />
          Baixar / Imprimir
        </button>
      </div>

      <article className="border border-border bg-surface p-6 md:p-8 flex flex-col gap-6">
        <header className="flex flex-col gap-2 border-b border-border pb-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              {script.style}
            </span>
          </div>
          <h2 className="font-display text-3xl leading-[0.95] tracking-tight text-fg uppercase">
            {script.title}
          </h2>
        </header>

        {script.blocks.map((b, i) => (
          <section key={i} className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              {b.emotion}
            </span>
            <p className="text-lg leading-relaxed text-fg">{b.text}</p>
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
