"use client";

/**
 * Documentação de uso da API (Configurações → API): lista as vozes prontas do
 * usuário (ID copiável) e mostra o cURL de 2 passos (gerar + pollar). Link pro
 * Swagger completo.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, Terminal, BookOpen, ArrowUpRight } from "lucide-react";

type Voice = {
  id: string;
  name: string;
  status: string;
};

function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useTranslations("shell.apiDocs");
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
      className="inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] px-2.5 py-1.5 font-sans text-[12px] text-[var(--mute)] transition-[color,border-color] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:text-[var(--ink)]"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? t("copied") : label ?? t("copy")}
    </button>
  );
}

export function ApiDocs() {
  const t = useTranslations("shell.apiDocs");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [origin, setOrigin] = useState("https://fastcloner.com");

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
  const sampleVoiceId = ready[0]?.id ?? t("yourVoiceId");

  const curlGenerate = `curl -X POST "${origin}/api/v1/voices/${sampleVoiceId}/generate" \\
  -H "x-api-key: ${t("yourKey")}" \\
  -H "Content-Type: application/json" \\
  -d '{"text": "${t("sampleText")}"}'`;

  const curlPoll = `curl "${origin}/api/v1/generations/GENERATION_ID" \\
  -H "x-api-key: ${t("yourKey")}"
${t("pollComment")}`;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-2.5">
        <Terminal className="h-5 w-5 text-[var(--silver)]" />
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
          {t("title")}
        </h2>
      </div>

      {/* Vozes prontas */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] text-[var(--silver)]">
          {t("readyVoices")}
        </span>
        {ready.length === 0 ? (
          <p className="text-[14px] text-[var(--mute)]">
            {t("noReadyVoices")}
          </p>
        ) : (
          <ul className="flex flex-col rounded-[var(--radius)] border border-[var(--hairline-strong)]">
            {ready.map((v, i) => (
              <li
                key={v.id}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 ${
                  i > 0 ? "border-t border-[var(--hairline)]" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5 overflow-hidden">
                  <span className="text-[14px] font-medium text-[var(--ink)]">
                    {v.name}
                  </span>
                  <code className="truncate font-mono text-[13px] text-[var(--ash)]">
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
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[var(--silver)]">
            {t("step1")}
          </span>
          <CopyButton value={curlGenerate} />
        </div>
        <pre className="overflow-x-auto rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3.5 font-mono text-[13px] leading-relaxed text-[var(--silver)]">
          {curlGenerate}
        </pre>
      </div>

      {/* Passo 2 */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[var(--silver)]">
            {t("step2")}
          </span>
          <CopyButton value={curlPoll} />
        </div>
        <pre className="overflow-x-auto rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3.5 font-mono text-[13px] leading-relaxed text-[var(--silver)]">
          {curlPoll}
        </pre>
      </div>

      <a
        href="/api/docs"
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] py-2.5 text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)]"
      >
        <BookOpen className="h-4 w-4" />
        {t("fullDocs")}
        <ArrowUpRight className="h-4 w-4 text-[var(--ash)]" />
      </a>
    </section>
  );
}
