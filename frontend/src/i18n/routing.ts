import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pt-BR", "en", "es"] as const,
  defaultLocale: "pt-BR",
  localePrefix: "as-needed",
  // Não auto-redirecionar por Accept-Language: a raiz "/" sempre serve pt-BR.
  // O usuário troca de idioma manualmente (links /en, /es).
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
