"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Play, Pause, Check } from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Card } from "@/components/ui/card";

const EASE = [0.16, 1, 0.3, 1] as const;
const BARS = 48;

export function Solution() {
  const t = useTranslations("solution");
  const [playing, setPlaying] = useState(false);

  return (
    <section
      id="solucao"
      className="relative border-t border-[var(--hairline)] py-24 md:py-32"
    >
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-16 px-6 md:grid-cols-2 md:gap-20 md:px-8">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, ease: EASE }}
            className="mb-10 flex items-center gap-3"
          >
            <span className="inline-block h-px w-10 bg-[var(--hairline-bright)]" />
            <Eyebrow>{t("eyebrow")}</Eyebrow>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            className="display-hero text-[clamp(2.25rem,5vw,3.5rem)] text-[var(--ink)]"
          >
            {t("title")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.2 }}
            className="mt-8 max-w-lg text-[16px] leading-[1.6] text-[var(--mute)] md:text-[18px]"
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
                className="flex items-center gap-3 font-sans text-[16px] text-[var(--body)]"
              >
                <Check className="size-4 text-[var(--silver)]" />
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
          <Card glow="voice">
            <div className="mb-6 flex items-center justify-between">
              <Eyebrow className="text-[var(--ash)]">
                {t("playerLabel")}
              </Eyebrow>
              <span className="font-mono text-[13px] text-[var(--ash)]">
                {t("playerDuration")}
              </span>
            </div>

            <Waveform playing={playing} />

            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={t("playButton")}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] font-sans text-[15px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              {t("playButton")}
            </button>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

function Waveform({ playing }: { playing: boolean }) {
  return (
    <div className="flex h-24 items-center gap-[3px]" aria-hidden>
      {Array.from({ length: BARS }).map((_, i) => {
        const seed = (Math.sin(i * 1.7) + 1) / 2;
        const baseH = 20 + seed * 60;
        return (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-[var(--silver)]"
            style={{ height: `${baseH.toFixed(2)}%` }}
            animate={
              playing
                ? {
                    scaleY: [1, 0.4 + seed * 0.8, 1],
                    backgroundColor: [
                      "var(--silver)",
                      "var(--hue-violet)",
                      "var(--silver)",
                    ],
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
