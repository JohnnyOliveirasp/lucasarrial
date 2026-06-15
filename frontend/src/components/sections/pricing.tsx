"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge, Eyebrow } from "@/components/ui";

const EASE = [0.16, 1, 0.3, 1] as const;

const TIERS = [
  { key: "pro", featured: true },
] as const;

/**
 * Pricing — plano único (R$97/mês), card central em destaque (surface-elevated +
 * hairline-bright), CTA pill branco. CTA leva pra /login (entrada livre); o
 * billing real é resolvido no fluxo de assinatura. Créditos avulsos (Stripe)
 * ficam dentro do app, em /app/credits.
 */
export function Pricing() {
  const t = useTranslations("pricing");

  return (
    <section id="precos" className="border-b border-[var(--hairline)]">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-24 md:px-8 md:py-28">
        <div className="mb-14 text-center">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <h2 className="mt-3.5 font-sans text-[clamp(28px,3.4vw,40px)] font-semibold tracking-[-0.03em] text-[var(--ink)]">
            {t("title")}
          </h2>
        </div>

        <div className="mx-auto grid max-w-[420px] grid-cols-1 items-start gap-5">
          {TIERS.map((tier, idx) => {
            const feats = t.raw(`tiers.${tier.key}.feats`) as string[];
            return (
              <motion.div
                key={tier.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, ease: EASE, delay: idx * 0.08 }}
                className={`relative rounded-[var(--radius-lg)] border p-8 ${
                  tier.featured
                    ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)]"
                    : "border-[var(--hairline-strong)] bg-[var(--surface-card)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-sans text-[18px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
                    {t(`tiers.${tier.key}.name`)}
                  </span>
                  {tier.featured && (
                    <Badge variant="solid">{t("recommended")}</Badge>
                  )}
                </div>
                <p className="mt-2 text-[14px] text-[var(--mute)]">
                  {t(`tiers.${tier.key}.desc`)}
                </p>
                <div className="my-6 flex items-baseline gap-1.5">
                  <span className="font-sans text-[40px] font-semibold tracking-[-0.03em] text-[var(--silver)]">
                    {t(`tiers.${tier.key}.price`)}
                  </span>
                  <span className="text-[14px] text-[var(--ash)]">
                    {t(`tiers.${tier.key}.cad`)}
                  </span>
                </div>

                <Link
                  href="/login"
                  className={`inline-flex h-10 w-full items-center justify-center rounded-[var(--radius)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] active:scale-[0.98] ${
                    tier.featured
                      ? "bg-[var(--pill-bg)] text-[var(--pill-ink)] hover:bg-white"
                      : "border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] text-[var(--ink)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)]"
                  }`}
                >
                  {t(`tiers.${tier.key}.cta`)}
                </Link>

                <div className="my-6 h-px bg-[var(--hairline)]" />
                <ul className="flex flex-col gap-3">
                  {feats.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2.5 text-[14px] text-[var(--body)]"
                    >
                      <Check className="size-4 flex-none text-[var(--silver)]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
