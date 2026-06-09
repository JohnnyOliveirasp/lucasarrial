"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut, ChevronDown, Coins, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  creditsTotal: number;
  unlimited: boolean;
};

export function Topbar({ email, displayName, avatarUrl, creditsTotal, unlimited }: Props) {
  const t = useTranslations("app");
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

  const initial = (displayName ?? email).slice(0, 1).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-bg px-6 lg:px-12">
      <Link
        href="/app/credits"
        className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-fg transition-colors hover:text-accent"
        title="Ver e comprar créditos"
      >
        <Coins className="h-4 w-4 text-accent" />
        {unlimited ? (
          <span>Créditos: ∞</span>
        ) : (
          <span>
            <span className="text-fg">{creditsTotal.toLocaleString("pt-BR")}</span> créditos
          </span>
        )}
      </Link>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 px-3 py-2 text-sm text-fg transition-colors hover:bg-surface"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar de OAuth provider externo (Google), domains não pré-configurado
            <img src={avatarUrl} alt="" className="h-8 w-8 object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center bg-accent font-mono text-xs font-bold text-accent-fg">
              {initial}
            </div>
          )}
          <div className="hidden min-w-0 flex-col items-start sm:flex">
            <span className="max-w-[180px] truncate text-sm font-medium leading-tight">
              {displayName ?? email.split("@")[0]}
            </span>
            <span className="max-w-[180px] truncate font-mono text-[10px] lowercase text-muted-fg">
              {email}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-fg" />
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 border border-border bg-bg shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
            <Link
              href="/app/account"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-fg transition-colors hover:bg-surface hover:text-accent"
            >
              <UserCircle className="h-4 w-4" />
              <span>Minha conta</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-sm text-fg transition-colors hover:bg-surface hover:text-accent"
            >
              <LogOut className="h-4 w-4" />
              <span>{t("logout")}</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
