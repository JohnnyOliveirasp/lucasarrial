"use client";

import Link from "next/link";
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
    <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col">
      <div className="border-b border-border px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 bg-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg">
            {t("brand")}
          </span>
        </div>
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
                    "group flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)]",
                    active
                      ? "bg-fg text-bg"
                      : "text-muted-fg hover:bg-bg hover:text-fg",
                    disabled ? "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-fg" : "",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{t(`nav.${key}`)}</span>
                  </span>
                  {soon && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-fg">
                      {t("comingSoon")}
                    </span>
                  )}
                  {locked && !soon && (
                    <Lock className="h-3.5 w-3.5 text-muted-fg" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-6 py-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-fg">
          v0.1 · dev
        </p>
      </div>
    </aside>
  );
}
