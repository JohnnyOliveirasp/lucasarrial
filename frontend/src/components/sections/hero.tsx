"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, Play } from "lucide-react";

export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = useTranslations("hero");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      /* autoplay blocked on some mobile browsers — silent */
    });
  }, []);

  return (
    <section
      id="hero"
      className="relative isolate flex min-h-screen w-full items-end overflow-hidden bg-[var(--bg)] pt-16"
    >
      <div className="absolute inset-0 -z-10">
        <video
          ref={videoRef}
          className="h-full w-full object-cover opacity-60 dark:opacity-40"
          src="/assets/Hero.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/assets/LucasFundo3.png"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/60 to-[var(--bg)]/20" />
        <div
          aria-hidden
          className="absolute left-0 top-0 hidden h-full w-px bg-[var(--accent)] md:block"
        />
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-6 pb-16 md:px-10 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 flex items-center gap-3"
        >
          <span className="inline-block h-px w-10 bg-[var(--accent)]" />
          <span className="label-mono text-[var(--accent)]">
            {t("eyebrow")}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="display-hero text-[clamp(3.5rem,12vw,11rem)] text-[var(--fg)]"
        >
          {t("titleLine1")} <br />
          {t("titleLine2")}<span className="text-[var(--accent)]">.</span>
          <br />
          {t("titleLine3")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          className="mt-8 max-w-xl text-base leading-relaxed text-[var(--muted-fg)] md:text-lg"
        >
          {t("description")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          <a
            href="#cta"
            className="group inline-flex h-14 items-center gap-3 bg-[var(--accent)] px-8 font-sans text-sm font-semibold uppercase tracking-wider text-[var(--accent-fg)] transition-transform duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:-translate-y-[2px]"
          >
            {t("ctaPrimary")}
            <ArrowRight className="size-4 transition-transform duration-[var(--dur-base)] ease-[var(--ease-snap)] group-hover:translate-x-1" />
          </a>
          <a
            href="#solucao"
            className="inline-flex h-14 items-center gap-3 border-[1.5px] border-[var(--fg)] bg-transparent px-8 font-sans text-sm font-semibold uppercase tracking-wider text-[var(--fg)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:bg-[var(--fg)] hover:text-[var(--bg)]"
          >
            <Play className="size-4" />
            {t("ctaSecondary")}
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[var(--border)] pt-6"
        >
          <span className="label-mono text-[var(--muted-fg)]">
            {t("metaStack")}
          </span>
          <span className="hidden h-3 w-px bg-[var(--border)] md:inline-block" />
          <span className="label-mono text-[var(--muted-fg)]">
            {t("metaScope")}
          </span>
          <span className="hidden h-3 w-px bg-[var(--border)] md:inline-block" />
          <span className="label-mono text-[var(--muted-fg)]">
            {t("metaVersion")}
          </span>
        </motion.div>
      </div>
    </section>
  );
}
