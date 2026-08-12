"use client";

/**
 * 🚧 Vídeo Edição 2.0 — casca do wizard (W0 da spec 11/08).
 * 5 estações lineares, navegável pra FRENTE e pra TRÁS; rascunho persiste em
 * localStorage (nenhum job de servidor até a E2, então não precisa de tabela).
 * W1 = estação Roteiro funcional; E2-E5 entram nas fases W2-W6.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { PassoRoteiro } from "./passo-roteiro";
import { PassoAudio } from "./passo-audio";
import { PassoVideo } from "./passo-video";
import { PassoEditar } from "./passo-editar";

const DRAFT_KEY = "fc-edicao-draft-v1";
const PASSOS = ["roteiro", "audio", "video", "editar", "saida"] as const;
export type PassoId = (typeof PASSOS)[number];

/** Áudio escolhido na E2: geração TTS pronta OU take gravado no mic. */
export type AudioSel =
  | { kind: "generation"; id: string; label: string }
  | { kind: "take"; key: string; label: string };

/** Vídeo base pronto na E3 (W3 = caminhos de clone; W4 = cenas do Estúdio). */
export type VideoSel =
  | { kind: "clone-padrao"; id: string; label: string }
  | { kind: "clone-heygen"; id: string; label: string }
  | { kind: "cenas"; id: string; label: string };

export type EdicaoDraft = {
  passo: number;
  roteiro: string;
  roteiroId: string | null;
  seconds: number;
  audio: AudioSel | null;
  video: VideoSel | null;
  /** Projeto do Estúdio criado pelo caminho Cenas (retoma poll após reload). */
  cenasProjectId: string | null;
  /** W5: job de legenda do clone em voo (retoma poll após reload). */
  captionJob: { job: string; key: string } | null;
  /** W5: projeto do Estúdio do b-roll do clone + job de overlay em voo. */
  brollProjectId: string | null;
  brollJob: { job: string; key: string } | null;
  /** W5: key R2 do vídeo editado (b-roll e/ou legenda) — a E5 prefere ele. */
  videoEditadoKey: string | null;
};

const VAZIO: EdicaoDraft = {
  passo: 0,
  roteiro: "",
  roteiroId: null,
  seconds: 60,
  audio: null,
  video: null,
  cenasProjectId: null,
  captionJob: null,
  brollProjectId: null,
  brollJob: null,
  videoEditadoKey: null,
};

export function EdicaoWizard() {
  const t = useTranslations("edicao");
  const [draft, setDraft] = useState<EdicaoDraft>(VAZIO);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft({ ...VAZIO, ...(JSON.parse(raw) as Partial<EdicaoDraft>) });
    } catch {
      /* rascunho corrompido: começa limpo */
    }
    setLoaded(true);
  }, []);

  const update = useCallback((patch: Partial<EdicaoDraft>) => {
    setDraft((d) => {
      const novo = { ...d, ...patch };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(novo));
      } catch {
        /* storage cheio/indisponível — segue em memória */
      }
      return novo;
    });
  }, []);

  if (!loaded) return null;

  // Gate de avanço por estação: E1 exige roteiro; E2 exige áudio escolhido;
  // E3 exige o vídeo base pronto. E4-E5 destravan nas fases W5-W6.
  const podeAvancar =
    draft.passo === 0
      ? draft.roteiro.trim().length > 0
      : draft.passo === 1
        ? draft.audio !== null
        : draft.passo === 2
          ? draft.video !== null
          : draft.passo < PASSOS.length - 1;

  return (
    <div className="flex flex-col gap-5">
      {/* Trilho das estações */}
      <ol className="flex flex-wrap items-center gap-1.5">
        {PASSOS.map((id, i) => {
          const feito = i < draft.passo;
          const ativo = i === draft.passo;
          return (
            <li key={id} className="flex items-center gap-1.5">
              {i > 0 && <span className="h-px w-4 bg-[var(--hairline-strong)]" aria-hidden />}
              <button
                type="button"
                onClick={() => i < draft.passo && update({ passo: i })}
                disabled={i > draft.passo}
                className={[
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px]",
                  ativo
                    ? "border-[var(--ink)] text-[var(--ink)]"
                    : feito
                      ? "border-[var(--hairline-strong)] text-[var(--mute)] hover:text-[var(--ink)]"
                      : "border-[var(--hairline)] text-[var(--ash)]",
                ].join(" ")}
              >
                {feito ? (
                  <Check className="size-3.5 text-emerald-400" />
                ) : (
                  <span className="font-mono text-[11px]">{i + 1}</span>
                )}
                {t(`passos.${id}`)}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Estação atual */}
      {draft.passo === 0 ? (
        <PassoRoteiro draft={draft} onChange={update} />
      ) : draft.passo === 1 ? (
        <PassoAudio draft={draft} onChange={update} />
      ) : draft.passo === 2 ? (
        <PassoVideo draft={draft} onChange={update} />
      ) : draft.passo === 3 ? (
        <PassoEditar draft={draft} onChange={update} />
      ) : (
        <EmConstrucao id={PASSOS[draft.passo]} />
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between border-t border-[var(--hairline)] pt-4">
        <button
          type="button"
          onClick={() => update({ passo: Math.max(0, draft.passo - 1) })}
          disabled={draft.passo === 0}
          className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3.5 py-2 text-[13px] text-[var(--ink)] disabled:opacity-35"
        >
          <ChevronLeft className="size-4" /> {t("voltar")}
        </button>
        <button
          type="button"
          onClick={() => update({ passo: Math.min(PASSOS.length - 1, draft.passo + 1) })}
          disabled={!podeAvancar}
          className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-35"
        >
          {t("avancar")} <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Placeholder honesto das estações que as fases W2+ vão construir. */
function EmConstrucao({ id }: { id: PassoId }) {
  const t = useTranslations("edicao");
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6 text-center">
      <p className="text-[14px] font-medium text-[var(--ink)]">{t(`passos.${id}`)}</p>
      <p className="mt-1 text-[13px] text-[var(--mute)]">{t(`emBreve.${id}`)}</p>
    </div>
  );
}
