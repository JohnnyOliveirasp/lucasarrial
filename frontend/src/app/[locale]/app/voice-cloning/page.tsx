import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Mic2, Plus, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VoiceRowMenu } from "@/components/voice/voice-row-menu";
import { Eyebrow, Badge } from "@/components/ui";
import { bypassesBilling, hasActiveAccess } from "@/lib/credits/access";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";

type VoiceRow = {
  id: string;
  name: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  uploading: "Subindo áudios",
  validating: "Validando",
  awaiting_training: "Pronta pra treinar",
  rejected_too_short: "< 20min · Rejeitado",
  training: "Treinando",
  ready: "Pronta",
  failed: "Falhou",
};

export default async function VoiceCloningPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "app" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: voices } = await supabase
    .from("voices")
    .select("id, name, status, duration_seconds, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const list = (voices ?? []) as VoiceRow[];

  // Treinar (clonar) uma voz exige plano vigente E saldo >= 10.000 créditos.
  // Geração de áudio com vozes prontas continua liberada (a lista abaixo).
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, credits_subscription, credits_extra, access_until")
    .eq("id", user.id)
    .single();
  const email = profile?.email ?? user.email ?? null;
  const team = bypassesBilling(email);
  const subscribed = hasActiveAccess(email, profile?.access_until ?? null);
  const creditsTotal =
    (profile?.credits_subscription ?? 0) + (profile?.credits_extra ?? 0);
  const canTrain = team || (subscribed && creditsTotal >= TRAINING_CREDIT_COST);

  return (
    <div className="flex flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>{t("nav.voiceCloning")}</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {t("voiceCloning.title")}
        </h1>
        <p className="max-w-xl text-sm text-[var(--mute)]">
          {t("voiceCloning.subtitle")}
        </p>
      </header>

      {canTrain ? (
        <div className="flex items-center justify-end">
          <Link
            href="/app/voice-cloning/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {t("voiceCloning.createButton")}
          </Link>
        </div>
      ) : (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            <Lock className="h-5 w-5 text-[var(--silver)]" />
            {subscribed
              ? "Créditos insuficientes para treinar"
              : "Assine para treinar uma voz"}
          </h2>
          <p className="max-w-xl text-sm text-[var(--mute)]">
            {subscribed
              ? `Treinar uma voz custa ${TRAINING_CREDIT_COST.toLocaleString("pt-BR")} créditos e você tem ${creditsTotal.toLocaleString("pt-BR")}. Compre um pacote para continuar — a geração de áudio com vozes já prontas segue liberada.`
              : "Você não tem um plano vigente. Treinar uma voz faz parte do plano: assine para liberar 100.000 créditos por mês e treinar a sua voz."}
          </p>
          <Link
            href={subscribed ? `/${locale}/app/credits` : `/${locale}/planos`}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]"
          >
            {subscribed ? "Comprar créditos" : "Assinar agora"}
            <span aria-hidden>→</span>
          </Link>
        </section>
      )}

      {list.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
          <Mic2 className="h-10 w-10 text-[var(--ash)]" />
          <p className="text-sm text-[var(--mute)]">{t("voiceCloning.empty")}</p>
        </section>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((v) => (
            <li
              key={v.id}
              className="flex items-stretch overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] transition-[border-color] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)]"
            >
              <Link
                href={`/app/voice-cloning/${v.id}`}
                className="grid flex-1 grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-base font-medium leading-tight text-[var(--ink)]">
                    {v.name}
                  </span>
                  <span className="text-xs text-[var(--ash)]">
                    {new Date(v.created_at).toLocaleDateString(locale)}
                  </span>
                </div>
                <Badge variant="soft">{STATUS_LABEL[v.status] ?? v.status}</Badge>
                <span className="text-[var(--mute)]" aria-hidden>
                  →
                </span>
              </Link>
              <VoiceRowMenu
                voiceId={v.id}
                voiceName={v.name}
                hasLora={v.status === "ready"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
