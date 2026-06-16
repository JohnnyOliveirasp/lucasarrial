"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";

const NAV = [
  { href: "/admin", label: "Visão geral", exact: true },
  { href: "/admin/usuarios", label: "Usuários", exact: false },
  { href: "/admin/campanhas", label: "Campanhas", exact: false },
  { href: "/admin/historico", label: "Históricos", exact: false },
  { href: "/admin/admins", label: "Admins", exact: false },
] as const;

/**
 * Topbar do painel /admin. Marca + navegação + atalho de volta ao app.
 * Estilo: mesmo design system dark do FastCloner (hairlines, DM Sans).
 */
export function AdminTopbar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hairline)] bg-[var(--canvas)]/[0.78] backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-6 md:px-10">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)]">
              <Image src="/brand/fastcloner-glyph.png" alt="" width={16} height={16} className="size-4" priority />
            </span>
            <span className="font-sans text-[15px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
              FastCloner
            </span>
            <span className="rounded-[var(--radius-full)] border border-[var(--hairline-strong)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--silver)]">
              Admin
            </span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-[var(--radius)] px-3 py-1.5 text-[13px] font-medium tracking-[-0.01em] transition-colors ${
                    active
                      ? "bg-[var(--surface-elevated)] text-[var(--ink)]"
                      : "text-[var(--mute)] hover:text-[var(--ink)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-[11px] text-[var(--ash)] sm:inline">
            {email}
          </span>
          <Link
            href="/app/dashboard"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
          >
            Voltar ao app
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
