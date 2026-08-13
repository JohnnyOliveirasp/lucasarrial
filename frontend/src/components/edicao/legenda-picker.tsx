"use client";

/**
 * Seletor de ESTILO de legenda da estação Editar (13/08) — mesma galeria de
 * presets do Vídeo História (preview com as fontes reais via @font-face),
 * incluindo "Sem legenda". Posição e tamanho aparecem só com legenda ativa.
 */
import { useTranslations } from "next-intl";
import { Type, AlignVerticalSpaceAround, CaseSensitive } from "lucide-react";
import {
  SUBTITLE_PRESETS,
  getSubtitlePreset,
  type SubtitlePosition,
  type SubtitleSize,
} from "@/lib/video/subtitle-presets";

/** @font-face das fontes de legenda (mesmos TTFs que o worker queima). */
const FONT_FACES = `
@font-face { font-family: 'Montserrat Black'; src: url('/assets/subtitle-fonts/Montserrat-Black.ttf') format('truetype'); font-display: swap; }
@font-face { font-family: 'Luckiest Guy'; src: url('/assets/subtitle-fonts/LuckiestGuy-Regular.ttf') format('truetype'); font-display: swap; }
@font-face { font-family: 'Archivo Black'; src: url('/assets/subtitle-fonts/ArchivoBlack-Regular.ttf') format('truetype'); font-display: swap; }
@font-face { font-family: 'Anton'; src: url('/assets/subtitle-fonts/Anton-Regular.ttf') format('truetype'); font-display: swap; }
@font-face { font-family: 'Poppins SemiBold'; src: url('/assets/subtitle-fonts/Poppins-SemiBold.ttf') format('truetype'); font-display: swap; }
@font-face { font-family: 'Bangers'; src: url('/assets/subtitle-fonts/Bangers-Regular.ttf') format('truetype'); font-display: swap; }
`;

const POSITIONS: SubtitlePosition[] = ["bottom", "center", "top"];
const SIZES: SubtitleSize[] = ["normal", "large"];

export function LegendaPicker({
  value,
  onChange,
  position,
  onPosition,
  size,
  onSize,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  position: SubtitlePosition | null;
  onPosition: (p: SubtitlePosition) => void;
  size: SubtitleSize | null;
  onSize: (s: SubtitleSize) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("edicao.editar.legendaPicker");
  const preset = getSubtitlePreset(value);
  const effectivePosition = position ?? preset.defaultPosition;
  const effectiveSize: SubtitleSize = size ?? "normal";

  return (
    <div className="flex flex-col gap-3">
      <style dangerouslySetInnerHTML={{ __html: FONT_FACES }} />

      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ash)]">
          <Type className="size-3.5" /> {t("estilo")}
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SUBTITLE_PRESETS.map((s) => {
            const active = value === s.id;
            const words = s.css.uppercase
              ? [t("previewA").toUpperCase(), t("previewB").toUpperCase()]
              : [t("previewA"), t("previewB")];
            return (
              <button
                key={s.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(s.id)}
                aria-pressed={active}
                className={[
                  "flex flex-col gap-1.5 rounded-[var(--radius)] border p-2.5 text-left transition-colors disabled:opacity-50",
                  active
                    ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)]"
                    : "border-[var(--hairline-strong)] bg-[var(--surface-card)] hover:border-[var(--hairline-bright)]",
                ].join(" ")}
              >
                <span
                  className="flex h-12 items-center justify-center gap-1 overflow-hidden rounded-[var(--radius-sm)] px-1 text-[12px] leading-none"
                  style={{ background: "#141414" }}
                >
                  {s.id === "none" ? (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--ash)]">
                      {t("semLegenda")}
                    </span>
                  ) : (
                    <>
                      <span
                        style={{
                          fontFamily: s.css.fontFamily,
                          color: s.css.activeColor ?? s.css.color,
                          textShadow: s.css.textShadow,
                          background: s.css.background,
                          padding: s.css.background ? "2px 4px" : undefined,
                        }}
                      >
                        {words[0]}
                      </span>
                      <span
                        style={{
                          fontFamily: s.css.fontFamily,
                          color: s.css.color,
                          textShadow: s.css.textShadow,
                          background: s.css.background,
                          padding: s.css.background ? "2px 4px" : undefined,
                        }}
                      >
                        {words[1]}
                      </span>
                    </>
                  )}
                </span>
                <span className="font-sans text-[11.5px] font-medium leading-tight text-[var(--ink)]">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {value !== "none" && (
        <div className="flex flex-wrap gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ash)]">
              <AlignVerticalSpaceAround className="size-3.5" /> {t("posicao")}
            </span>
            <div className="flex gap-1.5">
              {POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPosition(p)}
                  aria-pressed={effectivePosition === p}
                  className={[
                    "rounded-[var(--radius-sm)] border px-3 py-1.5 text-[12px] disabled:opacity-50",
                    effectivePosition === p
                      ? "border-[var(--ink)] text-[var(--ink)]"
                      : "border-[var(--hairline)] text-[var(--mute)]",
                  ].join(" ")}
                >
                  {t(`posicoes.${p}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ash)]">
              <CaseSensitive className="size-3.5" /> {t("tamanho")}
            </span>
            <div className="flex gap-1.5">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSize(s)}
                  aria-pressed={effectiveSize === s}
                  className={[
                    "rounded-[var(--radius-sm)] border px-3 py-1.5 text-[12px] disabled:opacity-50",
                    effectiveSize === s
                      ? "border-[var(--ink)] text-[var(--ink)]"
                      : "border-[var(--hairline)] text-[var(--mute)]",
                  ].join(" ")}
                >
                  {t(`tamanhos.${s}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
