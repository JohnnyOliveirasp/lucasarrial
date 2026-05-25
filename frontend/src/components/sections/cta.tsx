"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";

const EASE = [0.16, 1, 0.3, 1] as const;

export function CTA() {
  const t = useTranslations("cta");

  return (
    <section
      id="cta"
      className="relative border-t border-[var(--border)] py-24 md:py-36"
    >
      <div className="mx-auto w-full max-w-[1400px] px-6 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-8 flex items-center gap-3"
        >
          <span className="inline-block h-px w-10 bg-[var(--accent)]" />
          <span className="label-mono text-[var(--accent)]">{t("eyebrow")}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
          className="relative isolate overflow-hidden border border-[var(--accent)] bg-[var(--accent)] p-10 md:p-20"
        >
          <h2 className="display-hero text-[clamp(3rem,10vw,9rem)] text-[var(--accent-fg)]">
            {t("title")}
          </h2>

          <p className="mt-8 max-w-xl text-base leading-relaxed text-[var(--accent-fg)]/80 md:text-lg">
            {t("body")}
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="group inline-flex h-14 items-center gap-3 bg-[var(--accent-fg)] px-8 font-sans text-sm font-semibold uppercase tracking-wider text-[var(--accent)] transition-transform duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:-translate-y-[2px]"
            >
              {t("primary")}
              <ArrowRight className="size-4 transition-transform duration-[var(--dur-base)] ease-[var(--ease-snap)] group-hover:translate-x-1" />
            </Link>
            <a
              href="#contact"
              className="inline-flex h-14 items-center gap-3 border-[1.5px] border-[var(--accent-fg)] bg-transparent px-8 font-sans text-sm font-semibold uppercase tracking-wider text-[var(--accent-fg)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:bg-[var(--accent-fg)] hover:text-[var(--accent)]"
            >
              <MessageCircle className="size-4" />
              {t("secondary")}
            </a>
          </div>

          {/* Editorial corner mark */}
          <span
            aria-hidden
            className="absolute right-6 top-6 font-display text-6xl leading-none text-[var(--accent-fg)]/15 md:right-10 md:top-10 md:text-9xl"
          >
            06
          </span>
        </motion.div>
      </div>
    </section>
  );
}
