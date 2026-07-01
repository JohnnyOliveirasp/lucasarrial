import { Clock } from "lucide-react";

/**
 * Faixa no topo do /app avisando que há um pagamento assíncrono (Pix/boleto)
 * aguardando confirmação. Renderizada pelo layout quando o perfil tem
 * `pending_payment_at` recente e o usuário ainda está sem acesso. Some sozinha
 * quando o webhook confirma o pagamento (libera) ou o Pix expira.
 */
export function PendingPaymentBanner() {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--hairline)] bg-[var(--surface-card)] px-6 py-3 lg:px-12">
      <Clock className="h-4 w-4 shrink-0 text-[var(--silver)]" />
      <p className="text-[13px] leading-snug text-[var(--body)]">
        <strong className="text-[var(--ink)]">Pagamento via Pix aguardando confirmação.</strong>{" "}
        Assim que o pagamento cair, seu acesso é liberado automaticamente — você
        não precisa fazer nada. Pix pode levar alguns minutos (ou até o dia
        seguinte) pra ser confirmado.
      </p>
    </div>
  );
}
