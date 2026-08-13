"use client";

import { useState } from "react";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
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
  PenLine,
  Video,
  Clapperboard,
  ShoppingBag,
  UserSquare2,
  Wand2,
  MonitorPlay,
  Send,
  Camera,
  Music2,
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
  const tShell = useTranslations("shell.sidebar");
  const pathname = usePathname();
  const inVoices =
    pathname.includes("/app/voice-cloning") || pathname.endsWith("/app/history");
  const [voicesOpen, setVoicesOpen] = useState(false);
  const showVoices = voicesOpen || inVoices;
  const inVideos = pathname.includes("/app/videos");
  const [videosOpen, setVideosOpen] = useState(false);
  const showVideos = videosOpen || inVideos;
  const inPublisher = pathname.includes("/app/lab/publicador");
  const [publisherOpen, setPublisherOpen] = useState(false);
  const showPublisher = publisherOpen || inPublisher;

  const lockTrainingTitle = tShell("lockTraining", {
    n: TRAINING_CREDIT_COST.toLocaleString("pt-BR"),
  });

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
      lockTitle: tShell("lockGenerateAudio"),
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

          {/* Gerador de Roteiros — graduado 13/08 (ordem Johnny): porta de
              entrada do funil (roteiro → áudio → vídeo), logo abaixo do
              Dashboard. */}
          <NavLeaf
            href="/app/roteiro"
            icon={PenLine}
            label={t("nav.script")}
            active={pathname.endsWith("/app/roteiro")}
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
            lockTitle={tShell("lockApi")}
          />

          {isAdmin && (
            <li className="mt-2 border-t border-[var(--hairline)] pt-2">
              {/* Área de PRÉ-PRODUÇÃO: produtos novos em validação, só admin vê.
                  Validou → o item migra pro grupo público (Vídeos etc.). */}
              <span className="block px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ash)]">
                {tShell("preProduction")}
              </span>
              <ul className="flex flex-col gap-1">
                {/* 🚧 Vídeo Edição 2.0 — wizard central (spec 11/08): roteiro →
                    áudio → vídeo base → edição → publicar. Fases W0-W6; Lucas
                    valida → vira O produto e reorganiza o menu de vídeos. */}
                <NavLeaf
                  href="/app/videos/edicao"
                  icon={Clapperboard}
                  label={t("nav.videoEdicao")}
                  active={pathname.endsWith("/app/videos/edicao")}
                />
                {/* F0 unificação: a ENTRADA é o wizard de 2 perguntas
                    (/app/videos/estudio); o workspace antigo (/studio) segue
                    acessível como destino interno do wizard. */}
                <NavLeaf
                  href="/app/videos/estudio"
                  icon={Wand2}
                  label={t("nav.videoStudio")}
                  active={
                    pathname.endsWith("/app/videos/estudio") ||
                    pathname.endsWith("/app/videos/studio")
                  }
                />
                {/* Gravador Celular GRADUOU (03/08): virou a seção "Ou grave
                    pelo celular" do Gravador oficial — saiu do menu 05/08
                    (pedido Johnny). A página /app/lab/gravador-celular segue
                    acessível por URL se precisar depurar. */}
                {/* 🧪 Padrão 2.0 GRADUOU (08/08): virou o tier Padrão público
                    do Vídeo Clone (V1 aposentado, Turbo 80 cr/s). */}
                {/* 🧪 Vídeo HeyGen BYOK (teste 05/08): aluno conecta a própria
                    API key; Lucas valida → gradua pro grupo Vídeos. */}
                <NavLeaf
                  href="/app/lab/video-heygen"
                  icon={MonitorPlay}
                  label="Vídeo HeyGen"
                  active={pathname.endsWith("/app/lab/video-heygen")}
                />
                {/* 🧪 Publicador ("nosso Blotato", 05/08): grupo expansível
                    com um submenu por rede (pedido Johnny 12/08). */}
                <li>
                  <button
                    type="button"
                    onClick={() => setPublisherOpen((o) => !o)}
                    aria-expanded={showPublisher}
                    className={[
                      "group flex w-full items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm transition-[background-color,color] duration-[var(--dur-base)] ease-[var(--ease-out)]",
                      inPublisher
                        ? "text-[var(--ink)]"
                        : "text-[var(--mute)] hover:bg-[var(--surface-card)] hover:text-[var(--ink)]",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-3">
                      <Send
                        className={[
                          "h-4 w-4",
                          inPublisher ? "text-[var(--silver)]" : "text-[var(--ash)] group-hover:text-[var(--silver)]",
                        ].join(" ")}
                      />
                      <span className="font-medium">{tShell("publisher")}</span>
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-[var(--ash)] transition-transform duration-[var(--dur-base)] ${
                        showPublisher ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {showPublisher && (
                    <ul className="ml-[19px] mt-1 flex flex-col gap-1 border-l border-[var(--hairline)] pl-2">
                      <NavLeaf
                        href="/app/lab/publicador"
                        icon={Camera}
                        label="Instagram"
                        active={pathname.endsWith("/app/lab/publicador")}
                      />
                      <NavLeaf
                        href="/app/lab/publicador/tiktok"
                        icon={Music2}
                        label="TikTok"
                        active={pathname.endsWith("/app/lab/publicador/tiktok")}
                      />
                    </ul>
                  )}
                </li>
              </ul>
              <div className="mt-2 border-t border-[var(--hairline)] pt-2">
                <NavLeaf
                  href="/admin"
                  icon={ShieldCheck}
                  label={tShell("admin")}
                  active={pathname.includes("/admin")}
                  bare
                />
              </div>
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
