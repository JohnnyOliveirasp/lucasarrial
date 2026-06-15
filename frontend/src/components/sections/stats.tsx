"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Card, Stat, Eyebrow, type CardGlow } from "@/components/ui";

const EASE = [0.16, 1, 0.3, 1] as const;

const ITEMS: { glow: CardGlow; key: string }[] = [
  { glow: "voice", key: "1" },
  { glow: "face", key: "2" },
  { glow: "edit", key: "3" },
  { glow: "stats", key: "4" },
];

/** Stats band — prova social. 4 stat cards, cada um com seu glow. */
export function Stats() {
  const t = useTranslations("stats");

  return (
    <section id="casos" className="border-b border-[var(--hairline)]">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-24 md:px-8 md:py-28">
        <div className="mb-12 text-center">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h2 className="mt-3.5 font-sans text-[clamp(28px,3.4vw,40px)] font-semibold tracking-[-0.03em] text-[var(--ink)]">
            {t("title")}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {ITEMS.map((it, idx) => (
            <motion.div
              key={it.key}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, ease: EASE, delay: idx * 0.08 }}
            >
              <Card glow={it.glow} className="min-h-[150px] p-7">
                <Stat
                  value={t(`items.${it.key}.value`)}
                  label={t(`items.${it.key}.label`)}
                  size="lg"
                />
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
