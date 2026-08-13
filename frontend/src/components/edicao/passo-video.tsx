"use client";

/**
 * 🚧 Vídeo Edição 2.0 — E3 Vídeo base (W3 da spec 11/08).
 * Pergunta: CENAS ou CLONE?
 *  - Cenas: motor do Estúdio — chega na fase W4 (placeholder honesto).
 *  - Clone: duas opções, ambas recebendo o áudio da E2 —
 *    · Padrão 2.0 (nosso InfiniteTalk, 105 cr/s) — fluxo da tela video-clone.
 *    · HeyGen (BYOK) — a tela atual inteira, só com a fonte de áudio travada.
 * Regra da spec: o wizard NÃO reinventa — reusa telas/APIs existentes.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clapperboard, UserRound } from "lucide-react";
import { HeygenConnect } from "@/components/lab/heygen-connect";
import type { EdicaoDraft, VideoSel } from "./edicao-wizard";
import { ClonePadrao } from "./clone-padrao";
import { PassoCenas } from "./passo-cenas";

type Props = {
  draft: EdicaoDraft;
  onChange: (patch: Partial<EdicaoDraft>) => void;
  /** Graduação 13/08: HeyGen (BYOK em validação) só aparece pra admin. */
  admin?: boolean;
};

export function PassoVideo({ draft, onChange, admin = false }: Props) {
  const t = useTranslations("edicao.video");
  const [caminho, setCaminho] = useState<"cenas" | "clone" | null>(
    draft.video?.kind === "cenas" || draft.cenasProjectId
      ? "cenas"
      : draft.video
        ? "clone"
        : null,
  );
  const [opcao, setOpcao] = useState<"padrao" | "heygen" | null>(
    draft.video?.kind === "clone-padrao" ? "padrao" : draft.video?.kind === "clone-heygen" ? "heygen" : null,
  );

  const escolher = (v: VideoSel | null) => onChange({ video: v });

  // Sem áudio da E2 não há o que fazer aqui (o gate do wizard já impede,
  // mas rascunho antigo/limpo pode chegar assim).
  if (!draft.audio) {
    return (
      <p className="rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-[13px] text-[var(--mute)]">
        {t("semAudio")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cenas × Clone */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(["cenas", "clone"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCaminho(c)}
            className={[
              "rounded-[var(--radius)] border p-4 text-left",
              caminho === c
                ? "border-[var(--ink)]"
                : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]",
            ].join(" ")}
          >
            <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
              {c === "cenas" ? <Clapperboard className="size-4" /> : <UserRound className="size-4" />}
              {t(`caminhos.${c}.titulo`)}
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--mute)]">{t(`caminhos.${c}.corpo`)}</p>
          </button>
        ))}
      </div>

      {draft.video && (
        <p className="rounded-[var(--radius-sm)] border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">
          {t("escolhido", { label: draft.video.label })}
        </p>
      )}

      {caminho === "cenas" && <PassoCenas draft={draft} onChange={onChange} escolher={escolher} />}

      {caminho === "clone" && (
        <>
          {/* Padrão 2.0 × HeyGen (HeyGen só pra admin até o BYOK validar) */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(admin ? (["padrao", "heygen"] as const) : (["padrao"] as const)).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOpcao(o)}
                className={[
                  "rounded-[var(--radius-sm)] border px-4 py-3 text-left",
                  opcao === o
                    ? "border-[var(--ink)]"
                    : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]",
                ].join(" ")}
              >
                <p className="text-[13.5px] font-semibold text-[var(--ink)]">{t(`cloneOpcoes.${o}.titulo`)}</p>
                <p className="mt-0.5 text-[12px] text-[var(--mute)]">{t(`cloneOpcoes.${o}.corpo`)}</p>
              </button>
            ))}
          </div>

          {opcao === "padrao" && (
            <ClonePadrao audio={draft.audio} selecionado={draft.video} escolher={escolher} />
          )}

          {opcao === "heygen" && (
            <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
              <p className="mb-3 rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-[12.5px] text-[var(--mute)]">
                {t("heygen.audioTravado", { label: draft.audio.label })}
              </p>
              <HeygenConnect
                presetAudio={
                  draft.audio.kind === "generation"
                    ? { kind: "generation", id: draft.audio.id }
                    : { kind: "take", key: draft.audio.key }
                }
                presetAudioLabel={draft.audio.label}
                onVideoReady={(v) =>
                  escolher({ kind: "clone-heygen", id: v.id, label: t("heygen.labelVideo") })
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
