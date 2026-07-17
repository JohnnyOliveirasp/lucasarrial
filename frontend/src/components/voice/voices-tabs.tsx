"use client";

/**
 * Abas do Gerar Áudio (estilo ElevenLabs): "Minhas Vozes" | "Explorar".
 * Minhas Vozes = vozes treinadas pelo aluno; Explorar = catálogo Vozes Prontas.
 * Sem voz própria, abre direto no Explorar.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AudioLines, Compass, Mic } from "lucide-react";
import { Badge } from "@/components/ui";
import { StockVoices, type StockVoice } from "@/components/voice/stock-voices";

export type MyVoice = { id: string; name: string; created_at: string };

export function VoicesTabs({
  myVoices,
  stock,
  locale,
}: {
  myVoices: MyVoice[];
  stock: StockVoice[];
  locale: string;
}) {
  const t = useTranslations("app.voiceCloning");
  const [tab, setTab] = useState<"mine" | "explore">(myVoices.length > 0 ? "mine" : "explore");

  const tabs = [
    { key: "mine" as const, label: t("tabMyVoices"), icon: Mic },
    { key: "explore" as const, label: t("tabExplore"), icon: Compass },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-[var(--hairline)]">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 font-sans text-[13px] font-medium transition-colors",
              tab === key
                ? "border-[var(--ink)] text-[var(--ink)]"
                : "border-transparent text-[var(--mute)] hover:text-[var(--ink)]",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "mine" ? (
        myVoices.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {myVoices.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/app/voice-cloning/${v.id}/generate`}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-5 py-4 transition-[border-color] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)]"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-sans text-base font-medium leading-tight text-[var(--ink)]">
                      {v.name}
                    </span>
                    <span className="text-xs text-[var(--ash)]">
                      {new Date(v.created_at).toLocaleDateString(locale)}
                    </span>
                  </div>
                  <Badge variant="soft">{t("pickVoiceCta")}</Badge>
                  <span className="text-[var(--mute)]" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <section className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center">
            <AudioLines className="h-10 w-10 text-[var(--ash)]" />
            <p className="text-sm text-[var(--mute)]">{t("generateAudioEmpty")}</p>
            <Link
              href="/app/voice-cloning"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
            >
              {t("createButton")}
            </Link>
          </section>
        )
      ) : (
        <StockVoices voices={stock} />
      )}
    </div>
  );
}
