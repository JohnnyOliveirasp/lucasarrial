"use client";

import { useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import { CREDIT_PACKAGES } from "@/lib/credits/config";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BuyCredits() {
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
      setError(data?.error?.message ?? "Não foi possível iniciar a compra.");
    } catch {
      setError("Falha de conexão ao iniciar a compra.");
    }
    setLoading(null);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
        {CREDIT_PACKAGES.map((pkg) => (
          <div key={pkg.id} className="flex flex-col gap-4 bg-bg p-6">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-accent" />
              <span className="font-display text-2xl tracking-tight text-fg">
                {pkg.credits.toLocaleString("pt-BR")}
              </span>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-fg">
              créditos
            </span>
            <div className="mt-auto flex flex-col gap-3">
              <span className="font-display text-xl text-fg">{brl(pkg.priceCents)}</span>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => buy(pkg.id)}
                className="flex items-center justify-center gap-2 bg-fg px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bg transition-colors duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:bg-accent disabled:opacity-50"
              >
                {loading === pkg.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Comprar"
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-red-500">
          {error}
        </p>
      )}
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-fg">
        Pagamento via Stripe. Créditos avulsos não expiram.
      </p>
    </section>
  );
}
