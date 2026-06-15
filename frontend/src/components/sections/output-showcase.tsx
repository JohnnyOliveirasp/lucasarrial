"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { VideoPreview } from "@/components/media/video-preview";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * OutputShowcase — o vídeo protagonista, a ÚNICA zona saturada da página.
 * Puxado -48px pra cima pra invadir a banda do Hero (estilo Resend).
 */
export function OutputShowcase() {
  const t = useTranslations("showcase");

  return (
    <section
      id="showcase"
      className="relative border-b border-[var(--hairline)]"
    >
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="flex -translate-y-12 justify-center"
        >
          <VideoPreview
            poster="/assets/landing-1-hero.png"
            src="/assets/landing-1-hero.mp4"
            caption={t("caption")}
          />
        </motion.div>
      </div>
    </section>
  );
}
