import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignupForm } from "@/components/auth/signup-form";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          {t("brand")}
        </span>
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          {t("signup.title")}
        </h1>
        <p className="text-sm text-muted-fg">{t("signup.subtitle")}</p>
      </header>

      <SignupForm />

      <footer className="text-sm text-muted-fg">
        {t("signup.hasAccount")}{" "}
        <Link
          href="/login"
          className="text-fg underline decoration-accent decoration-2 underline-offset-4 hover:text-accent transition-colors"
        >
          {t("signup.loginLink")}
        </Link>
      </footer>
    </div>
  );
}
