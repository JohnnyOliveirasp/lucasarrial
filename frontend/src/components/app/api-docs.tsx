"use client";

/**
 * Documentação de uso da API (Configurações → API): lista as vozes prontas do
 * usuário (ID copiável) e mostra o cURL de 2 passos (gerar + pollar). Link pro
 * Swagger completo.
 */
import { useCallback, useEffect, useState } from "react";
import { Copy, Check, Terminal, BookOpen } from "lucide-react";

type Voice = {
  id: string;
  name: string;
  status: string;
};

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignora */
        }
      }}
      className="flex items-center gap-1.5 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-fg transition-colors hover:border-accent hover:text-accent"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : label ?? "Copiar"}
    </button>
  );
}

export function ApiDocs() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [origin, setOrigin] = useState("https://aiverse.jcsolutionsus.com");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/voices", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setVoices((json.voices ?? []) as Voice[]);
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ready = voices.filter((v) => v.status === "ready");
  const sampleVoiceId = ready[0]?.id ?? "SEU_VOICE_ID";

  const curlGenerate = `curl -X POST "${origin}/api/v1/voices/${sampleVoiceId}/generate" \\
  -H "x-api-key: SUA_CHAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "Olá, isso é um teste da minha voz."}'`;

  const curlPoll = `curl "${origin}/api/v1/generations/GENERATION_ID" \\
  -H "x-api-key: SUA_CHAVE"
# Repita a cada ~30s até "status": "ready".
# Aí a resposta traz "audio_url" (link do .mp3, válido por 1h).`;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Terminal className="h-5 w-5 text-accent" />
        <h2 className="font-display text-2xl uppercase tracking-tight text-fg">
          Como usar (cURL)
        </h2>
      </div>

      {/* Vozes prontas */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
          Suas vozes prontas (use o ID na chamada)
        </span>
        {ready.length === 0 ? (
          <p className="text-sm text-muted-fg">
            Nenhuma voz pronta ainda. Treine uma voz primeiro.
          </p>
        ) : (
          <ul className="flex flex-col gap-px bg-border">
            {ready.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 bg-bg px-3 py-2"
              >
                <span className="flex items-center gap-2 overflow-hidden">
                  <span className="text-sm font-bold text-fg">{v.name}</span>
                  <code className="truncate font-mono text-[11px] text-muted-fg">
                    {v.id}
                  </code>
                </span>
                <CopyButton value={v.id} label="ID" />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Passo 1 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
            1. Gerar áudio → devolve generation_id
          </span>
          <CopyButton value={curlGenerate} />
        </div>
        <pre className="overflow-x-auto border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-fg">
          {curlGenerate}
        </pre>
      </div>

      {/* Passo 2 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
            2. Consultar status (polling ~30s) → audio_url quando pronto
          </span>
          <CopyButton value={curlPoll} />
        </div>
        <pre className="overflow-x-auto border border-border bg-surface p-3 font-mono text-[11px] leading-relaxed text-fg">
          {curlPoll}
        </pre>
      </div>

      <a
        href="/api/docs"
        target="_blank"
        rel="noreferrer"
        className="flex w-fit items-center gap-2 border border-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-accent hover:text-accent"
      >
        <BookOpen className="h-4 w-4" />
        Documentação completa (Swagger)
      </a>
    </section>
  );
}
