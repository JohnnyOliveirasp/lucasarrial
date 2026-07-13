"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Printer, FileText, X, Sparkles, Wand2 } from "lucide-react";
import { AudioGeneratingIndicator } from "@/components/voice/audio-generating-indicator";
import { SCRIPT_THEMES } from "@/lib/llm/script-themes";

type ScriptBlock = { emotion: string; text: string };
type VoiceScript = { title: string; style: string; blocks: ScriptBlock[] };

type Status = "idle" | "loading" | "ready" | "error";

const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]";
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)]";

/**
 * Roteiro de leitura para gravação de voz. Ao abrir, o usuário escolhe um TEMA
 * (popup) — história infantil, jornalístico, piadas… — e o Haiku gera um texto
 * naquele estilo, em blocos com direção emocional. A pessoa lê variando o tom.
 */
export function ScriptReader() {
  const t = useTranslations("voiceCreate.script");
  const [status, setStatus] = useState<Status>("idle");
  const [script, setScript] = useState<VoiceScript | null>(null);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(true); // abre o popup ao entrar

  const fetchScript = useCallback(async (id: string) => {
    setThemeId(id);
    setPickerOpen(false);
    setStatus("loading");
    try {
      const r = await fetch("/api/v1/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: id }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const { script: s } = (await r.json()) as { script: VoiceScript };
      setScript(s);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

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

  return (
    <>
      {pickerOpen && (
        <ThemePicker onPick={fetchScript} onClose={() => setPickerOpen(false)} closable={status !== "idle"} />
      )}

      {status === "idle" && !pickerOpen && (
        <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
          <Wand2 className="h-7 w-7 text-[var(--silver)]" />
          <p className="text-sm text-[var(--mute)]">{t("pickPrompt")}</p>
          <button type="button" onClick={() => setPickerOpen(true)} className={PILL}>
            <Sparkles className="h-4 w-4" />
            {t("pickTheme")}
          </button>
        </section>
      )}

      {status === "loading" && (
        <AudioGeneratingIndicator label={t("generating")} hint={t("generatingHint")} />
      )}

      {status === "error" && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <p className="text-sm text-[var(--ink)]">{t("error")}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => themeId && fetchScript(themeId)} className={`${PILL} w-fit`}>
              <RefreshCw className="h-4 w-4" />
              {t("retry")}
            </button>
            <button type="button" onClick={() => setPickerOpen(true)} className={`${SECONDARY} w-fit`}>
              <Sparkles className="h-4 w-4" />
              {t("changeTheme")}
            </button>
          </div>
        </section>
      )}

      {status === "ready" && script && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => themeId && fetchScript(themeId)} className={PILL}>
              <RefreshCw className="h-4 w-4" />
              {t("generateAnother")}
            </button>
            <button type="button" onClick={() => setPickerOpen(true)} className={SECONDARY}>
              <Sparkles className="h-4 w-4" />
              {t("changeTheme")}
            </button>
            <button type="button" onClick={printScript} className={SECONDARY}>
              <Printer className="h-4 w-4" />
              {t("print")}
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
      )}
    </>
  );
}

/** Popup de seleção de tema. `closable` libera o X (só faz sentido quando já há
 * um roteiro atrás — na primeira escolha não há pra onde fechar). */
function ThemePicker({
  onPick,
  onClose,
  closable,
}: {
  onPick: (id: string) => void;
  onClose: () => void;
  closable: boolean;
}) {
  const t = useTranslations("voiceCreate.script.picker");
  // trava o scroll do body enquanto o popup está aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closable ? onClose : undefined}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 max-h-[88svh] w-full max-w-[680px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6 shadow-[var(--elevation-popover)]"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
              {t("title")}
            </h3>
            <p className="mt-1 text-[13px] text-[var(--mute)]">
              {t("subtitle")}
            </p>
          </div>
          {closable && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="flex-none text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SCRIPT_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => onPick(theme.id)}
              className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-4 text-left transition-colors hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-elevated)]"
            >
              <span className="text-2xl leading-none">{theme.emoji}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--ink)]">{theme.label}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-[var(--ash)]">
                  {theme.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
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
