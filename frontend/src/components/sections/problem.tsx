"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { DollarSign, Clock, Bot } from "lucide-react";

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
      className="relative border-t border-[var(--border)] py-24 md:py-36"
    >
      <div className="mx-auto w-full max-w-[1400px] px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-16 flex items-center gap-3"
        >
          <span className="inline-block h-px w-10 bg-[var(--accent)]" />
          <span className="label-mono text-[var(--accent)]">{t("eyebrow")}</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="display-hero mb-20 text-[clamp(2.5rem,8vw,7rem)] text-[var(--fg)]"
        >
          {t("title")}{" "}
          <span className="text-[var(--accent)]">{t("titleAccent")}.</span>
        </motion.h2>

        <div className="grid grid-cols-1 gap-px bg-[var(--border)] md:grid-cols-3">
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
              className="group flex flex-col gap-6 bg-[var(--bg)] p-8 md:p-10"
            >
              <div className="flex items-center justify-between">
                <span className="label-mono text-[var(--muted-fg)]">
                  0{idx + 1} · {t(`items.${key}.tag`)}
                </span>
                <Icon className="size-5 text-[var(--muted-fg)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-snap)] group-hover:text-[var(--accent)]" />
              </div>
              <h3 className="font-sans text-2xl font-semibold leading-tight text-[var(--fg)] md:text-3xl">
                {t(`items.${key}.title`)}
              </h3>
              <p className="text-base leading-relaxed text-[var(--muted-fg)]">
                {t(`items.${key}.body`)}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
