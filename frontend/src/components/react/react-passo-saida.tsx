"use client";

/**
 * R6 — a conta e o botão de gerar.
 *
 * A regra do Johnny sobre preço aparece AQUI, antes de gastar: a conta vem
 * separada (React fixo · clone por segundo) pra pessoa entender que o caro é
 * o vídeo, não o nosso trabalho.
 */
import { useState } from "react";
import type { ReactDraft } from "./react-tipos";

/** Taxa fixa do React: LLM + preparo da foto + montagem + legenda. */
const CUSTO_REACT = 300;
/** Clone de vídeo — o que realmente pesa. */
const CREDITOS_POR_SEGUNDO = 105;

export function ReactPassoSaida({ draft }: { draft: ReactDraft }) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<string | null>(null);

  const texto = [draft.roteiro, draft.cta].filter(Boolean).join(" ");
  const palavras = texto.trim().split(/\s+/).filter(Boolean).length;
  const segundosFala = Math.max(1, Math.round(palavras / 2.5));
  const custoClone = draft.modoAudio === "gravar" ? 0 : segundosFala * CREDITOS_POR_SEGUNDO;
  const total = CUSTO_REACT + custoClone;

  const faltando: string[] = [];
  if (!draft.viral) faltando.push("o vídeo");
  if (!draft.fotoPronta) faltando.push("a foto pronta");
  if (draft.roteiro.trim().length < 20) faltando.push("o roteiro");
  if (!draft.layout) faltando.push("o layout");
  if (draft.modoAudio === "clone" && !draft.audioUrl) faltando.push("o áudio");

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const r = await fetch("/api/v1/react/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viral_id: draft.viral?.id,
          foto_url: draft.fotoPronta,
          audio_url: draft.audioUrl,
          layout: draft.layout,
          roteiro: draft.roteiro,
          cta: draft.cta,
        }),
      });
      const j = await r.json();
      if (r.ok) setPronto(j.job_id ?? "ok");
      else setErro(j?.error?.message ?? "Não consegui gerar agora.");
    } catch {
      setErro("Falha de rede.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Revisar e gerar</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--mute)]">
          Confira antes — depois de gerar, o crédito já foi.
        </p>
      </div>

      <dl className="grid gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline)] p-3 text-[12.5px]">
        {[
          ["Vídeo", draft.viral ? `@${draft.viral.autor ?? "?"} · ${Math.round(draft.viral.duracao_seg ?? 0)}s` : "—"],
          ["Quem reage", draft.avatar?.label ?? "—"],
          ["Foto", draft.fotoPronta ? "pronta (meio corpo, fundo preparado)" : "—"],
          ["Fala", `${palavras} palavras · ~${segundosFala}s`],
          ["Chamada final", draft.cta ? "sim" : "não"],
          ["Layout", draft.layout ?? "—"],
          [
            "Divisão",
            draft.viral?.duracao_seg && segundosFala > Math.round(draft.viral.duracao_seg)
              ? `${Math.round(draft.viral.duracao_seg)}s com o viral + ${segundosFala - Math.round(draft.viral.duracao_seg)}s só você`
              : "o viral cobre a fala inteira",
          ],
          ["Voz", draft.modoAudio === "gravar" ? "você grava" : draft.audioUrl ? "gerada" : "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-28 shrink-0 text-[var(--mute)]">{k}</dt>
            <dd className="text-[var(--ink)]">{v}</dd>
          </div>
        ))}
      </dl>

      {/* A conta separada — o caro é o vídeo, não o nosso trabalho. */}
      <div className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3 text-[12.5px]">
        <div className="flex justify-between">
          <span className="text-[var(--mute)]">React (roteiro, foto, montagem, legenda)</span>
          <span className="text-[var(--ink)]">{CUSTO_REACT} cr</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--mute)]">
            Seu vídeo — {segundosFala}s × {CREDITOS_POR_SEGUNDO} cr
          </span>
          <span className="text-[var(--ink)]">{custoClone.toLocaleString("pt-BR")} cr</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-[var(--hairline)] pt-1 font-semibold">
          <span className="text-[var(--ink)]">Total</span>
          <span className="text-[var(--ink)]">{total.toLocaleString("pt-BR")} cr</span>
        </div>
      </div>

      {faltando.length > 0 && (
        <p className="text-[12.5px] text-[var(--mute)]">
          Falta definir: <strong className="text-[var(--ink)]">{faltando.join(", ")}</strong>.
        </p>
      )}

      <button
        type="button"
        onClick={gerar}
        disabled={gerando || faltando.length > 0}
        className="h-11 rounded-[var(--radius-sm)] bg-[var(--ink)] text-[14px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
      >
        {gerando ? "Montando o seu React…" : "Gerar o Video React"}
      </button>

      {pronto && (
        <p className="rounded-[var(--radius-sm)] border border-[var(--hairline)] p-3 text-[12.5px] text-[var(--ink)]">
          Pedido enviado. O vídeo aparece em Vídeos gerados quando ficar pronto — o clone
          leva alguns minutos.
        </p>
      )}
      {erro && <p className="text-[12.5px] text-red-400">{erro}</p>}
    </div>
  );
}
