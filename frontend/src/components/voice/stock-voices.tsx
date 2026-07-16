"use client";

/**
 * Catálogo "Vozes Prontas" — seção do Gerar Áudio.
 * Combo de idioma (Todos/PT/ES/EN) + card com PLAYER DE AMOSTRA (o aluno ouve
 * antes de escolher) e botão que leva pra geração daquela voz.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export type StockVoice = {
  id: string;
  name: string;
  language: string; // "pt" | "es" | "en"
  sample_url: string | null;
};

const LANGS = ["all", "pt", "es", "en"] as const;

export function StockVoices({ voices }: { voices: StockVoice[] }) {
  const t = useTranslations("app.voiceCloning");
  const [lang, setLang] = useState<(typeof LANGS)[number]>("all");

  const filtered = lang === "all" ? voices : voices.filter((v) => v.language === lang);
  const available = new Set(voices.map((v) => v.language));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            {t("stockTitle")}
          </h2>
          <p className="max-w-xl text-xs text-[var(--ash)]">{t("stockCredit")}</p>
        </div>
        {/* Combo de idioma — só mostra opções que existem no catálogo */}
        <div className="flex gap-1.5">
          {LANGS.filter((l) => l === "all" || available.has(l)).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={[
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                lang === l
                  ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)] text-[var(--ink)]"
                  : "border-[var(--hairline)] text-[var(--mute)] hover:text-[var(--ink)]",
              ].join(" ")}
            >
              {t(`stockLang.${l}`)}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filtered.map((v) => (
          <li
            key={v.id}
            className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-5 py-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-sans text-base font-medium leading-tight text-[var(--ink)]">
                {v.name}
              </span>
              <span className="rounded-full border border-[var(--hairline)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--mute)]">
                {v.language}
              </span>
            </div>
            {v.sample_url ? (
              <audio
                src={v.sample_url}
                controls
                controlsList="nodownload"
                preload="none"
                className="h-9 w-full"
              />
            ) : (
              <p className="text-xs text-[var(--ash)]">{t("stockNoSample")}</p>
            )}
            <Link
              href={`/app/voice-cloning/${v.id}/generate`}
              className="inline-flex h-9 w-fit items-center gap-1.5 rounded-[var(--radius)] bg-[var(--pill-bg)] px-4 font-sans text-[13px] font-medium text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
            >
              {t("pickVoiceCta")}
              <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
