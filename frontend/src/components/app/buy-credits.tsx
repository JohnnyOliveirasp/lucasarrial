"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Coins, Loader2 } from "lucide-react";
import { CREDIT_PACKAGES } from "@/lib/credits/config";
import { Button, Card, Stat } from "@/components/ui";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BuyCredits() {
  const t = useTranslations("shell.buyCredits");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packageId: string) {
    setLoading(packageId);
    setError(null);
    try {
      const res = await fetch("/api/v1/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: packageId }),
      });
      const data = await res.json();
      if (res.ok && data?.url) {
        window.location.href = data.url; // redireciona pro checkout do Stripe
        return;
      }
      setError(data?.error?.message ?? t("startError"));
    } catch {
      setError(t("connectionError"));
    }
    setLoading(null);
  }

  // O pacote do meio recebe o pill branco (máx. 1 por tela); os demais, botão secundário.
  const featuredIndex = Math.floor(CREDIT_PACKAGES.length / 2);

  return (
    <section className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CREDIT_PACKAGES.map((pkg, i) => {
          const featured = i === featuredIndex;
          return (
            <Card
              key={pkg.id}
              glow={featured ? "stats" : undefined}
              elevated={featured}
              className="flex flex-col gap-5"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-full)] border border-[var(--hairline-strong)] text-[var(--silver)]">
                <Coins className="h-4 w-4" />
              </span>

              <Stat
                size="sm"
                value={pkg.credits.toLocaleString("pt-BR")}
                label={t("credits")}
              />

              <div className="mt-auto flex flex-col gap-4">
                <span className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  {brl(pkg.priceCents)}
                </span>
                <Button
                  variant={featured ? "primary" : "secondary"}
                  fullWidth
                  disabled={loading !== null}
                  onClick={() => buy(pkg.id)}
                  iconLeft={
                    loading === pkg.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : undefined
                  }
                >
                  {loading === pkg.id ? t("wait") : t("buy")}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-[var(--status-error)]">
          {error}
        </p>
      )}

      <p className="text-[13px] text-[var(--ash)]">
        {t("footnote")}
      </p>
    </section>
  );
}
