"use client";

/**
 * Decide qual wizard renderizar pra /videos/[id] a partir do `kind` do projeto:
 *   story → VideoWizard (Vídeo História)
 *   sales → SalesSetup enquanto rascunho sem áudio; depois que a voz existir,
 *           o projeto converge pro MESMO pipeline (cenas/imagens/vídeos/final)
 *           e cai no VideoWizard.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { VideoWizard } from "@/components/video/video-wizard";
import { SalesSetup } from "@/components/video/sales-setup";

type Head = { kind: "story" | "sales"; audio_path: string | null; sem_narracao: boolean };

export function ProjectSwitch({ projectId, locale }: { projectId: string; locale: string }) {
  const tc = useTranslations("videoWizard.common");
  const [head, setHead] = useState<Head | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/v1/videos/${projectId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(tc("projectNotFound"));
        const json = await res.json();
        setHead({
          kind: (json.project?.kind as Head["kind"]) ?? "story",
          audio_path: (json.project?.audio_path as string | null) ?? null,
          sem_narracao: json.project?.sem_narracao === true,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : tc("error"));
      }
    })();
  }, [projectId, tc]);

  if (error) {
    return <p className="text-sm text-[var(--status-error)]">{error}</p>;
  }
  if (!head) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--silver)]" />
        <p className="font-mono text-[12px] tracking-wide text-[var(--mute)]">{tc("loadingProject")}</p>
      </section>
    );
  }

  // Sem áudio, o projeto fica na tela de montagem — a não ser que a pessoa
  // tenha ESCOLHIDO seguir sem narração (19/08). São situações opostas que o
  // `audio_path` vazio não separa: "ainda não gravei" × "não quero voz".
  if (head.kind === "sales" && !head.audio_path && !head.sem_narracao) {
    return <SalesSetup locale={locale} projectId={projectId} />;
  }
  return <VideoWizard projectId={projectId} />;
}
