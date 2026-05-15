"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  AudioLines,
  Video,
  PencilLine,
  Image as ImageIcon,
  FileText,
  Languages,
} from "lucide-react";

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
      className="relative border-t border-[var(--border)] py-24 md:py-36"
    >
      <div className="mx-auto w-full max-w-[1400px] px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-10 flex items-center gap-3"
        >
          <span className="inline-block h-px w-10 bg-[var(--accent)]" />
          <span className="label-mono text-[var(--accent)]">{t("eyebrow")}</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="display-hero text-[clamp(2.5rem,8vw,7rem)] text-[var(--fg)]"
        >
          {t("title")}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
          className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--muted-fg)] md:text-lg"
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
      className="mt-16 overflow-hidden border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
    >
      {/* Window chrome */}
      <div className="flex h-9 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4">
        <span className="size-2.5 rounded-full bg-[var(--muted-fg)]/30" />
        <span className="size-2.5 rounded-full bg-[var(--muted-fg)]/30" />
        <span className="size-2.5 rounded-full bg-[var(--muted-fg)]/30" />
        <span className="label-mono ml-3 text-[var(--muted-fg)]">
          lucasarrial.com.br/app
        </span>
      </div>

      <div className="grid grid-cols-[180px_1fr] md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="border-r border-[var(--border)] bg-[var(--surface)] p-4 md:p-6">
          <div className="mb-6 font-display text-lg uppercase leading-none">
            Lucas<span className="text-[var(--accent)]">.</span>
          </div>
          <div className="label-mono mb-3 text-[var(--muted-fg)]">
            {t("sidebar.header")}
          </div>
          <ul className="space-y-1">
            {TOOLS.map(({ key, Icon, active }) => (
              <li key={key}>
                <div
                  className={`flex items-center gap-2.5 px-2 py-2 text-xs ${
                    active
                      ? "bg-[var(--accent)] text-[var(--accent-fg)] font-semibold"
                      : "text-[var(--muted-fg)]"
                  }`}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{t(`tools.${key}`)}</span>
                  {!active && (
                    <span className="ml-auto hidden text-[9px] uppercase opacity-60 md:inline">
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
              className={`relative flex aspect-[4/3] flex-col justify-between border p-3 md:p-4 ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--border)] bg-[var(--bg)]"
              }`}
            >
              <Icon
                className={`size-5 ${
                  active ? "text-[var(--accent)]" : "text-[var(--muted-fg)]"
                }`}
              />
              <div className="space-y-1">
                <div className="font-sans text-xs font-semibold leading-tight text-[var(--fg)] md:text-sm">
                  {t(`tools.${key}`)}
                </div>
                <div className="label-mono text-[10px] text-[var(--muted-fg)]">
                  {active ? t("sidebar.active") : t("sidebar.soon")}
                </div>
              </div>
              {active && (
                <span className="absolute right-2 top-2 size-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
