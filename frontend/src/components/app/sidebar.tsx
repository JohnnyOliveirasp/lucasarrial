"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Mic2,
  Mic,
  AudioLines,
  History,
  Settings,
  Lock,
  ShieldCheck,
  ChevronDown,
  Images,
  Video,
  Clapperboard,
  ShoppingBag,
  UserSquare2,
  type LucideIcon,
} from "lucide-react";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";

type Props = {
  /** Saldo total de créditos do usuário (plano + avulsos). */
  creditsTotal: number;
  /** Equipe/admin: ilimitado, nunca trava. */
  unlimited: boolean;
  /** Assinatura ativa? Libera itens que fazem parte do pacote pago (API). */
  subscribed: boolean;
  /** É admin (allowlist)? Mostra o atalho pro painel /admin. */
  isAdmin: boolean;
  /** Tem ≥1 voz pronta? Libera "Gerar Áudio". */
  hasReadyVoice: boolean;
};

export function Sidebar({
  creditsTotal,
  unlimited,
  subscribed,
  isAdmin,
  hasReadyVoice,
}: Props) {
  const t = useTranslations("app");
  const pathname = usePathname();
  const inVoices =
    pathname.includes("/app/voice-cloning") || pathname.endsWith("/app/history");
  const [voicesOpen, setVoicesOpen] = useState(false);
  const showVoices = voicesOpen || inVoices;
  const inVideos = pathname.includes("/app/videos");
  const [videosOpen, setVideosOpen] = useState(false);
  const showVideos = videosOpen || inVideos;

  const lockTrainingTitle = `Você precisa de ${TRAINING_CREDIT_COST.toLocaleString("pt-BR")} créditos para treinar uma voz.`;

  // Sub-itens de "Vozes". Travas iguais às de antes: Gerar Voz livre, Gravador
  // pede crédito p/ treinar; Gerar Áudio (novo) pede voz pronta.
  const voiceChildren = [
    {
      href: "/app/voice-cloning",
      icon: Mic2,
      label: t("nav.generateVoice"),
      locked: false,
      lockTitle: "",
    },
    {
      href: "/app/voice-cloning/generate",
      icon: AudioLines,
      label: t("nav.generateAudio"),
      locked: !unlimited && !hasReadyVoice,
      lockTitle: "Treine uma voz primeiro para gerar áudio.",
    },
    {
      href: "/app/voice-cloning/script",
      icon: Mic,
      label: t("nav.recorder"),
      locked: !unlimited && creditsTotal < TRAINING_CREDIT_COST,
      lockTitle: lockTrainingTitle,
    },
    {
      href: "/app/history",
      icon: History,
      label: t("nav.history"),
      locked: false,
      lockTitle: "",
    },
  ];

  // Sub-itens de "Vídeos". Entrada livre — o gate de créditos acontece dentro
  // do wizard, nos estágios pagos.
  const videoChildren = [
    {
      href: "/app/videos/history",
      icon: Clapperboard,
      label: t("nav.videoHistory"),
      locked: false,
      lockTitle: "",
    },
    {
      href: "/app/videos/vendas",
      icon: ShoppingBag,
      label: t("nav.videoSales"),
      locked: false,
      lockTitle: "",
    },
    {
      href: "/app/videos/clone",
      icon: UserSquare2,
      label: t("nav.videoClone"),
      locked: false,
      lockTitle: "",
    },
  ];

  return (
    <aside className="hidden border-r border-[var(--hairline)] bg-[var(--surface-deep)] lg:flex lg:flex-col">
      <div className="border-b border-[var(--hairline)] px-5 py-5">
        <Link href="/app/dashboard" className="flex items-center gap-2.5">
          <span className="inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)]">
            <Image src="/brand/fastcloner-glyph.png" alt="" width={16} height={16} className="size-4" />
          </span>
          <span className="font-sans text-[15px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
            FastCloner
          </span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          <NavLeaf
            href="/app/dashboard"
            icon={LayoutDashboard}
            label={t("nav.dashboard")}
            active={pathname.endsWith("/app/dashboard")}
          />

          {/* Grupo Vozes (expansível) */}
          <li>
            <button
              type="button"
              onClick={() => setVoicesOpen((o) => !o)}
              aria-expanded={showVoices}
              className={[
                "group flex w-full items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm transition-[background-color,color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
                inVoices
                  ? "text-[var(--ink)]"
                  : "text-[var(--mute)] hover:bg-[var(--surface-card)] hover:text-[var(--ink)]",
              ].join(" ")}
            >
              <span className="flex items-center gap-3">
                <Mic2
                  className={[
                    "h-4 w-4",
                    inVoices ? "text-[var(--silver)]" : "text-[var(--ash)] group-hover:text-[var(--silver)]",
                  ].join(" ")}
                />
                <span className="font-medium">{t("nav.voices")}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[var(--ash)] transition-transform duration-[var(--dur-base)] ${
                  showVoices ? "rotate-180" : ""
                }`}
              />
            </button>

            {showVoices && (
              <ul className="ml-[19px] mt-1 flex flex-col gap-1 border-l border-[var(--hairline)] pl-2">
                {voiceChildren.map((c) => (
                  <NavLeaf
                    key={c.href}
                    href={c.href}
                    icon={c.icon}
                    label={c.label}
                    active={pathname.endsWith(c.href)}
                    locked={c.locked}
                    lockTitle={c.lockTitle}
                  />
                ))}
              </ul>
            )}
          </li>

          <NavLeaf
            href="/app/images"
            icon={Images}
            label={t("nav.images")}
            active={pathname.endsWith("/app/images")}
          />

          {/* Grupo Vídeos (expansível) */}
          <li>
            <button
              type="button"
              onClick={() => setVideosOpen((o) => !o)}
              aria-expanded={showVideos}
              className={[
                "group flex w-full items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm transition-[background-color,color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
                inVideos
                  ? "text-[var(--ink)]"
                  : "text-[var(--mute)] hover:bg-[var(--surface-card)] hover:text-[var(--ink)]",
              ].join(" ")}
            >
              <span className="flex items-center gap-3">
                <Video
                  className={[
                    "h-4 w-4",
                    inVideos ? "text-[var(--silver)]" : "text-[var(--ash)] group-hover:text-[var(--silver)]",
                  ].join(" ")}
                />
                <span className="font-medium">{t("nav.videos")}</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-[var(--ash)] transition-transform duration-[var(--dur-base)] ${
                  showVideos ? "rotate-180" : ""
                }`}
              />
            </button>

            {showVideos && (
              <ul className="ml-[19px] mt-1 flex flex-col gap-1 border-l border-[var(--hairline)] pl-2">
                {videoChildren.map((c) => (
                  <NavLeaf
                    key={c.href}
                    href={c.href}
                    icon={c.icon}
                    label={c.label}
                    active={pathname.endsWith(c.href)}
                    locked={c.locked}
                    lockTitle={c.lockTitle}
                  />
                ))}
              </ul>
            )}
          </li>

          <NavLeaf
            href="/app/settings"
            icon={Settings}
            label={t("nav.settings")}
            active={pathname.endsWith("/app/settings")}
            locked={!unlimited && !subscribed}
            lockTitle="Assine o plano para liberar a API."
          />

          {isAdmin && (
            <li className="mt-2 border-t border-[var(--hairline)] pt-2">
              <NavLeaf
                href="/admin"
                icon={ShieldCheck}
                label="Admin"
                active={pathname.includes("/admin")}
                bare
              />
            </li>
          )}
        </ul>
      </nav>

      <div className="border-t border-[var(--hairline)] px-5 py-4">
        <p className="font-mono text-[10px] tracking-[0.04em] text-[var(--ash)]">v0.1 · dev</p>
      </div>
    </aside>
  );
}

function NavLeaf({
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
