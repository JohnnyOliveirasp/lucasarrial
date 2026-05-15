"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const t = useTranslations("themeToggle");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <button
      type="button"
      suppressHydrationWarning
      aria-label={isDark ? t("toLight") : t("toDark")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-11 w-11 items-center justify-center border border-[var(--border)] text-[var(--fg)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-snap)] hover:bg-[var(--accent)] hover:text-[var(--accent-fg)] hover:border-[var(--accent)] md:h-9 md:w-9"
    >
      <span suppressHydrationWarning>
        {mounted ? (
          isDark ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )
        ) : (
          <Sun className="size-4" />
        )}
      </span>
    </button>
  );
}
