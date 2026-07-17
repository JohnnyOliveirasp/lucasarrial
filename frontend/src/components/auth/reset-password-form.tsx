"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const INPUT_CLASS =
  "h-11 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ash)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none";

/**
 * Define a nova senha (o usuário chega aqui logado pela sessão de recovery
 * criada no /auth/callback). Sem sessão, o updateUser falha → mensagem com
 * link pra pedir outro e-mail.
 */
export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("signup.passwordMismatch"));
      return;
    }
    setSubmitting(true);
    setError(null);

    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      const code = authError.message.toLowerCase();
      if (code.includes("session") || code.includes("not logged in") || code.includes("missing"))
        setError(t("reset.expired"));
      else if (code.includes("should be different")) setError(t("reset.samePassword"));
      else if (code.includes("at least") || code.includes("weak")) setError(t("reset.weak"));
      else setError(t("errors.generic"));
      setSubmitting(false);
      return;
    }

    router.push("/app/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-[13px] font-medium text-[var(--silver)]">
          {t("reset.passwordLabel")}
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("signup.passwordPlaceholder")}
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="confirm" className="text-[13px] font-medium text-[var(--silver)]">
          {t("signup.passwordConfirmLabel")}
        </label>
        <input
          id="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t("signup.passwordConfirmPlaceholder")}
          className={INPUT_CLASS}
        />
      </div>

      {error && <p className="text-[13px] text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-11 items-center justify-center rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? t("reset.submitting") : t("reset.submit")}
      </button>
    </form>
  );
}
