import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Mic2, Plus, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VoiceRowMenu } from "@/components/voice/voice-row-menu";
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

  // Treinar (clonar) uma voz exige plano vigente E saldo >= 20.000 créditos.
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
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          {t("nav.voiceCloning")}
        </span>
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          {t("voiceCloning.title")}
        </h1>
        <p className="max-w-xl text-sm text-muted-fg">{t("voiceCloning.subtitle")}</p>
      </header>

      {canTrain ? (
        <div className="flex items-center justify-end">
          <Link
            href="/app/voice-cloning/new"
            className="flex items-center gap-2 bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-fg hover:text-bg active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" />
            {t("voiceCloning.createButton")}
          </Link>
        </div>
      ) : (
        <section className="flex flex-col gap-4 border border-accent bg-accent/5 p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl uppercase tracking-tight text-fg">
            <Lock className="h-5 w-5 text-accent" />
            {subscribed
              ? "Créditos insuficientes para treinar"
              : "Assine para treinar uma voz"}
          </h2>
          <p className="max-w-xl text-sm text-muted-fg">
            {subscribed
              ? `Treinar uma voz custa ${TRAINING_CREDIT_COST.toLocaleString("pt-BR")} créditos e você tem ${creditsTotal.toLocaleString("pt-BR")}. Compre um pacote para continuar — a geração de áudio com vozes já prontas segue liberada.`
              : "Você não tem um plano vigente. Treinar uma voz faz parte do plano: assine para liberar 180.000 créditos por mês e treinar a sua voz."}
          </p>
          <Link
            href={subscribed ? `/${locale}/app/credits` : `/${locale}/planos`}
            className="flex w-fit items-center gap-2 bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {subscribed ? "Comprar créditos →" : "Assinar agora →"}
          </Link>
        </section>
      )}

      {list.length === 0 ? (
        <section className="border border-dashed border-border bg-surface p-12 flex flex-col items-center gap-4 text-center">
          <Mic2 className="h-10 w-10 text-muted-fg" />
          <p className="text-sm text-muted-fg">{t("voiceCloning.empty")}</p>
        </section>
      ) : (
        <ul className="flex flex-col gap-px bg-border">
          {list.map((v) => (
            <li key={v.id} className="flex items-stretch bg-bg">
              <Link
                href={`/app/voice-cloning/${v.id}`}
                className="flex-1 grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-4 transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:bg-fg hover:text-bg"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-display text-xl uppercase leading-none">
                    {v.name}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-current/60">
                    {new Date(v.created_at).toLocaleDateString(locale)}
                  </span>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                  {STATUS_LABEL[v.status] ?? v.status}
                </span>
                <span className="text-current/60">→</span>
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
