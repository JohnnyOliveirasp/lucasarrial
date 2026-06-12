import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Mic2, Clock, Check, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/audio/duration";
import type { VoiceStatus } from "@/lib/db/types";
import { VoiceStatusPanel } from "@/components/voice/voice-status-panel";
import { VoiceRowMenu } from "@/components/voice/voice-row-menu";
import { SupportError } from "@/components/ui/support-error";
import { Eyebrow, Badge } from "@/components/ui";

type BadgeTone = "neutral" | "active" | "danger" | "success";

const STATUS_BADGE: Record<VoiceStatus, { label: string; tone: BadgeTone }> = {
  uploading:           { label: "Subindo áudios",        tone: "neutral" },
  validating:          { label: "Validando",             tone: "neutral" },
  awaiting_training:   { label: "Pronta pra treinar",    tone: "active"  },
  rejected_too_short:  { label: "Rejeitado — < 20min",   tone: "danger"  },
  training:            { label: "Treinando…",            tone: "active"  },
  ready:               { label: "✓ Pronta",              tone: "success" },
  failed:              { label: "Falhou",                tone: "danger"  },
};

const TONE_DOT: Record<BadgeTone, string | undefined> = {
  neutral: undefined,
  active: "var(--status-warn)",
  danger: "var(--status-error)",
  success: "var(--status-online)",
};

export default async function VoiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: voice } = await supabase
    .from("voices")
    .select(
      "id, name, status, duration_seconds, raw_audio_paths, lora_path, reference_audio_path, error_message, created_at, trained_at",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!voice) notFound();

  const badge =
    STATUS_BADGE[voice.status as VoiceStatus] ??
    { label: voice.status, tone: "neutral" as const };
  const fileCount = Array.isArray(voice.raw_audio_paths)
    ? voice.raw_audio_paths.length
    : 0;

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <header className="glow-voice relative -mx-6 -mt-6 flex flex-col gap-3 px-6 pb-2 pt-6">
        <Eyebrow>Voz</Eyebrow>
        <h1 className="font-sans text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] text-[var(--ink)]">
          {voice.name}
        </h1>
        <div className="flex items-center gap-3">
          <Badge
            variant="soft"
            dot={!!TONE_DOT[badge.tone]}
            dotColor={TONE_DOT[badge.tone]}
          >
            {badge.label}
          </Badge>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          icon={<Mic2 className="h-5 w-5" />}
          label="Arquivos"
          value={String(fileCount)}
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Duração total"
          value={voice.duration_seconds ? formatDuration(voice.duration_seconds) : "—"}
        />
        <div className="relative flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
          <span className="text-[var(--silver)]">
            {voice.status === "ready" ? (
              <Check className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ash)]">
            Modelo
          </span>
          <span className="font-sans text-lg font-semibold leading-tight text-[var(--ink)]">
            {voice.status === "ready" && voice.lora_path ? "Voz treinada" : "—"}
          </span>
          <div className="absolute right-1 top-1">
            <VoiceRowMenu
              voiceId={voice.id}
              voiceName={voice.name}
              hasLora={voice.status === "ready" && !!voice.lora_path}
            />
          </div>
        </div>
      </section>

      {voice.status === "failed" && <SupportError action="treinar esta voz" />}

      <VoiceStatusPanel
        voiceId={voice.id}
        initialStatus={voice.status as VoiceStatus}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5">
      <span className="text-[var(--silver)]">{icon}</span>
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ash)]">
        {label}
      </span>
      <span className="font-sans text-lg font-semibold leading-tight text-[var(--ink)]">
        {value}
      </span>
    </div>
  );
}
