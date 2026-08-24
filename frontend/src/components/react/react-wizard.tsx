"use client";

/**
 * Wizard do **Video React** — você na frente comentando um viral.
 *
 * Desenho fechado com o Johnny em 14/08 ([[project-video-react-desenho]]):
 *   R0 vídeo · R1 avatar · R2 a LLM assiste e escreve · R3 roteiro + CTA ·
 *   R4 áudio · R5 layout · R6 saída
 *
 * Rascunho em localStorage, igual ao wizard de Edição — não há job de
 * servidor até a geração, então não precisa de tabela.
 *
 * Regras que vieram da conversa e não podem se perder:
 * - o vídeo sai da PRATELEIRA da pessoa (Meus Virais); vazia → manda garimpar
 * - gravar vídeo na hora está FORA (caro): upload, HeyGen ou clone
 * - o CTA é sempre o FIM e precisa de cena própria, senão a fala passa do
 *   tempo do viral
 */
import { useCallback, useEffect, useState } from "react";
import { ReactPassoVideo } from "./react-passo-video";
import { ReactPassoAvatar } from "./react-passo-avatar";
import { ReactPassoRoteiro } from "./react-passo-roteiro";
import { ReactPassoAjuste } from "./react-passo-ajuste";
import { ReactPassoAudio } from "./react-passo-audio";
import { ReactPassoLayout } from "./react-passo-layout";
import { ReactPassoSaida } from "./react-passo-saida";
import type { ReactDraft } from "./react-tipos";
import { DRAFT_VAZIO, PASSOS } from "./react-tipos";

const DRAFT_KEY = "fc-react-draft-v1";

export function ReactWizard() {
  const [draft, setDraft] = useState<ReactDraft>(DRAFT_VAZIO);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft({ ...DRAFT_VAZIO, ...(JSON.parse(raw) as ReactDraft) });
    } catch {
      /* rascunho corrompido: começa limpo */
    }
    setCarregado(true);
  }, []);

  const update = useCallback((mudanca: Partial<ReactDraft>) => {
    setDraft((atual) => {
      const novo = { ...atual, ...mudanca };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(novo));
      } catch {
        /* sem localStorage: o wizard segue, só não guarda */
      }
      return novo;
    });
  }, []);

  function recomecar() {
    // Depois de finalizado não há rascunho a perder: o vídeo já foi entregue e
    // está na lista abaixo. Perguntar aí é só um passo a mais no caminho.
    if (!draft.finalizado && !window.confirm("Começar um React do zero? O rascunho atual se perde.")) return;
    localStorage.removeItem(DRAFT_KEY);
    setDraft(DRAFT_VAZIO);
  }

  if (!carregado) return <p className="text-[14px] text-[var(--mute)]">Carregando…</p>;

  /**
   * O que cada passo exige pra liberar o "Continuar".
   * ⚠️ Faltavam 4/5/6 aqui: o áudio ficava pronto na tela e o botão seguia
   * morto (achado do Johnny, 14/08). Passo novo = linha nova nesta lista.
   */
  const EXIGE: Record<number, boolean> = {
    0: draft.viral !== null,
    1: draft.avatar !== null && draft.fotoPronta !== null,
    2: draft.roteiro.trim().length > 20,
    3: draft.roteiro.trim().length > 20,
    // Voz clonada: só depois do áudio pronto. Quem grava a própria voz sobe o
    // arquivo na montagem, então não trava aqui.
    4: draft.audioUrl !== null || draft.modoAudio === "gravar",
    5: draft.layout !== null,
  };
  const ultimo = draft.passo === PASSOS.length - 1;
  const podeAvancar = EXIGE[draft.passo] ?? false;

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap items-center gap-1.5">
        {PASSOS.map((p, i) => (
          <li key={p}>
            <button
              type="button"
              onClick={() => i <= draft.passo && update({ passo: i })}
              disabled={i > draft.passo}
              className={`h-7 rounded-full px-2.5 text-[11px] transition-colors ${
                i === draft.passo
                  ? "bg-[var(--ink)] font-semibold text-[var(--surface-deep)]"
                  : i < draft.passo
                    ? "border border-[var(--hairline-strong)] text-[var(--ink)]"
                    : "border border-[var(--hairline)] text-[var(--ash)]"
              }`}
            >
              {i + 1}. {p}
            </button>
          </li>
        ))}
        <li className="ml-auto">
          <button
            type="button"
            onClick={recomecar}
            className="h-7 px-2 text-[11px] text-[var(--mute)] underline"
          >
            recomeçar
          </button>
        </li>
      </ol>

      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface)] p-4">
        {draft.passo === 0 && <ReactPassoVideo draft={draft} update={update} />}
        {draft.passo === 1 && <ReactPassoAvatar draft={draft} update={update} />}
        {draft.passo === 2 && <ReactPassoRoteiro draft={draft} update={update} />}
        {draft.passo === 3 && <ReactPassoAjuste draft={draft} update={update} />}
        {draft.passo === 4 && <ReactPassoAudio draft={draft} update={update} />}
        {draft.passo === 5 && <ReactPassoLayout draft={draft} update={update} />}
        {draft.passo === 6 && <ReactPassoSaida draft={draft} update={update} />}
      </div>

      <div className="flex items-center gap-2">
        {/* Vídeo pronto = fim do caminho. Regra do Johnny (22/08): não se
            volta atrás depois de finalizado — o que se faz é começar outro.
            Manter o "Voltar" aqui só convida a mexer num React que já foi
            gerado e cobrado. */}
        {!draft.finalizado && (
          <button
            type="button"
            onClick={() => update({ passo: Math.max(0, draft.passo - 1) })}
            disabled={draft.passo === 0}
            className="h-10 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-4 text-[13px] text-[var(--ink)] disabled:opacity-40"
          >
            Voltar
          </button>
        )}
        {draft.finalizado && (
          <button
            type="button"
            onClick={recomecar}
            className="h-10 rounded-[var(--radius-sm)] bg-[var(--ink)] px-5 text-[14px] font-semibold text-[var(--surface-deep)]"
          >
            Criar outro React
          </button>
        )}
        {/* No último passo o botão de gerar é o da própria tela de Saída. */}
        {!ultimo && (
          <button
            type="button"
            onClick={() => update({ passo: Math.min(PASSOS.length - 1, draft.passo + 1) })}
            disabled={!podeAvancar}
            className="ml-auto h-10 rounded-[var(--radius-sm)] bg-[var(--ink)] px-5 text-[14px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            Continuar
          </button>
        )}
      </div>
    </div>
  );
}
