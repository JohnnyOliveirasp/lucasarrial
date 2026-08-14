"use client";

/**
 * Peças de navegação da sidebar (extraídas 14/08: o sidebar.tsx passou de
 * 400 linhas, limite do projeto).
 */
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { ChevronDown, Lock, type LucideIcon } from "lucide-react";

/**
 * Menu expansível dentro da pré-produção. Mesma mecânica dos grupos públicos
 * (Vozes/Vídeos), em escala menor — a pré-produção já vive indentada.
 */
export function GrupoPre({
  label,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  label: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(defaultOpen);
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        aria-expanded={aberto}
        className="group flex w-full items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2 text-sm text-[var(--mute)] transition-[background-color,color] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-[var(--surface-card)] hover:text-[var(--ink)]"
      >
        <span className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-[var(--ash)] group-hover:text-[var(--silver)]" />
          <span className="font-medium">{label}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--ash)] transition-transform duration-[var(--dur-base)] ${
            aberto ? "rotate-180" : ""
          }`}
        />
      </button>
      {aberto && (
        <ul className="ml-[19px] mt-1 flex flex-col gap-1 border-l border-[var(--hairline)] pl-2">
          {children}
        </ul>
      )}
    </div>
  );
}

export function NavLeaf({
  href,
  icon: Icon,
  label,
  active,
  locked = false,
  lockTitle = "",
  bare = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  locked?: boolean;
  lockTitle?: string;
  /** `bare` = não envolve em <li> (já está num <li> próprio, ex.: Admin). */
  bare?: boolean;
}) {
  const link = (
    <Link
      href={locked ? "#" : href}
      aria-disabled={locked}
      tabIndex={locked ? -1 : undefined}
      onClick={locked ? (e) => e.preventDefault() : undefined}
      title={locked ? lockTitle : undefined}
      className={[
        "group flex items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm transition-[background-color,color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
        active
          ? "bg-[var(--surface-elevated)] text-[var(--ink)]"
          : "text-[var(--mute)] hover:bg-[var(--surface-card)] hover:text-[var(--ink)]",
        locked ? "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-[var(--mute)]" : "",
      ].join(" ")}
    >
      <span className="flex items-center gap-3">
        <Icon
          className={[
            "h-4 w-4",
            active ? "text-[var(--silver)]" : "text-[var(--ash)] group-hover:text-[var(--silver)]",
          ].join(" ")}
        />
        <span className="font-medium">{label}</span>
      </span>
      {locked && <Lock className="h-3.5 w-3.5 text-[var(--ash)]" />}
    </Link>
  );
  return bare ? link : <li>{link}</li>;
}
