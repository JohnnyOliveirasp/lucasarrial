"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Languages } from "lucide-react";

const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "PT",
  en: "EN",
  es: "ES",
};

export function LanguageToggle() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("languageToggle");

  const handleChange = (next: Locale) => {
    router.replace(pathname, { locale: next });
  };

  return (
    <div className="relative">
      <details className="group">
        <summary
          aria-label={t("label")}
          className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-3 text-[var(--ink)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] md:h-9 [&::-webkit-details-marker]:hidden"
        >
          <Languages className="size-4 text-[var(--silver)]" />
          <span className="label-mono">{LOCALE_LABELS[locale]}</span>
        </summary>
        <div
          className="absolute right-0 z-50 mt-1.5 flex w-[140px] flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-raised)] p-1"
          style={{ boxShadow: "var(--elevation-popover)" }}
        >
          {routing.locales.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleChange(option)}
              className={`flex min-h-10 items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-left text-xs transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] ${
                option === locale
                  ? "bg-[var(--surface-elevated)] text-[var(--ink)]"
                  : "text-[var(--body)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
              }`}
            >
              <span className="label-mono">{LOCALE_LABELS[option]}</span>
              <span className="text-[10px] text-[var(--ash)]">
                {t(option)}
              </span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
