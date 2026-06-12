"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Eyebrow } from "@/components/ui/eyebrow";

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
      className="relative isolate flex min-h-screen w-full items-end overflow-hidden bg-[var(--canvas)] pt-16"
    >
      <div className="absolute inset-0 -z-10">
        <video
          ref={videoRef}
          className="h-full w-full object-cover opacity-35"
          src="/assets/Hero.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/assets/LucasFundo3.png"
        />
        {/* fade para preto puro — o canvas nunca compete com o output */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--canvas)] via-[var(--canvas)]/70 to-[var(--canvas)]/30" />
        {/* glow atmosférico (voz) no topo — único acento, sutil */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[520px] glow-voice" />
      </div>

      <div className="relative mx-auto w-full max-w-[1200px] px-6 pb-16 md:px-8 md:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 flex items-center gap-3"
        >
          <span className="inline-block h-px w-10 bg-[var(--hairline-bright)]" />
          <Eyebrow>{t("eyebrow")}</Eyebrow>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="display-hero text-[clamp(2.75rem,8vw,6rem)] text-[var(--ink)]"
        >
          {t("titleLine1")}
          <br />
          <span className="italic">{t("titleLine2")}</span>{" "}
          <span className="italic">{t("titleLine3")}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          className="mt-7 max-w-xl text-[16px] leading-[1.6] text-[var(--mute)] md:text-[18px]"
        >
          {t("description")}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
          className="mt-9 flex flex-wrap items-center gap-3"
        >
          {/* pill branco — único elemento mais brilhante da viewport */}
          <Link
            href="/login"
            className="group inline-flex h-12 items-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[22px] font-sans text-[15px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
          >
            {t("ctaPrimary")}
            <ArrowRight className="size-4 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#solucao"
            className="inline-flex h-12 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[22px] font-sans text-[15px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]"
          >
            <Play className="size-4" />
            {t("ctaSecondary")}
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--hairline)] pt-6 text-[13px] text-[var(--ash)]"
        >
          <span>{t("metaStack")}</span>
          <span className="hidden h-3 w-px bg-[var(--hairline-strong)] md:inline-block" />
          <span>{t("metaScope")}</span>
          <span className="hidden h-3 w-px bg-[var(--hairline-strong)] md:inline-block" />
          <span>{t("metaVersion")}</span>
        </motion.div>
      </div>
    </section>
  );
}
