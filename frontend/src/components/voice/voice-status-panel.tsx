"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { VoiceStatus } from "@/lib/db/types";
import { PaywallModal } from "@/components/app/paywall-modal";

type Props = {
  voiceId: string;
  initialStatus: VoiceStatus;
};

// Statuses that should poll for updates
const POLLING_STATUSES: VoiceStatus[] = ["uploading", "validating", "training"];
const POLL_MS = 5000;

const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none";

export function VoiceStatusPanel({ voiceId, initialStatus }: Props) {
  const t = useTranslations("voice");
  const router = useRouter();
  const [status, setStatus] = useState<VoiceStatus>(initialStatus);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [paywallDetail, setPaywallDetail] = useState<string | null>(null);

  useEffect(() => {
    if (!POLLING_STATUSES.includes(status)) return;

    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/voices/${voiceId}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const newStatus = json.voice.status as VoiceStatus;
        if (newStatus !== status) {
          setStatus(newStatus);
          router.refresh();
        }
      } catch {
        /* ignore network blip */
      }
    }, POLL_MS);

    return () => clearInterval(id);
  }, [voiceId, status, router]);

  async function startTraining() {
    setTraining(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/voices/${voiceId}/start-training`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.status === 402) {
        setSubscribed(Boolean(json?.error?.details?.subscribed));
        setPaywallDetail(json?.error?.message ?? null);
        setNoCredits(true);
        setTraining(false);
        return;
      }
      if (!res.ok) {
        setError(json?.error?.message || t("panel.startError"));
        setTraining(false);
        return;
      }
      setStatus("training");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.networkError"));
      setTraining(false);
    }
  }

  if (status === "awaiting_training") {
    return (
      <>
      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <h2 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {t("panel.awaitingTitle")}
        </h2>
        <p className="text-sm text-[var(--body)]">
          {t("panel.awaitingBody")}
        </p>
        {error && (
          <p className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-deep)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={startTraining}
          disabled={training}
          className={`${PILL} w-fit`}
        >
          {training ? t("panel.starting") : t("panel.start")}
        </button>
      </section>
      <PaywallModal
        open={noCredits}
        onClose={() => setNoCredits(false)}
        subscribed={subscribed}
        action={t("panel.paywallAction")}
        detail={paywallDetail}
      />
      </>
    );
  }

  if (status === "rejected_too_short") {
    return (
      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <p className="text-sm text-[var(--ink)]">
          {t("panel.rejectedBody")}
        </p>
        <Link
          href="/app/voice-cloning/new"
          className={`${PILL} w-fit`}
        >
          {t("panel.rejectedCta")}
        </Link>
      </section>
    );
  }

  if (status === "ready") {
    return (
      <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-bright)] bg-[var(--surface-elevated)] p-6">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          <span className="text-[var(--status-online)]">✓</span> {t("panel.readyTitle")}
        </h2>
        <p className="text-sm text-[var(--body)]">
          {t("panel.readyBody")}
        </p>
        <VoiceSamplePlayer voiceId={voiceId} />
        <Link
          href={`/app/voice-cloning/${voiceId}/generate`}
          className={`${PILL} w-fit`}
        >
          {t("panel.readyCta")}
        </Link>
      </section>
    );
  }

  if (status === "failed") {
    return (
      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] p-6">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {t("panel.failedTitle")}
        </h2>
        <VoiceErrorMessage voiceId={voiceId} />
        <Link href="/app/voice-cloning/new" className={`${PILL} w-fit`}>
          {t("panel.failedCta")}
        </Link>
      </section>
    );
  }

  if (POLLING_STATUSES.includes(status)) {
    return (
      <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <p className="flex items-center gap-2 font-mono text-[12px] tracking-wide text-[var(--silver)]">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-[var(--radius-full)] bg-[var(--status-warn)]" />
          {status === "training" ? t("panel.training") : t("panel.waiting")}
        </p>
        <p className="text-sm text-[var(--mute)]">
          {status === "training"
            ? t("panel.trainingBody", { s: POLL_MS / 1000 })
            : t("panel.waitingBody", { s: POLL_MS / 1000 })}
        </p>
      </section>
    );
  }

  return null;
}

/** Amostra automática gerada no fim do treino (linha "Amostra automática" em
 *  generations). Se não existir (treino antigo / falhou best-effort), some. */
function VoiceSamplePlayer({ voiceId }: { voiceId: string }) {
  const t = useTranslations("voice");
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/v1/generations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const rows = (j?.generations ?? []) as Array<{
          voice_id: string;
          name: string | null;
          audio_url?: string | null;
          status: string;
        }>;
        const sample = rows.find(
          (g) => g.voice_id === voiceId && g.name === "Amostra automática" && g.status === "ready",
        );
        setUrl(sample?.audio_url ?? null);
      })
      .catch(() => {});
  }, [voiceId]);
  if (!url) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]">
        {t("panel.sampleLabel")}
      </span>
      <audio src={url} controls preload="metadata" className="w-full max-w-md" />
    </div>
  );
}

/** Mensagem de erro amigável da voz (ex.: áudio útil insuficiente + estorno). */
function VoiceErrorMessage({ voiceId }: { voiceId: string }) {
  const t = useTranslations("voice");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/v1/voices/${voiceId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMsg(j?.voice?.error_message ?? null))
      .catch(() => {});
  }, [voiceId]);
  return (
    <p className="text-sm text-[var(--body)]">
      {msg || t("panel.failedFallback")}
    </p>
  );
}
