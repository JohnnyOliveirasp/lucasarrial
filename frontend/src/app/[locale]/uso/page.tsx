import { setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";
import { ACCEPTABLE_USE } from "@/lib/legal";

export default async function UsoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage doc={ACCEPTABLE_USE} />;
}
