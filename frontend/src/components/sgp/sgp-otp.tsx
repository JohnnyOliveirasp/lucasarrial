"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { SGP_ERROR_CLASS, SGP_PILL_CLASS } from "./sgp-classes";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Campo do código de 6–8 dígitos que o Supabase Auth mandou por e-mail.
 * Serve pros dois casos da tela 1 (decisão 29/08):
 *  - conta nova  → `type: "signup"` no reenvio, `verifyOtp(type:"email")`
 *  - conta que já existe → o código veio de `signInWithOtp`, e o mesmo
 *    `verifyOtp(type:"email")` cria a sessão sem mexer na senha dele.
 * Validou = `onVerificado()` (é o que habilita o Continuar).
 */
export function SgpOtp({
  email,
  contaNova,
  onVerificado,
}: {
  email: string;
  contaNova: boolean;
  onVerificado: () => Promise<void>;
}) {
  const t = useTranslations("sgp.dados");
  const supabase = createClient();
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reenviado, setReenviado] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }
    if (!timer.current) {
      timer.current = setInterval(() => setCooldown((s) => (s <= 1 ? 0 : s - 1)), 1000);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [cooldown]);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    if (err) {
      setError(t("codigoInvalido"));
      setSubmitting(false);
      return;
    }
    try {
      await onVerificado();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : t("erroGenerico"));
      setSubmitting(false);
    }
  }

  async function reenviar() {
    if (cooldown > 0) return;
    setError(null);
    const { error: err } = contaNova
      ? await supabase.auth.resend({ email, type: "signup" })
      : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback?next=/sgp` } });
    if (err) {
      setError(err.message.toLowerCase().includes("rate") ? t("muitasTentativas") : t("erroGenerico"));
      return;
    }
    setReenviado(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setTimeout(() => setReenviado(false), 4000);
  }

  return (
    <form onSubmit={verificar} className="flex flex-col gap-4">
      <div className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-4 py-4">
        <p className="mb-1 text-[13px] font-medium text-[var(--silver)]">
          {contaNova ? t("codigoEnviado") : t("codigoEnviadoContaExistente")}
        </p>
        <p className="text-[14px] text-[var(--ink)]">{email}</p>
      </div>

      <label htmlFor="sgp-otp" className="text-[13px] font-medium text-[var(--silver)]">
        {t("codigoLabel")}
      </label>
      <input
        id="sgp-otp"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        maxLength={8}
        minLength={6}
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder="000000"
        className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-4 text-center font-mono text-2xl tracking-[0.4em] text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
      />

      {error ? (
        <p role="alert" className={SGP_ERROR_CLASS}>
          {error}
        </p>
      ) : null}
      {reenviado && !error ? (
        <p role="status" className="text-[13px] text-[var(--silver)]">
          {t("codigoReenviado")}
        </p>
      ) : null}

      <button type="submit" disabled={submitting || otp.length < 6} className={SGP_PILL_CLASS}>
        {submitting ? t("verificando") : t("verificarEContinuar")}
      </button>

      <button
        type="button"
        onClick={reenviar}
        disabled={cooldown > 0}
        className="self-center text-[13px] text-[var(--silver)] transition-colors hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-[0.42]"
      >
        {cooldown > 0 ? t("reenviarEm", { seconds: cooldown }) : t("reenviar")}
      </button>
    </form>
  );
}
