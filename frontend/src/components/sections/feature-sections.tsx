"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  Mic,
  ScanFace,
  Wand2,
  Clapperboard,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Waveform } from "@/components/media/waveform";
import { VideoPreview } from "@/components/media/video-preview";
import { ScriptWindow, type ScriptLine } from "@/components/media/script-window";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Glow atmosférico no topo da seção, acoplado à feature. Nunca cor sólida. */
const GLOW: Record<string, string> = {
  voice: "var(--glow-violet)",
  face: "var(--glow-amber)",
  edit: "var(--glow-blue)",
  output: "var(--glow-green)",
};

function GlowTop({ glow }: { glow: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[680px]"
      style={{
        background: `radial-gradient(ellipse 900px 460px at 50% -8%, ${GLOW[glow]}, transparent 70%)`,
      }}
    />
  );
}

interface FeatureProps {
  glow: keyof typeof GLOW;
  Icon: LucideIcon;
  eyebrow: string;
  title: string;
  em: string;
  body: string;
  more: string;
  media: React.ReactNode;
  reverse?: boolean;
}

function FeatureSection({
  glow,
  Icon,
  eyebrow,
  title,
  em,
  body,
  more,
  media,
  reverse,
}: FeatureProps) {
  return (
    <section className="relative border-b border-[var(--hairline)]">
      <GlowTop glow={glow} />
      <div
        className={`relative mx-auto flex max-w-[1200px] flex-wrap items-center gap-16 px-6 py-24 md:px-8 md:py-28 ${
          reverse ? "md:flex-row-reverse" : "md:flex-row"
        }`}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="min-w-[280px] flex-1"
        >
          <div className="mb-[22px] flex size-[52px] items-center justify-center rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--silver)]">
            <Icon className="size-6" />
          </div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-3.5 font-sans text-[clamp(30px,4vw,44px)] font-semibold leading-[1.08] tracking-[-0.03em] text-[var(--ink)]">
            {title} <span className="italic text-[var(--silver)]">{em}</span>
          </h2>
          <p className="mt-5 max-w-[440px] text-[17px] leading-[1.6] text-[var(--body)]">
            {body}
          </p>
          <a
            href="#showcase"
            className="mt-6 inline-flex items-center gap-2 font-sans text-[14px] font-medium text-[var(--ink)] transition-opacity hover:opacity-80"
          >
            {more}
            <ArrowRight className="size-[15px]" />
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
          className="flex min-w-[280px] flex-1 justify-center"
        >
          {media}
        </motion.div>
      </div>
    </section>
  );
}

export function FeatureSections() {
  const t = useTranslations("features");

  const scriptLines: ScriptLine[] = [
    { tag: "dir", text: t("script.l1"), kind: "dir" },
    { tag: "01", text: t("script.l2") },
    { tag: "02", text: t("script.l3") },
    { tag: "dir", text: t("script.l4"), kind: "dir" },
    { tag: "03", text: t("script.l5"), kind: "dim" },
  ];

  return (
    <>
      <FeatureSection
        glow="voice"
        Icon={Mic}
        eyebrow={t("voice.eyebrow")}
        title={t("voice.title")}
        em={t("voice.em")}
        body={t("voice.body")}
        more={t("more")}
        media={
          <div className="w-full max-w-[460px]">
            <Waveform />
          </div>
        }
      />
      <FeatureSection
        glow="face"
        Icon={ScanFace}
        reverse
        eyebrow={t("face.eyebrow")}
        title={t("face.title")}
        em={t("face.em")}
        body={t("face.body")}
        more={t("more")}
        media={
          <VideoPreview
            vertical
            poster="/assets/landing-2-vertical.png"
            src="/assets/landing-2-vertical.mp4"
          />
        }
      />
      <FeatureSection
        glow="edit"
        Icon={Wand2}
        eyebrow={t("edit.eyebrow")}
        title={t("edit.title")}
        em={t("edit.em")}
        body={t("edit.body")}
        more={t("more")}
        media={
          <ScriptWindow
            filename={t("script.filename")}
            langLabel={t("script.lang")}
            lines={scriptLines}
          />
        }
      />
      <FeatureSection
        glow="output"
        Icon={Clapperboard}
        reverse
        eyebrow={t("output.eyebrow")}
        title={t("output.title")}
        em={t("output.em")}
        body={t("output.body")}
        more={t("more")}
        media={
          <VideoPreview
            poster="/assets/landing-3-desk.png"
            src="/assets/landing-3-desk.mp4"
          />
        }
      />
    </>
  );
}
