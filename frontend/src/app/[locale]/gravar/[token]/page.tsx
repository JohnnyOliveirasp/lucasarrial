import { setRequestLocale } from "next-intl/server";
import { verifyRecorderToken } from "@/lib/recorder-test/token";
import { PhoneRecorderMobile } from "@/components/lab/phone-recorder-mobile";

/**
 * 🧪 Lab · Gravador pelo Celular — página PÚBLICA aberta pelo link no
 * aparelho (sem login: a autorização é o token assinado da sessão, 2h).
 */
export const dynamic = "force-dynamic";

export default async function GravarPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  if (!verifyRecorderToken(token)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-[#0a0a0c] px-8 text-center text-white">
        <p className="font-sans text-[18px] font-semibold">Link expirado</p>
        <p className="max-w-[40ch] text-[13px] text-neutral-400">
          Esta sessão de gravação venceu. Gere um novo link na tela do computador e abra de novo.
        </p>
      </div>
    );
  }
  return <PhoneRecorderMobile token={token} />;
}
