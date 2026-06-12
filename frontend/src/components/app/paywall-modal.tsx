"use client";

/**
 * Popup de paywall exibido na AÇÃO (gerar/clonar voz) quando faltam créditos.
 * A entrada na plataforma é livre; o bloqueio acontece só aqui, no momento
 * em que o usuário tenta consumir crédito. Acionado pelo 402 das rotas
 * generate / start-training (code "insufficient_credits").
 *
 * CTA depende de `subscribed` (vem do 402 em details.subscribed):
 *  - sem assinatura  → "Assinar agora" (/planos)   — assinar dá 180k créditos/mês
 *  - assinante ativo → "Comprar créditos" (/app/credits) — pacote avulso (Stripe)
 */
import Link from "next/link";
import { Coins, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Assinatura ativa? Decide o destino do CTA. */
  subscribed: boolean;
  /** Verbo da ação, só pra copy ("gerar áudio" / "clonar a sua voz"). */
  action: string;
  /** Mensagem opcional vinda do backend (ex.: custo x saldo). */
  detail?: string | null;
};

export function PaywallModal({ open, onClose, subscribed, action, detail }: Props) {
  if (!open) return null;

  const href = subscribed ? "/app/credits" : "/planos";
  const ctaLabel = subscribed ? "Comprar créditos →" : "Assinar agora →";
  const title = subscribed ? "Seus créditos acabaram" : "Você ainda não tem créditos";
  const body = subscribed
    ? `Compre um pacote para continuar a ${action}, ou espere a recarga do próximo ciclo.`
    : `Cada caractere usa 1 crédito. Assine para receber 180.000 créditos por mês e começar a ${action}.`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <div className="relative flex w-full max-w-md flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-[var(--radius-sm)] p-1 text-[var(--ash)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 pr-8">
          <span className="flex size-10 items-center justify-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)]">
            <Coins className="h-5 w-5 text-[var(--silver)]" />
          </span>
          <h2
            id="paywall-title"
            className="font-sans text-xl font-semibold tracking-[-0.02em] text-[var(--ink)]"
          >
            {title}
          </h2>
        </div>

        <p className="text-sm leading-relaxed text-[var(--body)]">{body}</p>

        {detail && (
          <p className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 font-mono text-[12px] tracking-[-0.01em] text-[var(--mute)]">
            {detail}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Agora não
          </Button>
          <Link href={href} className={buttonVariants({ variant: "primary" })}>
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
