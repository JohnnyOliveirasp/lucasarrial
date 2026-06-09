"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const REASONS = [
  "Não preciso mais",
  "Está caro",
  "Faltou um recurso que eu precisava",
  "Tive um problema técnico",
  "Preocupação com privacidade",
  "Outro motivo",
];

type Props = {
  /** E-mail da conta — o usuário precisa digitar exatamente este pra confirmar. */
  email: string;
};

export function DeleteAccount({ email }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailMatches = confirmEmail.trim().toLowerCase() === email.trim().toLowerCase();

  async function confirm() {
    if (!emailMatches) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, detail, email: confirmEmail.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Não foi possível excluir a conta.");
      }
      // Conta apagada → encerra a sessão e manda pra home.
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border border-red-500/40 bg-red-500/5 p-6">
      <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-red-500">
        <AlertTriangle className="h-4 w-4" />
        Zona perigosa
      </h2>
      <p className="max-w-xl text-sm text-muted-fg">
        Excluir a conta apaga <strong className="text-fg">todos os seus áudios</strong>,
        cancela a assinatura e é <strong className="text-fg">irreversível</strong>. Pra
        voltar, você terá que criar uma conta nova.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start font-mono text-[11px] uppercase tracking-[0.16em] text-red-500 underline-offset-4 transition-colors hover:underline"
      >
        Excluir minha conta
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col gap-5 overflow-y-auto border border-red-500/60 bg-bg p-7">
            <div className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 font-display text-2xl uppercase tracking-tight text-fg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Excluir conta
              </h3>
              <div className="border border-red-500/40 bg-red-500/5 p-3 text-sm text-fg">
                Esta ação <strong>não tem volta</strong>. Ao excluir:
                <ul className="mt-2 list-disc pl-5 text-muted-fg">
                  <li>todos os áudios gerados serão apagados;</li>
                  <li>sua assinatura é cancelada automaticamente;</li>
                  <li>você precisará criar uma nova conta pra voltar.</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg">
                Por que está saindo? (opcional)
              </span>
              {REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-3 text-sm text-fg">
                  <input
                    type="radio"
                    name="delete-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-red-500"
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
              className="border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted-fg/60 focus:border-red-500 focus:outline-none resize-none"
            />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="confirm-email"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg"
              >
                Digite <span className="text-fg">{email}</span> para confirmar
              </label>
              <input
                id="confirm-email"
                type="email"
                autoComplete="off"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={email}
                className="border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted-fg/40 focus:border-red-500 focus:outline-none"
              />
            </div>

            {error && (
              <p className="border border-red-500/40 bg-red-500/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-red-500">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg hover:text-accent disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={!emailMatches || loading}
                onClick={confirm}
                className="flex items-center gap-2 bg-red-500 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Excluir permanentemente"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
