import { setRequestLocale } from "next-intl/server";
import { AuthHero3D } from "@/components/auth/auth-hero-3d";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      <section className="flex items-center justify-center bg-bg px-6 py-16 lg:px-16">
        <div className="w-full max-w-md">{children}</div>
      </section>
      <aside className="hidden bg-fg lg:block">
        <AuthHero3D />
      </aside>
    </div>
  );
}
