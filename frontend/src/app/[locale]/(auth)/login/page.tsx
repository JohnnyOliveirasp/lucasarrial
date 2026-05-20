import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
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
          {t("login.title")}
        </h1>
        <p className="text-sm text-muted-fg">{t("login.subtitle")}</p>
      </header>

      <LoginForm />

      <footer className="text-sm text-muted-fg">
        {t("login.noAccount")}{" "}
        <Link
          href="/signup"
          className="text-fg underline decoration-accent decoration-2 underline-offset-4 hover:text-accent transition-colors"
        >
          {t("login.signupLink")}
        </Link>
      </footer>
    </div>
  );
}
