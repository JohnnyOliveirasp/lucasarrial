import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { DM_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider";
import { LogBootstrap } from "@/components/log-bootstrap";
import { routing } from "@/i18n/routing";
import "../globals.css";

// DM Sans — fonte exclusiva do brand FastCloner. Pesos 400/500/600/700 + itálicos 400/500.
const dmSans = localFont({
  src: [
    { path: "../fonts/DMSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/DMSans-Italic.ttf", weight: "400", style: "italic" },
    { path: "../fonts/DMSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/DMSans-MediumItalic.ttf", weight: "500", style: "italic" },
    { path: "../fonts/DMSans-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/DMSans-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-dm-sans",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

// DM Mono — face mono para UI de script/timeline/chaves de API (substituição sinalizada).
const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  return {
    title: t("title"),
    description: t("description"),
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://fastcloner.com",
    ),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${dmSans.variable} ${dmMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="bg-canvas text-body antialiased">
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            forcedTheme="dark"
            disableTransitionOnChange
          >
            <LogBootstrap />
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
