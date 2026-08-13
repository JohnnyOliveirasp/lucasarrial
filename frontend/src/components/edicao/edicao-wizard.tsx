"use client";

/**
 * 🚧 Vídeo Edição 2.0 — casca do wizard (W0 da spec 11/08).
 * 5 estações lineares, navegável pra FRENTE e pra TRÁS; rascunho persiste em
 * localStorage (nenhum job de servidor até a E2, então não precisa de tabela).
 * W6 fechou o ciclo: Roteiro → Áudio → Vídeo base → Edição → Saída.
 * TRAVAS pós-final (spec Johnny 13/08): com o vídeo final fechado, só Editar
 * e Saída ficam vivos (Áudio/Vídeo bloqueados — trocar não refaz nada);
 * clicar no Roteiro = começar vídeo NOVO, com confirmação antes de limpar
 * (o final já está salvo em "Vídeos gerados", nada se perde).
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { PassoRoteiro } from "./passo-roteiro";
import { PassoAudio } from "./passo-audio";
import { PassoVideo } from "./passo-video";
import { PassoEditar } from "./passo-editar";
import { PassoSaida } from "./passo-saida";
import { VideosGerados } from "./videos-gerados";

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
  /** Tema/link usados na geração — habilitam o "Gerar outro roteiro" (13/08). */
  roteiroIdeia: string | null;
  roteiroLink: string | null;
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
  /** Travas 13/08: vira true quando a Saída abre com vídeo — fecha E1-E3. */
  finalizado: boolean;
};

export const DRAFT_VAZIO: EdicaoDraft = {
  passo: 0,
  roteiro: "",
  roteiroId: null,
  roteiroIdeia: null,
  roteiroLink: null,
  seconds: 60,
  audio: null,
  video: null,
  cenasProjectId: null,
  captionJob: null,
  brollProjectId: null,
  brollJob: null,
  videoEditadoKey: null,
  finalizado: false,
};

export function EdicaoWizard() {
  const t = useTranslations("edicao");
  const [draft, setDraft] = useState<EdicaoDraft>(DRAFT_VAZIO);
  const [loaded, setLoaded] = useState(false);
  const [confirmaNovo, setConfirmaNovo] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft({ ...DRAFT_VAZIO, ...(JSON.parse(raw) as Partial<EdicaoDraft>) });
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

  // Trava 13/08: chegou na Saída com vídeo → ciclo fechado (E2-E3 travam).
  useEffect(() => {
    if (draft.passo === 4 && draft.video !== null && !draft.finalizado) {
      update({ finalizado: true });
    }
  }, [draft.passo, draft.video, draft.finalizado, update]);

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
          const ativo = i === draft.passo;
          // Travas pós-final: E2/E3 mortas; E4/E5 livres; E1 = recomeçar.
          const feito = draft.finalizado ? i >= 3 && !ativo : i < draft.passo;
          const bloqueado = draft.finalizado ? i === 1 || i === 2 : i > draft.passo;
          const recomecar = draft.finalizado && i === 0;
          return (
            <li key={id} className="flex items-center gap-1.5">
              {i > 0 && <span className="h-px w-4 bg-[var(--hairline-strong)]" aria-hidden />}
              <button
                type="button"
                onClick={() => {
                  if (recomecar) setConfirmaNovo(true);
                  else if (draft.finalizado && i >= 3) update({ passo: i });
                  else if (!draft.finalizado && i < draft.passo) update({ passo: i });
                }}
                disabled={bloqueado}
                className={[
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px]",
                  ativo
                    ? "border-[var(--ink)] text-[var(--ink)]"
                    : feito || recomecar
                      ? "border-[var(--hairline-strong)] text-[var(--mute)] hover:text-[var(--ink)]"
                      : "border-[var(--hairline)] text-[var(--ash)]",
                ].join(" ")}
              >
                {recomecar ? (
                  <RotateCcw className="size-3.5" />
                ) : feito ? (
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
        <PassoSaida draft={draft} onChange={update} />
      )}

      {/* Navegação */}
      <div className="flex items-center justify-between border-t border-[var(--hairline)] pt-4">
        <button
          type="button"
          onClick={() => update({ passo: Math.max(draft.finalizado ? 3 : 0, draft.passo - 1) })}
          disabled={draft.passo === 0 || (draft.finalizado && draft.passo <= 3)}
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

      {/* Histórico dos vídeos montados (Task #13, 13/08) — some se vazio. */}
      <VideosGerados />

      {/* Confirmação do "vídeo novo" (trava 2): limpar é seguro — o final já
          está em "Vídeos gerados" — mas clique acidental não pode zerar. */}
      {confirmaNovo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmaNovo(false)}
        >
          <div
            className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-[var(--ink)]" />
              <h3 className="text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
                {t("novoVideo.titulo")}
              </h3>
            </div>
            <p className="text-sm text-[var(--body)]">{t("novoVideo.texto")}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmaNovo(false)}
                className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
              >
                {t("novoVideo.cancelar")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmaNovo(false);
                  update({ ...DRAFT_VAZIO });
                }}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] bg-[var(--ink)] px-[18px] text-[14px] font-semibold text-[var(--surface-deep)]"
              >
                {t("novoVideo.confirmar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
