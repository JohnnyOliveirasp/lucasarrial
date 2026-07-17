"use client";

/**
 * "Explorar" — catálogo de Vozes Prontas estilo ElevenLabs: cards com avatar
 * (play/pause da amostra no próprio avatar), nome de pessoa, descrição curta e
 * bandeira do país + idioma. Filtro por idioma em pills.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Play, Pause } from "lucide-react";
import { Flag, flagFor } from "@/components/voice/voice-flags";

export type StockVoice = {
  id: string;
  name: string;
  language: string; // "pt" | "es" | "en"
  accent?: string | null; // ex.: "pt-PT" (muda a bandeira)
  description?: string | null;
  sample_url: string | null;
};

const LANGS = ["all", "pt", "es", "en"] as const;

// Tons do avatar por voz (determinístico pelo nome) — paleta discreta do DS.
const AVATAR_HUES = [18, 205, 265, 150, 330, 45];
function avatarStyle(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 997;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  return {
    background: `linear-gradient(135deg, hsl(${hue} 45% 28%), hsl(${(hue + 40) % 360} 50% 16%))`,
  };
}

export function StockVoices({ voices }: { voices: StockVoice[] }) {
  const t = useTranslations("app.voiceCloning");
  const [lang, setLang] = useState<(typeof LANGS)[number]>("all");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  function toggle(v: StockVoice) {
    if (!v.sample_url) return;
    if (playingId === v.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(v.sample_url);
    audio.onended = () => setPlayingId((cur) => (cur === v.id ? null : cur));
    audio.onerror = () => setPlayingId((cur) => (cur === v.id ? null : cur));
    audioRef.current = audio;
    void audio.play();
    setPlayingId(v.id);
  }

  const filtered = lang === "all" ? voices : voices.filter((v) => v.language === lang);
  const available = new Set(voices.map((v) => v.language));

  return (
    <section className="flex flex-col gap-4">
      {/* Filtro de idioma — só mostra opções que existem no catálogo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {LANGS.filter((l) => l === "all" || available.has(l)).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={[
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                lang === l
                  ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)] text-[var(--ink)]"
                  : "border-[var(--hairline)] text-[var(--mute)] hover:text-[var(--ink)]",
              ].join(" ")}
            >
              {t(`stockLang.${l}`)}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((v) => (
          <li
            key={v.id}
            className="group flex flex-col gap-4 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5 transition-[border-color] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)]"
          >
            <div className="flex items-start gap-3.5">
              {/* Avatar = player: play/pause da amostra direto no círculo */}
              <button
                type="button"
                onClick={() => toggle(v)}
                disabled={!v.sample_url}
                aria-label={playingId === v.id ? t("stockPause", { name: v.name }) : t("stockPlay", { name: v.name })}
                className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full text-white transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-40"
                style={avatarStyle(v.name)}
              >
                {playingId === v.id ? (
                  <Pause className="h-4.5 w-4.5 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-4.5 w-4.5 fill-current" />
                )}
              </button>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-sans text-base font-semibold leading-tight tracking-[-0.01em] text-[var(--ink)]">
                  {v.name}
                </span>
                <span className="line-clamp-2 text-xs leading-snug text-[var(--mute)]">
                  {v.description ?? ""}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-2.5 py-1 text-[11px] font-medium text-[var(--mute)]">
                <Flag code={flagFor(v.language, v.accent)} className="rounded-[2px]" />
                {v.accent === "pt-PT" ? t("stockLang.ptPT") : t(`stockLang.${v.language}`)}
              </span>
              <Link
                href={`/app/voice-cloning/${v.id}/generate`}
                className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius)] bg-[var(--pill-bg)] px-3.5 font-sans text-[12px] font-medium text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]"
              >
                {t("pickVoiceCta")}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[11px] leading-relaxed text-[var(--ash)]">{t("stockCredit")}</p>
    </section>
  );
}
