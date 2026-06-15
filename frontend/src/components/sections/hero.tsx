"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Hero — banda 128px topo, texto centralizado, SEM glow (o glow começa na
 * próxima seção). Headline display com palavra-chave em itálico prata, badge
 * de beta, pill branco (único elemento brilhante) + ghost. O player real vem
 * logo abaixo no OutputShowcase.
 */
export function Hero() {
  const t = useTranslations("hero");

  return (
    <section
      id="hero"
      className="relative border-b border-[var(--hairline)] pt-16"
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 pb-24 pt-28 text-center md:px-8 md:pb-28 md:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mb-7 flex justify-center"
        >
          <Badge variant="soft" dot>
            {t("badge")}
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="display-hero mx-auto text-[clamp(2.75rem,7vw,5.25rem)] text-[var(--ink)]"
        >
          {t("titleLine1")}
          <br />
          <span className="italic text-[var(--silver)]">
            {t("titleAccent")}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
          className="mx-auto mt-7 max-w-[560px] text-[16px] leading-[1.55] text-[var(--body)] md:text-[18px]"
        >
          {t("description")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          {/* pill branco — único elemento mais brilhante da viewport */}
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
            <Play className="size-4" />
            {t("ctaSecondary")}
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="mt-[22px] text-[13px] text-[var(--ash)]"
        >
          {t("microcopy")}
        </motion.p>
      </div>
    </section>
  );
}
