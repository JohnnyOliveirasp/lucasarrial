"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

const INPUT_CLASS =
  "h-11 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ash)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none";

/**
 * "Esqueci a senha": pede o e-mail e dispara o link de recuperação do Supabase.
 * O link cai em /auth/callback (type=recovery) → sessão → /reset-password.
 * Sempre mostra sucesso mesmo se o e-mail não existir (anti-enumeração).
 */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });

    if (authError) {
      const code = authError.message.toLowerCase();
      // "For security purposes, you can only request this after N seconds" =
      // cooldown de 60s do Supabase entre pedidos pro MESMO e-mail (visto em
      // prod 21/07: usuário reenviava e caía no "Algo deu errado" genérico).
      if (code.includes("rate") || code.includes("security purposes"))
        setError(t("errors.rateLimited"));
      else setError(t("errors.generic"));
      setSubmitting(false);
      return;
    }
    setSent(true);
    setSubmitting(false);
  }

  if (sent) {
    return (
      <p className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3.5 text-[14px] leading-relaxed text-[var(--silver)]">
        {t("forgot.sent")}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-[13px] font-medium text-[var(--silver)]">
          {t("forgot.emailLabel")}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("forgot.emailPlaceholder")}
          className={INPUT_CLASS}
        />
      </div>

      {error && <p className="text-[13px] text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-11 items-center justify-center rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? t("forgot.submitting") : t("forgot.submit")}
      </button>
    </form>
  );
}
