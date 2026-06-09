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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <div className="relative flex w-full max-w-md flex-col gap-5 border border-accent bg-bg p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 text-muted-fg transition-colors hover:text-fg"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center bg-accent/10">
            <Coins className="h-5 w-5 text-accent" />
          </span>
          <h2
            id="paywall-title"
            className="font-display text-2xl uppercase tracking-tight text-fg"
          >
            {title}
          </h2>
        </div>

        <p className="text-sm text-muted-fg">{body}</p>

        {detail && (
          <p className="border border-border bg-surface px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-muted-fg">
            {detail}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="border border-border px-5 py-3 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:bg-surface"
          >
            Agora não
          </button>
          <Link
            href={href}
            className="flex items-center gap-2 bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
