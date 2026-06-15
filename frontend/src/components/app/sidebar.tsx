"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Mic2,
  Mic,
  History,
  Settings,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";

type NavItem = {
  href: string;
  icon: LucideIcon;
  key: "dashboard" | "voiceCloning" | "record" | "history" | "settings";
  soon?: boolean;
  /** Requer saldo p/ treinar uma voz (TRAINING_CREDIT_COST). Trava se faltar. */
  needsTraining?: boolean;
  /** Requer assinatura ativa (faz parte do pacote pago). Trava se não assinou. */
  needsSubscription?: boolean;
};

const NAV: NavItem[] = [
  { href: "/app/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/app/voice-cloning", icon: Mic2, key: "voiceCloning" },
  { href: "/app/voice-cloning/script", icon: Mic, key: "record", needsTraining: true },
  { href: "/app/history", icon: History, key: "history" },
  { href: "/app/settings", icon: Settings, key: "settings", needsSubscription: true },
];

type Props = {
  /** Saldo total de créditos do usuário (plano + avulsos). */
  creditsTotal: number;
  /** Equipe/admin: ilimitado, nunca trava. */
  unlimited: boolean;
  /** Assinatura ativa? Libera itens que fazem parte do pacote pago (API). */
  subscribed: boolean;
};

export function Sidebar({ creditsTotal, unlimited, subscribed }: Props) {
  const t = useTranslations("app");
  const pathname = usePathname();

  return (
    <aside className="hidden border-r border-[var(--hairline)] bg-[var(--surface-deep)] lg:flex lg:flex-col">
      <div className="border-b border-[var(--hairline)] px-5 py-5">
        <Link href="/app/dashboard" className="flex items-center gap-2.5">
          <span className="inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)]">
            <Image
              src="/brand/fastpost-glyph.png"
              alt=""
              width={16}
              height={16}
              className="size-4"
            />
          </span>
          <span className="font-sans text-[15px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
            FastCloner
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ href, icon: Icon, key, soon, needsTraining, needsSubscription }) => {
            const active = pathname.endsWith(href);
            // Equipe nunca trava. "Gravar voz" trava sem saldo p/ treinar;
            // "Configurações" (API) trava sem assinatura ativa.
            const lockedTraining =
              !!needsTraining && !unlimited && creditsTotal < TRAINING_CREDIT_COST;
            const lockedSub = !!needsSubscription && !unlimited && !subscribed;
            const locked = lockedTraining || lockedSub;
            const lockTitle = lockedSub
              ? "Assine o plano para liberar a API."
              : `Você precisa de ${TRAINING_CREDIT_COST.toLocaleString("pt-BR")} créditos para treinar uma voz.`;
            const disabled = soon || locked;
            return (
              <li key={href}>
                <Link
                  href={disabled ? "#" : href}
                  aria-disabled={disabled}
                  tabIndex={disabled ? -1 : undefined}
                  onClick={disabled ? (e) => e.preventDefault() : undefined}
                  title={locked ? lockTitle : undefined}
                  className={[
                    "group flex items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm transition-[background-color,color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
                    active
                      ? "bg-[var(--surface-elevated)] text-[var(--ink)]"
                      : "text-[var(--mute)] hover:bg-[var(--surface-card)] hover:text-[var(--ink)]",
                    disabled
                      ? "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-[var(--mute)]"
                      : "",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className={[
                        "h-4 w-4",
                        active ? "text-[var(--silver)]" : "text-[var(--ash)] group-hover:text-[var(--silver)]",
                      ].join(" ")}
                    />
                    <span className="font-medium">{t(`nav.${key}`)}</span>
                  </span>
                  {soon && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ash)]">
                      {t("comingSoon")}
                    </span>
                  )}
                  {locked && !soon && (
                    <Lock className="h-3.5 w-3.5 text-[var(--ash)]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[var(--hairline)] px-5 py-4">
        <p className="font-mono text-[10px] tracking-[0.04em] text-[var(--ash)]">
          v0.1 · dev
        </p>
      </div>
    </aside>
  );
}
