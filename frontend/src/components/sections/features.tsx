"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Fingerprint, Zap, Globe, Unlock } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";

const EASE = [0.16, 1, 0.3, 1] as const;

const ITEMS = [
  { key: "1", Icon: Fingerprint, span: "md:col-span-2", glow: "var(--glow-violet)" },
  { key: "2", Icon: Zap, span: "md:col-span-1", glow: "var(--glow-blue)" },
  { key: "3", Icon: Globe, span: "md:col-span-1", glow: "var(--glow-green)" },
  { key: "4", Icon: Unlock, span: "md:col-span-2", glow: "var(--glow-amber)" },
] as const;

export function Features() {
  const t = useTranslations("features");

  return (
    <section
      id="features"
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
          className="display-hero mb-14 text-[clamp(2.25rem,6vw,4.5rem)] text-[var(--ink)]"
        >
          {t("title")}
        </motion.h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {ITEMS.map(({ key, Icon, span, glow }, idx) => (
            <motion.article
              key={key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.5,
                ease: EASE,
                delay: 0.1 + idx * 0.08,
              }}
              className={`group relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-8 transition-[border-color] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] md:p-10 ${span}`}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse 100% 60% at 30% 0%, ${glow}, transparent 65%)`,
                }}
              />
              <Icon className="relative size-7 text-[var(--silver)]" />
              <div className="relative mt-6">
                <Eyebrow className="text-[var(--ash)]">
                  {t(`items.${key}.tag`)}
                </Eyebrow>
                <h3 className="mt-3 font-sans text-2xl font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)] md:text-[28px]">
                  {t(`items.${key}.title`)}
                </h3>
                <p className="mt-3 text-[16px] leading-[1.6] text-[var(--mute)]">
                  {t(`items.${key}.body`)}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
