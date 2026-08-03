"use client";

/**
 * 🧪 Lab · Gravador pelo Celular — tela do DESKTOP: link/QR da sessão,
 * área de roteiro (fica na tela grande enquanto você grava no celular)
 * e os takes chegando com player (poll 4s).
 */
import { useEffect, useRef, useState } from "react";
import { Copy, Check, Smartphone, RefreshCw } from "lucide-react";
import { ScriptReader } from "@/components/voice/script-reader";

type Take = { key: string; name: string; size: number; at: string | null; url: string };

export function PhoneRecorderDesktop({ token, phoneUrl }: { token: string; phoneUrl: string }) {
  const [takes, setTakes] = useState<Take[]>([]);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLCanvasElement>(null);

  // QR do link (qrcode@1.5.4, desenha local no canvas — zero rede).
  useEffect(() => {
    let alive = true;
    void import("qrcode").then(({ toCanvas }) => {
      if (alive && qrRef.current) {
        void toCanvas(qrRef.current, phoneUrl, {
          width: 190,
          margin: 1,
          color: { dark: "#ffffff", light: "#0a0a0c" },
        });
      }
    });
    return () => { alive = false; };
  }, [phoneUrl]);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/v1/recorder-test/takes", { headers: { "x-recorder-token": token } });
        const j = await res.json();
        if (alive && res.ok) setTakes(j.takes ?? []);
      } catch { /* próxima volta */ }
    }
    void poll();
    const id = setInterval(poll, 4000);
    return () => { alive = false; clearInterval(id); };
  }, [token]);

  async function copy() {
    await navigator.clipboard.writeText(phoneUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      {/* Roteiro OFICIAL do Gravador (tema → IA gera o texto em blocos com
          direção emocional) — fica nesta tela enquanto você grava no celular. */}
      <div className="min-w-0">
        <ScriptReader />
      </div>

      <div className="flex flex-col gap-5">
        {/* Link do celular */}
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--mute)]">
            <Smartphone className="size-4 text-[var(--ash)]" /> Abrir no celular
          </span>
          <p className="text-[13px] leading-relaxed text-[var(--body)]">
            Aponte a câmera do celular pro QR (ou copie o link). A sessão vale o dia todo — pode recarregar a página à vontade.
          </p>
          <div className="flex justify-center rounded-[var(--radius)] border border-[var(--hairline)] bg-[#0a0a0c] p-3">
            <canvas ref={qrRef} className="rounded-[4px]" />
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-3 py-2 font-mono text-[11px] text-[var(--silver)]">
              {phoneUrl}
            </code>
            <button
              type="button"
              onClick={() => void copy()}
              className="flex h-9 flex-none items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] px-3 font-sans text-[12px] font-medium text-[var(--ink)] transition-colors hover:border-[var(--hairline-bright)]"
            >
              {copied ? <Check className="size-3.5 text-[var(--status-online)]" /> : <Copy className="size-3.5" />}
              {copied ? "copiado" : "copiar"}
            </button>
          </div>
        </div>

        {/* Takes chegando */}
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-[var(--mute)]">
            <RefreshCw className="size-3.5 text-[var(--ash)]" /> Takes do celular · {takes.length}
          </span>
          <ul className="flex flex-col gap-3">
            {takes.map((t) => (
              <li key={t.key} className="flex flex-col gap-1.5 rounded-[var(--radius)] border border-[var(--hairline)] p-3">
                <span className="flex items-baseline justify-between gap-2 font-mono text-[10px] text-[var(--ash)]">
                  <span className="truncate">{t.name}</span>
                  <span className="flex-none">{Math.round(t.size / 1024)}KB{t.at ? ` · ${new Date(t.at).toLocaleTimeString("pt-BR")}` : ""}</span>
                </span>
                <audio controls preload="none" src={t.url} className="h-9 w-full" />
                <a href={t.url} download={t.name} className="self-start font-mono text-[10px] uppercase tracking-wide text-[var(--mute)] hover:text-[var(--ink)]">
                  baixar
                </a>
              </li>
            ))}
            {takes.length === 0 && (
              <li className="py-4 text-center font-mono text-[11px] text-[var(--ash)]">
                aguardando o primeiro take…
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
