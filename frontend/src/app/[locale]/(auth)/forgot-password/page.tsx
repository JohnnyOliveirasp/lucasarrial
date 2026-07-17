import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default async function ForgotPasswordPage({
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
          {t("forgot.title")}
        </h1>
        <p className="text-[15px] leading-[1.5] text-[var(--mute)]">
          {t("forgot.subtitle")}
        </p>
      </header>

      <ForgotPasswordForm />

      <footer className="text-[14px] text-[var(--mute)]">
        <Link
          href="/login"
          className="text-[var(--ink)] underline decoration-[var(--hairline-bright)] decoration-1 underline-offset-[3px] transition-colors hover:decoration-[var(--ink)]"
        >
          {t("forgot.backToLogin")}
        </Link>
      </footer>
    </div>
  );
}
