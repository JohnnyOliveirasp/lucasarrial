"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

const INPUT_CLASS =
  "h-11 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ash)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none";

/**
 * "Esqueci a senha": pede o e-mail e manda a casa despachar o link.
 * O link cai em /auth/callback (type=recovery) → sessão → /reset-password.
 * Sempre mostra sucesso mesmo se o e-mail não existir (anti-enumeração).
 *
 * ⚠️ NÃO CHAMA MAIS `supabase.auth.resetPasswordForEmail`. Aquela é chamada de
 * CLIENTE: quem mandava o e-mail era o provedor do próprio Supabase, de um
 * remetente que não é o nosso — e o envio não deixava rastro nenhum do lado de
 * cá (nada em `emails_enviados`, sem Message-ID nosso, sem cópia em Enviados,
 * sem onde o bounce cair). Medido em 18/09 na aluna walsicleia_kaka@hotmail.com:
 * `recovery_sent_at` carimbado e ZERO linha de envio, enquanto o
 * `suporte@fastcloner.com` entregava na caixa dela sem um bounce sequer.
 * Agora o pedido vai pro servidor e a carta sai pelo SMTP da casa.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    let status = 0;
    try {
      const r = await fetch("/api/v1/auth/recuperar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // O idioma da carta é o da tela em que a pessoa está pedindo.
        body: JSON.stringify({ email, idioma: locale }),
      });
      status = r.status;
    } catch {
      // Rede caiu antes de chegar no servidor.
      setError(t("errors.generic"));
      setSubmitting(false);
      return;
    }

    // 429 = teto por e-mail (1/min, o cooldown que o Supabase dava) ou por IP.
    // A mensagem é a mesma de antes: a pessoa só precisa saber que é pra esperar.
    if (status === 429) {
      setError(t("errors.rateLimited"));
      setSubmitting(false);
      return;
    }
    if (status !== 200) {
      setError(t("errors.generic"));
      setSubmitting(false);
      return;
    }
    // 200 é o MESMO pra conta que existe e pra que não existe — de propósito.
    setSent(true);
    setSubmitting(false);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3.5">
        <p className="text-[14px] leading-relaxed text-[var(--silver)]">{t("forgot.sent")}</p>
        {/* Agora a carta sai do NOSSO endereço: dizer qual é ajuda a pessoa a
            achar (e a resgatar do spam) em vez de procurar por "Supabase". */}
        <p className="text-[13px] leading-relaxed text-[var(--ash)]">{t("forgot.sentRemetente")}</p>
      </div>
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
