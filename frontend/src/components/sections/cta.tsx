"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Eyebrow } from "@/components/ui/eyebrow";

const EASE = [0.16, 1, 0.3, 1] as const;

export function CTA() {
  const t = useTranslations("cta");

  return (
    <section
      id="cta"
      className="relative border-t border-[var(--hairline)] py-24 md:py-32"
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-8 flex items-center gap-3"
        >
          <span className="inline-block h-px w-10 bg-[var(--hairline-bright)]" />
          <Eyebrow>{t("eyebrow")}</Eyebrow>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
          className="relative isolate overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] p-10 md:p-20"
        >
          {/* glow atmosférico (stats/sucesso) no topo */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
            style={{
              background:
                "radial-gradient(ellipse 900px 420px at 50% -20%, var(--glow-magenta), transparent 70%)",
            }}
          />

          <h2 className="display-hero relative text-[clamp(2.5rem,8vw,6rem)] text-[var(--ink)]">
            {t("title")}
          </h2>

          <p className="relative mt-8 max-w-xl text-[16px] leading-[1.6] text-[var(--mute)] md:text-[18px]">
            {t("body")}
          </p>

          <div className="relative mt-12 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="group inline-flex h-12 items-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[22px] font-sans text-[15px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
            >
              {t("primary")}
              <ArrowRight className="size-4 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#contact"
              className="inline-flex h-12 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-transparent px-[22px] font-sans text-[15px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]"
            >
              <MessageCircle className="size-4" />
              {t("secondary")}
            </a>
          </div>

          {/* Editorial corner mark */}
          <span
            aria-hidden
            className="display-hero absolute right-6 top-6 text-6xl leading-none text-[var(--hairline-strong)] md:right-10 md:top-10 md:text-9xl"
          >
            06
          </span>
        </motion.div>
      </div>
    </section>
  );
}
