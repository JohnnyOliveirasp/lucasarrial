import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Mic2, Clock, Check, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/audio/duration";
import type { VoiceStatus } from "@/lib/db/types";
import { R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { VoiceStatusPanel } from "@/components/voice/voice-status-panel";
import { VoiceRowMenu } from "@/components/voice/voice-row-menu";
import { VoiceReferenceManager } from "@/components/voice/voice-reference-manager";
import { SupportError } from "@/components/ui/support-error";

const STATUS_BADGE: Record<VoiceStatus, { label: string; tone: "neutral" | "accent" | "danger" | "success" }> = {
  uploading:           { label: "Subindo áudios",        tone: "neutral" },
  validating:          { label: "Validando",             tone: "neutral" },
  awaiting_training:   { label: "Pronta pra treinar",    tone: "accent"  },
  rejected_too_short:  { label: "Rejeitado — < 20min",   tone: "danger"  },
  training:            { label: "Treinando…",            tone: "accent"  },
  ready:               { label: "✓ Pronta",              tone: "success" },
  failed:              { label: "Falhou",                tone: "danger"  },
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

  const badge = STATUS_BADGE[voice.status as VoiceStatus] ?? { label: voice.status, tone: "neutral" as const };
  const fileCount = Array.isArray(voice.raw_audio_paths) ? voice.raw_audio_paths.length : 0;

  // Presigned GET pra tocar a referência salva (quando houver). Best-effort.
  let referenceUrl: string | null = null;
  if (voice.reference_audio_path) {
    referenceUrl = await createPresignedGet(
      R2_BUCKETS.voices,
      voice.reference_audio_path,
      3600,
    ).catch(() => null);
  }

  return (
    <div className="flex flex-col gap-10 max-w-3xl">
      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Voz
        </span>
        <h1 className="font-display text-5xl leading-[0.9] tracking-tight text-fg uppercase">
          {voice.name}
        </h1>
        <div className="flex items-center gap-3">
          <span
            className={[
              "font-mono text-[11px] uppercase tracking-[0.18em] px-2 py-1 border",
              badge.tone === "accent"
                ? "border-accent bg-accent/5 text-accent"
                : badge.tone === "success"
                ? "border-fg bg-fg text-bg"
                : badge.tone === "danger"
                ? "border-accent bg-accent text-accent-fg"
                : "border-border bg-surface text-muted-fg",
            ].join(" ")}
          >
            {badge.label}
          </span>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-px bg-border md:grid-cols-3">
        <Stat icon={<Mic2 className="h-5 w-5" />} label="Arquivos" value={String(fileCount)} />
        <Stat
          icon={<Clock className="h-5 w-5" />}
          label="Duração total"
          value={voice.duration_seconds ? formatDuration(voice.duration_seconds) : "—"}
        />
        <div className="relative bg-bg p-5 flex flex-col gap-2">
          <span className="text-muted-fg">
            {voice.status === "ready" ? <Check className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
            Modelo
          </span>
          <span className="font-display text-2xl uppercase leading-none text-fg">
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

      {voice.status === "ready" && voice.lora_path && (
        <VoiceReferenceManager voiceId={voice.id} referenceUrl={referenceUrl} />
      )}

      <VoiceStatusPanel voiceId={voice.id} initialStatus={voice.status as VoiceStatus} />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-bg p-5 flex flex-col gap-2">
      <span className="text-muted-fg">{icon}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
        {label}
      </span>
      <span className="font-display text-2xl uppercase leading-none text-fg">
        {value}
      </span>
    </div>
  );
}
