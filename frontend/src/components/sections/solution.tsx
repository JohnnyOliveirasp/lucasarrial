"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Play, Pause, Check } from "lucide-react";

const EASE = [0.16, 1, 0.3, 1] as const;
const BARS = 48;

export function Solution() {
  const t = useTranslations("solution");
  const [playing, setPlaying] = useState(false);

  return (
    <section
      id="solucao"
      className="relative border-t border-[var(--border)] bg-[var(--surface)] py-24 md:py-36"
    >
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-16 px-6 md:grid-cols-2 md:px-10 md:gap-20">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mb-10 flex items-center gap-3"
          >
            <span className="inline-block h-px w-10 bg-[var(--accent)]" />
            <span className="label-mono text-[var(--accent)]">
              {t("eyebrow")}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="display-hero text-[clamp(2.5rem,7vw,6rem)] text-[var(--fg)]"
          >
            {t("title")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
            className="mt-8 max-w-lg text-base leading-relaxed text-[var(--muted-fg)] md:text-lg"
          >
            {t("body")}
          </motion.p>

          <motion.ul
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            transition={{ staggerChildren: 0.08, delayChildren: 0.3 }}
            className="mt-10 space-y-3"
          >
            {(["1", "2", "3"] as const).map((k) => (
              <motion.li
                key={k}
                variants={{
                  hidden: { opacity: 0, x: -8 },
                  visible: { opacity: 1, x: 0 },
                }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex items-center gap-3 font-sans text-base text-[var(--fg)]"
              >
                <Check className="size-4 text-[var(--accent)]" />
                {t(`bullets.${k}`)}
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
          className="self-center"
        >
          <div className="border border-[var(--border)] bg-[var(--bg)] p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <span className="label-mono text-[var(--muted-fg)]">
                {t("playerLabel")}
              </span>
              <span className="label-mono text-[var(--muted-fg)]">
                {t("playerDuration")}
              </span>
            </div>

            <Waveform playing={playing} />

            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={t("playButton")}
              className="mt-6 flex h-12 w-full items-center justify-center gap-3 bg-[var(--accent)] font-sans text-sm font-semibold uppercase tracking-wider text-[var(--accent-fg)] transition-transform duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:-translate-y-[2px]"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              {t("playButton")}
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Waveform({ playing }: { playing: boolean }) {
  return (
    <div
      className="flex h-24 items-center gap-[3px]"
      aria-hidden
    >
      {Array.from({ length: BARS }).map((_, i) => {
        const seed = (Math.sin(i * 1.7) + 1) / 2;
        const baseH = 20 + seed * 60;
        return (
          <motion.span
            key={i}
            className="w-[3px] bg-[var(--fg)]"
            style={{ height: `${baseH}%` }}
            animate={
              playing
                ? {
                    scaleY: [1, 0.4 + seed * 0.8, 1],
                    backgroundColor: ["var(--fg)", "var(--accent)", "var(--fg)"],
                  }
                : { scaleY: 1 }
            }
            transition={{
              duration: 0.6 + (i % 5) * 0.05,
              repeat: playing ? Infinity : 0,
              ease: "easeInOut",
              delay: (i * 0.02) % 0.3,
            }}
          />
        );
      })}
    </div>
  );
}
