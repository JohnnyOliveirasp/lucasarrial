import { FileText } from "lucide-react";

/**
 * ScriptWindow — substitui a "code window" do Resend pela janela de roteiro.
 * DM Mono 13px. Linhas de direção `[ ... ]` em itálico mute; falas em body.
 */
export interface ScriptLine {
  tag: string;
  text: string;
  kind?: "dir" | "normal" | "dim";
}

export interface ScriptWindowProps {
  filename?: string;
  langLabel?: string;
  lines: ScriptLine[];
}

export function ScriptWindow({
  filename = "roteiro-01.fp",
  langLabel = "PT-BR",
  lines,
}: ScriptWindowProps) {
  return (
    <div className="w-full max-w-[520px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)]">
      <div className="flex items-center gap-2.5 border-b border-[var(--hairline)] px-4 py-[11px]">
        <FileText className="size-3.5 text-[var(--ash)]" />
        <span className="font-mono text-[12px] text-[var(--mute)]">
          {filename}
        </span>
        <span className="ml-auto text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--ash)]">
          {langLabel}
        </span>
      </div>
      <div className="px-4 py-3.5">
        {lines.map((line, i) => (
          <div
            key={i}
            className="flex gap-3.5 py-[3px] font-mono text-[13px] leading-[1.7]"
          >
            <span className="w-14 flex-none select-none text-right text-[#464a4d]">
              {line.tag}
            </span>
            <span
              className={
                line.kind === "dir"
                  ? "italic text-[var(--mute)]"
                  : line.kind === "dim"
                    ? "text-[var(--ash)]"
                    : "text-[var(--body)]"
              }
            >
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
