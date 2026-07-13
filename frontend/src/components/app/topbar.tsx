"use client";

import { useState, useRef, useEffect } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { LogOut, ChevronDown, Coins, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";
import { LanguageToggle } from "@/components/language-toggle";

type Props = {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  creditsTotal: number;
  unlimited: boolean;
};

export function Topbar({ email, displayName, avatarUrl, creditsTotal, unlimited }: Props) {
  const t = useTranslations("app");
  const tShell = useTranslations("shell.topbar");
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const accountName = displayName ?? email.split("@")[0];

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--hairline)] bg-[var(--canvas)] px-6 lg:px-12">
      <Link
        href="/app/credits"
        className="group flex items-center gap-2 font-mono text-[12px] tracking-[-0.01em] text-[var(--mute)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:text-[var(--ink)]"
        title={tShell("creditsTitle")}
      >
        <Coins className="h-4 w-4 text-[var(--silver)] transition-colors group-hover:text-[var(--ink)]" />
        {unlimited ? (
          <span>{tShell("creditsUnlimited")}</span>
        ) : (
          <span>
            <span className="text-[var(--ink)]">{creditsTotal.toLocaleString("pt-BR")}</span>{" "}
            {tShell("credits")}
          </span>
        )}
      </Link>
      <div className="flex items-center gap-3">
        <LanguageToggle />
        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-3 rounded-[var(--radius)] px-2 py-1.5 text-sm text-[var(--ink)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-elevated)]"
          >
            <Avatar
              size={32}
              name={accountName}
              src={avatarUrl ?? undefined}
            />
            <div className="hidden min-w-0 flex-col items-start sm:flex">
              <span className="max-w-[180px] truncate text-sm font-medium leading-tight text-[var(--ink)]">
                {accountName}
              </span>
              <span className="max-w-[180px] truncate font-mono text-[10px] lowercase text-[var(--ash)]">
                {email}
              </span>
            </div>
            <ChevronDown
              className={[
                "h-4 w-4 text-[var(--ash)] transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)]",
                open ? "rotate-180" : "",
              ].join(" ")}
            />
          </button>

          {open && (
            <div
              className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-raised)] p-1"
              style={{ boxShadow: "var(--elevation-popover)" }}
            >
              <Link
                href="/app/account"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm text-[var(--body)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
              >
                <UserCircle className="h-4 w-4 text-[var(--ash)]" />
                <span>{tShell("myAccount")}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-1 flex w-full items-center gap-3 rounded-[var(--radius-sm)] border-t border-[var(--hairline)] px-3 py-2.5 text-sm text-[var(--body)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
              >
                <LogOut className="h-4 w-4 text-[var(--ash)]" />
                <span>{t("logout")}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
