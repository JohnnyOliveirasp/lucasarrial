"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * ClosingCTA — banda de fechamento 128px. Headline display com palavra-chave
 * em itálico prata, pill branco + ghost. Sem glow (fechamento sóbrio).
 */
export function CTA() {
  const t = useTranslations("closing");

  return (
    <section id="cta" className="border-b border-[var(--hairline)]">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mx-auto w-full max-w-[1200px] px-6 py-28 text-center md:px-8 md:py-32"
      >
        <h2 className="display-hero mx-auto text-[clamp(2.25rem,5vw,4rem)] text-[var(--ink)]">
          {t("titleLine1")}
          <br />
          {t("titleLine2")}{" "}
          <span className="italic text-[var(--silver)]">{t("titleAccent")}</span>
          {t("titleTail")}
        </h2>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-12 items-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[22px] font-sans text-[15px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
          >
            {t("ctaPrimary")}
          </Link>
          <a
            href="#showcase"
            className="inline-flex h-12 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[22px] font-sans text-[15px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]"
          >
            {t("ctaSecondary")}
          </a>
        </div>
      </motion.div>
    </section>
  );
}
