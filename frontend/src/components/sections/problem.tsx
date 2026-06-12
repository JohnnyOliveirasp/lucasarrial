"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { DollarSign, Clock, Bot } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";

const ITEMS = [
  { key: "1", Icon: DollarSign },
  { key: "2", Icon: Clock },
  { key: "3", Icon: Bot },
] as const;

const EASE = [0.16, 1, 0.3, 1] as const;

export function Problem() {
  const t = useTranslations("problem");

  return (
    <section
      id="problema"
      className="relative border-t border-[var(--hairline)] py-24 md:py-32"
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-12 flex items-center gap-3"
        >
          <span className="inline-block h-px w-10 bg-[var(--hairline-bright)]" />
          <Eyebrow>{t("eyebrow")}</Eyebrow>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="display-hero mb-16 text-[clamp(2.25rem,6vw,4.5rem)] text-[var(--ink)]"
        >
          {t("title")} <span className="italic">{t("titleAccent")}.</span>
        </motion.h2>

        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--hairline-strong)] md:grid-cols-3">
          {ITEMS.map(({ key, Icon }, idx) => (
            <motion.article
              key={key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.5,
                ease: EASE,
                delay: 0.1 + idx * 0.08,
              }}
              className="group flex flex-col gap-6 bg-[var(--surface-card)] p-8 md:p-10"
            >
              <div className="flex items-center justify-between">
                <Eyebrow className="text-[var(--ash)]">
                  0{idx + 1} · {t(`items.${key}.tag`)}
                </Eyebrow>
                <Icon className="size-5 text-[var(--ash)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover:text-[var(--silver)]" />
              </div>
              <h3 className="font-sans text-2xl font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)] md:text-[28px]">
                {t(`items.${key}.title`)}
              </h3>
              <p className="text-[16px] leading-[1.6] text-[var(--mute)]">
                {t(`items.${key}.body`)}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
