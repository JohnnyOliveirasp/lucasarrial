"use client";

/**
 * C1 (13/08) — confirmação ANTES de gerar/cobrar as cenas: mostra
 * "sua fala tem N frases → N cenas" e deixa ajustar a quantidade
 * (frases vizinhas dividem a mesma cena no servidor).
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clapperboard, Loader2 } from "lucide-react";
import { STUDIO_SCENE_COST } from "@/lib/studio/pricing";

export function ConfirmCenas({
  frases,
  gerando,
  onGerar,
}: {
  /** Nº de frases da fala (sentence_count do GET). */
  frases: number;
  gerando: boolean;
  /** undefined = sugestão (1 cena por frase); número = quantidade ajustada. */
  onGerar: (sceneCount?: number) => void;
}) {
  const t = useTranslations("edicao.video.cenas");
  const [qtd, setQtd] = useState<number | null>(null);
  const escolhida = Math.min(Math.max(qtd ?? frases, 1), Math.max(frases, 1));

  return (
    <div className="flex flex-col gap-2.5 rounded-[var(--radius-sm)] border border-[var(--hairline)] p-3">
      <p className="text-[13px] text-[var(--ink)]">
        {frases > 0 ? t("confirmFrases", { frases }) : t("confirmSemContagem")}
      </p>
      <p className="text-[12px] text-[var(--ash)]">
        {t("confirmCusto", { custo: escolhida * STUDIO_SCENE_COST, cada: STUDIO_SCENE_COST })}
      </p>
      {frases > 1 && (
        <label className="flex items-center gap-2 text-[12.5px] text-[var(--mute)]">
          {t("confirmQtd")}
          <input
            type="number"
            min={1}
            max={frases}
            value={escolhida}
            onChange={(e) => setQtd(Number(e.target.value) || frases)}
            className="w-20 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-transparent px-2 py-1 text-[13px] text-[var(--ink)]"
          />
          <span className="text-[11px] text-[var(--ash)]">{t("confirmMax", { max: frases })}</span>
        </label>
      )}
      <button
        type="button"
        onClick={() => onGerar(escolhida < frases ? escolhida : undefined)}
        disabled={gerando}
        className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
      >
        {gerando ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
        {frases > 0 ? t("gerarQtd", { n: escolhida }) : t("gerarCenas", { custo: STUDIO_SCENE_COST })}
      </button>
    </div>
  );
}
