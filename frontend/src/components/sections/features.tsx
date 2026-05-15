"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Fingerprint, Zap, Globe, Unlock } from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;

const ITEMS = [
  { key: "1", Icon: Fingerprint, span: "md:col-span-2" },
  { key: "2", Icon: Zap, span: "md:col-span-1" },
  { key: "3", Icon: Globe, span: "md:col-span-1" },
  { key: "4", Icon: Unlock, span: "md:col-span-2" },
] as const;

export function Features() {
  const t = useTranslations("features");

  return (
    <section
      id="features"
      className="relative border-t border-[var(--border)] bg-[var(--surface)] py-24 md:py-36"
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
          className="display-hero mb-16 text-[clamp(2.5rem,8vw,7rem)] text-[var(--fg)]"
        >
          {t("title")}
        </motion.h2>

        <div className="grid grid-cols-1 gap-px bg-[var(--border)] md:grid-cols-3">
          {ITEMS.map(({ key, Icon, span }, idx) => (
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
              className={`group flex min-h-[280px] flex-col justify-between bg-[var(--bg)] p-8 md:p-10 ${span}`}
            >
              <Icon className="size-7 text-[var(--accent)]" />
              <div className="mt-6">
                <span className="label-mono text-[var(--muted-fg)]">
                  {t(`items.${key}.tag`)}
                </span>
                <h3 className="mt-3 font-sans text-2xl font-semibold leading-tight text-[var(--fg)] md:text-3xl">
                  {t(`items.${key}.title`)}
                </h3>
                <p className="mt-3 text-base leading-relaxed text-[var(--muted-fg)]">
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
