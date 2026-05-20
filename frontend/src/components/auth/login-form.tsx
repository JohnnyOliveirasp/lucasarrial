"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

const GOOGLE_ICON = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
    <path
      fill="currentColor"
      d="M21.35 11.1H12v2.94h5.36c-.23 1.4-1.6 4.1-5.36 4.1-3.22 0-5.85-2.66-5.85-5.94S8.78 6.26 12 6.26c1.84 0 3.06.78 3.76 1.46l2.56-2.46C16.68 3.78 14.55 2.86 12 2.86c-5.27 0-9.54 4.27-9.54 9.54s4.27 9.54 9.54 9.54c5.5 0 9.16-3.87 9.16-9.31 0-.62-.06-1.1-.15-1.53Z"
    />
  </svg>
);

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const search = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = search.get("redirectTo") || "/app/dashboard";

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      const code = authError.message.toLowerCase();
      if (code.includes("invalid")) setError(t("errors.invalidCredentials"));
      else if (code.includes("confirm")) setError(t("errors.emailNotConfirmed"));
      else if (code.includes("rate")) setError(t("errors.rateLimited"));
      else setError(t("errors.generic"));
      setSubmitting(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (authError) {
      setError(t("errors.generic"));
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading || submitting}
        className="group flex items-center justify-center gap-3 border border-border bg-bg px-4 py-3 text-sm font-medium text-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:border-fg hover:bg-fg hover:text-bg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {GOOGLE_ICON}
        <span>{googleLoading ? t("login.submitting") : t("login.googleButton")}</span>
      </button>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-fg">
          {t("login.or")}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg"
          >
            {t("login.emailLabel")}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("login.emailPlaceholder")}
            className="border border-border bg-bg px-3 py-3 text-sm text-fg placeholder:text-muted-fg/60 focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg"
            >
              {t("login.passwordLabel")}
            </label>
            <Link
              href="/forgot-password"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg hover:text-accent transition-colors"
            >
              {t("login.forgotPassword")}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("login.passwordPlaceholder")}
            className="border border-border bg-bg px-3 py-3 text-sm text-fg placeholder:text-muted-fg/60 focus:border-accent focus:outline-none"
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

        <button
          type="submit"
          disabled={submitting || googleLoading}
          className="bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-fg hover:text-bg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? t("login.submitting") : t("login.submit")}
        </button>
      </form>
    </div>
  );
}
