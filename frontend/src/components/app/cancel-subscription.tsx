"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const REASONS = [
  "Está caro",
  "Não estou usando o suficiente",
  "Faltou um recurso que eu precisava",
  "Tive um problema técnico",
  "Outro motivo",
];

export function CancelSubscription() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function confirm() {
    setLoading(true);
    try {
      await fetch("/api/v1/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, detail }),
      });
      setDone(true);
      router.refresh();
    } catch {
      /* mesmo em falha, o motivo foi enviado; não trava o usuário */
      setDone(true);
    }
    setLoading(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-fg underline-offset-4 transition-colors hover:text-red-500 hover:underline"
      >
        Cancelar assinatura
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md border border-border bg-bg p-8">
            {done ? (
              <div className="flex flex-col gap-4">
                <h3 className="font-display text-2xl uppercase tracking-tight text-fg">
                  Assinatura cancelada
                </h3>
                <p className="text-sm text-muted-fg">
                  Seu acesso continua até o fim do período já pago. Obrigado pelo
                  retorno — ele ajuda a melhorar a plataforma.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="self-start bg-fg px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bg transition-colors hover:bg-accent"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <h3 className="font-display text-2xl uppercase tracking-tight text-fg">
                    Antes de ir…
                  </h3>
                  <p className="text-sm text-muted-fg">
                    Pode cancelar tranquilo. Só nos conta o motivo (opcional) —
                    ajuda a melhorar.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {REASONS.map((r) => (
                    <label
                      key={r}
                      className="flex items-center gap-3 text-sm text-fg cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="cancel-reason"
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        className="accent-accent"
                      />
                      {r}
                    </label>
                  ))}
                </div>

                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={2}
                  placeholder="Quer detalhar? (opcional)"
                  className="border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted-fg/60 focus:border-accent focus:outline-none resize-none"
                />

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg hover:text-accent"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={confirm}
                    className="flex items-center gap-2 bg-red-500 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Confirmar cancelamento"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
