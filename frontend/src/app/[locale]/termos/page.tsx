import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";
import { TERMS } from "@/lib/legal";

export default async function TermosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage doc={TERMS} />;
}
