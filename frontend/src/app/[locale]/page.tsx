import { setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/sections/hero";
import { Problem } from "@/components/sections/problem";
import { Solution } from "@/components/sections/solution";
import { PlatformPreview } from "@/components/sections/platform-preview";
import { Features } from "@/components/sections/features";
import { CTA } from "@/components/sections/cta";
import { Footer } from "@/components/sections/footer";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <PlatformPreview />
        <Features />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
