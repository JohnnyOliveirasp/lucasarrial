import { Suspense } from "react";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
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
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <Image
            src="/brand/fastpost-glyph.png"
            alt="FastCloner"
            width={20}
            height={20}
            className="h-5 w-5"
            priority
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--silver)]">
            {t("brand")}
          </span>
        </div>
        <h1 className="font-sans text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--ink)]">
          {t("login.title")}
        </h1>
        <p className="text-[15px] leading-[1.5] text-[var(--mute)]">
          {t("login.subtitle")}
        </p>
      </header>

      <Suspense fallback={<div className="min-h-64" />}>
        <LoginForm />
      </Suspense>

      <footer className="text-[14px] text-[var(--mute)]">
        {t("login.noAccount")}{" "}
        <Link
          href="/signup"
          className="text-[var(--ink)] underline decoration-[var(--hairline-bright)] decoration-1 underline-offset-[3px] transition-colors hover:decoration-[var(--ink)]"
        >
          {t("login.signupLink")}
        </Link>
      </footer>
    </div>
  );
}
