"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { VoiceStatus } from "@/lib/db/types";
import { PaywallModal } from "@/components/app/paywall-modal";

type Props = {
  voiceId: string;
  initialStatus: VoiceStatus;
};

// Statuses that should poll for updates
const POLLING_STATUSES: VoiceStatus[] = ["uploading", "validating", "training"];
const POLL_MS = 5000;

export function VoiceStatusPanel({ voiceId, initialStatus }: Props) {
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
        setError(json?.error?.message || "Falha ao iniciar treinamento");
        setTraining(false);
        return;
      }
      setStatus("training");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede");
      setTraining(false);
    }
  }

  if (status === "awaiting_training") {
    return (
      <>
      <section className="border border-accent bg-accent/5 p-6 flex flex-col gap-4">
        <h2 className="font-display text-2xl uppercase tracking-tight text-fg">
          Pronta para treinar
        </h2>
        <p className="text-sm text-muted-fg">
          Áudios validados e armazenados no R2. Clique abaixo pra disparar o treinamento
          no RunPod (~15-30min). Você pode fechar a aba — a UI atualiza sozinha.
        </p>
        {error && (
          <p className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={startTraining}
          disabled={training}
          className="bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-fg hover:text-bg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 w-fit"
        >
          {training ? "Disparando…" : "Iniciar treinamento"}
        </button>
      </section>
      <PaywallModal
        open={noCredits}
        onClose={() => setNoCredits(false)}
        subscribed={subscribed}
        action="clonar a sua voz"
        detail={paywallDetail}
      />
      </>
    );
  }

  if (status === "rejected_too_short") {
    return (
      <section className="border border-border bg-surface p-6 flex flex-col gap-3">
        <p className="text-sm text-fg">
          Esses áudios não atingem o mínimo de 20 minutos. Suba mais áudio numa nova voz.
        </p>
        <Link
          href="/app/voice-cloning/new"
          className="bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-fg hover:text-bg active:scale-[0.99] w-fit"
        >
          + Treinar nova voz
        </Link>
      </section>
    );
  }

  if (status === "ready") {
    return (
      <section className="border border-fg bg-fg p-6 flex flex-col gap-4 text-bg">
        <h2 className="font-display text-2xl uppercase tracking-tight">
          ✓ Voz pronta
        </h2>
        <p className="text-sm opacity-80">
          LoRA treinada e armazenada. Agora você pode gerar áudio com qualquer texto.
        </p>
        <Link
          href={`/app/voice-cloning/${voiceId}/generate`}
          className="bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-bg hover:text-fg active:scale-[0.99] w-fit"
        >
          Gerar áudio →
        </Link>
      </section>
    );
  }

  if (POLLING_STATUSES.includes(status)) {
    return (
      <section className="border border-dashed border-border bg-surface p-6 flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {status === "training" ? "Treinando…" : "Aguardando…"}
        </p>
        <p className="text-sm text-muted-fg">
          {status === "training"
            ? `Pipeline rodando no RunPod (~15-30min). Atualizando a cada ${POLL_MS / 1000}s.`
            : `Atualizando a cada ${POLL_MS / 1000}s.`}
        </p>
      </section>
    );
  }

  return null;
}
