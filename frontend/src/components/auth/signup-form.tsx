"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type Step = "form" | "otp";
type ResendStatus = "idle" | "sending" | "sent";

const RESEND_COOLDOWN_SECONDS = 60;

export function SignupForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<ResendStatus>("idle");
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
        cooldownTimer.current = null;
      }
      return;
    }
    if (!cooldownTimer.current) {
      cooldownTimer.current = setInterval(() => {
        setCooldown((s) => (s <= 1 ? 0 : s - 1));
      }, 1000);
    }
    return () => {
      if (cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
        cooldownTimer.current = null;
      }
    };
  }, [cooldown]);

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError(t("signup.passwordMismatch"));
      return;
    }

    setSubmitting(true);

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    });

    if (authError) {
      const code = authError.message.toLowerCase();
      if (code.includes("rate")) setError(t("errors.rateLimited"));
      else if (code.includes("already")) setError(t("errors.invalidCredentials"));
      else setError(t("errors.generic"));
      setSubmitting(false);
      return;
    }

    setStep("otp");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setSubmitting(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (verifyError) {
      setError(t("errors.invalidCredentials"));
      setSubmitting(false);
      return;
    }

    router.push("/app/dashboard");
    router.refresh();
  }

  async function handleResendOtp() {
    if (cooldown > 0 || resendStatus === "sending") return;
    setError(null);
    setResendStatus("sending");

    const { error: resendError } = await supabase.auth.resend({
      email,
      type: "signup",
    });

    if (resendError) {
      const msg = resendError.message.toLowerCase();
      if (msg.includes("rate") || msg.includes("seconds")) {
        const match = resendError.message.match(/(\d+)\s*seconds?/i);
        const wait = match ? parseInt(match[1], 10) : RESEND_COOLDOWN_SECONDS;
        setCooldown(wait);
        setError(t("errors.rateLimited"));
      } else {
        setError(t("errors.generic"));
      }
      setResendStatus("idle");
      return;
    }

    setResendStatus("sent");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setTimeout(() => setResendStatus("idle"), 4000);
  }

  async function handleGoogleSignup() {
    setGoogleLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/app/dashboard`,
      },
    });

    if (authError) {
      setError(t("errors.generic"));
      setGoogleLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <div className="flex flex-col gap-6">
        <div className="border border-accent bg-accent/5 px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-1">
            ✓ {t("signup.checkEmail")}
          </p>
          <p className="text-sm text-fg/80">{email}</p>
        </div>

        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="otp"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg"
            >
              {t("signup.otpLabel")}
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={8}
              minLength={6}
              pattern="[0-9]{6,8}"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder={t("signup.otpPlaceholder")}
              className="border border-border bg-bg px-3 py-4 font-mono text-2xl tracking-[0.4em] text-center text-fg placeholder:text-muted-fg/40 focus:border-accent focus:outline-none"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent"
            >
              {error}
            </p>
          )}

          {resendStatus === "sent" && !error && (
            <p
              role="status"
              className="border border-fg/20 bg-fg/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-fg"
            >
              ✓ {t("signup.resent")}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || otp.length < 6 || otp.length > 8}
            className="bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-fg hover:text-bg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t("signup.verifying") : t("signup.verify")}
          </button>

          <div className="flex flex-col items-center gap-1 pt-2">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={cooldown > 0 || resendStatus === "sending"}
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-fg transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted-fg"
            >
              {resendStatus === "sending"
                ? t("signup.resending")
                : cooldown > 0
                  ? t("signup.resendIn", { seconds: cooldown })
                  : t("signup.resend")}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={handleGoogleSignup}
        disabled={googleLoading || submitting}
        className="group flex items-center justify-center gap-3 border border-border bg-bg px-4 py-3 text-sm font-medium text-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:border-fg hover:bg-fg hover:text-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            fill="currentColor"
            d="M21.35 11.1H12v2.94h5.36c-.23 1.4-1.6 4.1-5.36 4.1-3.22 0-5.85-2.66-5.85-5.94S8.78 6.26 12 6.26c1.84 0 3.06.78 3.76 1.46l2.56-2.46C16.68 3.78 14.55 2.86 12 2.86c-5.27 0-9.54 4.27-9.54 9.54s4.27 9.54 9.54 9.54c5.5 0 9.16-3.87 9.16-9.31 0-.62-.06-1.1-.15-1.53Z"
          />
        </svg>
        <span>{googleLoading ? t("signup.submitting") : t("signup.googleButton")}</span>
      </button>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-fg">
          {t("signup.or")}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailSignup} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
            {t("signup.nameLabel")}
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("signup.namePlaceholder")}
            className="border border-border bg-bg px-3 py-3 text-sm text-fg placeholder:text-muted-fg/60 focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
            {t("signup.emailLabel")}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("signup.emailPlaceholder")}
            className="border border-border bg-bg px-3 py-3 text-sm text-fg placeholder:text-muted-fg/60 focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
            {t("signup.passwordLabel")}
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("signup.passwordPlaceholder")}
            className="border border-border bg-bg px-3 py-3 text-sm text-fg placeholder:text-muted-fg/60 focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password-confirm" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
            {t("signup.passwordConfirmLabel")}
          </label>
          <input
            id="password-confirm"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            placeholder={t("signup.passwordConfirmPlaceholder")}
            aria-invalid={passwordConfirm.length > 0 && passwordConfirm !== password}
            className="border border-border bg-bg px-3 py-3 text-sm text-fg placeholder:text-muted-fg/60 focus:border-accent focus:outline-none aria-[invalid=true]:border-accent"
          />
          {passwordConfirm.length > 0 && passwordConfirm !== password && (
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              {t("signup.passwordMismatch")}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || googleLoading}
          className="bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-fg hover:text-bg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? t("signup.submitting") : t("signup.submit")}
        </button>
      </form>
    </div>
  );
}
