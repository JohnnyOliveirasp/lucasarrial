"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  AudioLines,
  Video,
  PencilLine,
  Image as ImageIcon,
  FileText,
  Languages,
} from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";

const EASE = [0.16, 1, 0.3, 1] as const;

const TOOLS = [
  { key: "voice", Icon: AudioLines, active: true },
  { key: "video", Icon: Video, active: false },
  { key: "writing", Icon: PencilLine, active: false },
  { key: "image", Icon: ImageIcon, active: false },
  { key: "transcribe", Icon: FileText, active: false },
  { key: "translate", Icon: Languages, active: false },
] as const;

export function PlatformPreview() {
  const t = useTranslations("platform");

  return (
    <section
      id="plataforma"
      className="relative border-t border-[var(--hairline)] py-24 md:py-32"
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-10 flex items-center gap-3"
        >
          <span className="inline-block h-px w-10 bg-[var(--hairline-bright)]" />
          <Eyebrow>{t("eyebrow")}</Eyebrow>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="display-hero text-[clamp(2.25rem,6vw,4.5rem)] text-[var(--ink)]"
        >
          {t("title")}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
          className="mt-6 max-w-2xl text-[16px] leading-[1.6] text-[var(--mute)] md:text-[18px]"
        >
          {t("subtitle")}
        </motion.p>

        <DashboardMock />
      </div>
    </section>
  );
}

function DashboardMock() {
  const t = useTranslations("platform");

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
      className="mt-16 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)]"
    >
      {/* Window chrome */}
      <div className="flex h-9 items-center gap-2 border-b border-[var(--hairline)] bg-[var(--surface-deep)] px-4">
        <span className="size-2.5 rounded-full bg-[var(--hairline-bright)]" />
        <span className="size-2.5 rounded-full bg-[var(--hairline-strong)]" />
        <span className="size-2.5 rounded-full bg-[var(--hairline-strong)]" />
        <span className="ml-3 font-mono text-[11px] text-[var(--ash)]">
          fastpost.app
        </span>
      </div>

      <div className="grid grid-cols-[180px_1fr] md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="border-r border-[var(--hairline)] bg-[var(--surface-deep)] p-4 md:p-6">
          <div className="mb-6 flex items-center gap-2">
            <span className="inline-flex size-6 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)]">
              <Image
                src="/brand/fastpost-glyph.png"
                alt=""
                width={14}
                height={14}
                className="size-3.5"
              />
            </span>
            <span className="font-sans text-[15px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
              FastPost
            </span>
          </div>
          <Eyebrow className="mb-3 block text-[var(--ash)]">
            {t("sidebar.header")}
          </Eyebrow>
          <ul className="space-y-1">
            {TOOLS.map(({ key, Icon, active }) => (
              <li key={key}>
                <div
                  className={`flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 text-xs ${
                    active
                      ? "bg-[var(--surface-elevated)] font-medium text-[var(--ink)]"
                      : "text-[var(--mute)]"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{t(`tools.${key}`)}</span>
                  {!active && (
                    <span className="ml-auto hidden text-[9px] uppercase tracking-[0.12em] text-[var(--ash)] md:inline">
                      {t("sidebar.soon")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main area */}
        <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 md:gap-5 md:p-8">
          {TOOLS.map(({ key, Icon, active }, idx) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.4,
                ease: EASE,
                delay: 0.35 + idx * 0.05,
              }}
              className={`relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-[var(--radius)] border p-3 md:p-4 ${
                active
                  ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)]"
                  : "border-[var(--hairline-strong)] bg-[var(--surface-card)]"
              }`}
            >
              {active && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(ellipse 120% 70% at 50% 0%, var(--glow-violet), transparent 70%)",
                  }}
                />
              )}
              <Icon
                className={`relative size-5 ${
                  active ? "text-[var(--silver)]" : "text-[var(--ash)]"
                }`}
              />
              <div className="relative space-y-1">
                <div className="font-sans text-xs font-semibold leading-tight text-[var(--ink)] md:text-sm">
                  {t(`tools.${key}`)}
                </div>
                <div className="font-mono text-[10px] text-[var(--ash)]">
                  {active ? t("sidebar.active") : t("sidebar.soon")}
                </div>
              </div>
              {active && (
                <span className="absolute right-2 top-2 size-1.5 animate-pulse rounded-full bg-[var(--status-online)]" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
