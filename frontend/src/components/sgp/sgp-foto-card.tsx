"use client";

import { useTranslations } from "next-intl";

export type EstadoFoto =
  | { id: string; preview: string; fase: "enviando" | "analisando" | "aprovada" }
  | { id: string; preview: string; fase: "reprovada"; motivos: string[] }
  | { id: string; preview: string; fase: "indeciso" | "erro"; mensagem: string };

/**
 * Miniatura de UMA foto: processando → ✓ / ✕ com motivo.
 * Cada foto tem os dois botões (Johnny 29/08): **trocar** (sobe outra no lugar
 * desta) e **lixeira** (tira da lista). Sem eles, a foto reprovada ficava
 * encalhada no quadro.
 */
export function SgpFotoCard({
  foto,
  onTrocar,
  onRemover,
}: {
  foto: EstadoFoto;
  onTrocar: () => void;
  onRemover: () => void;
}) {
  const t = useTranslations("sgp.foto");
  const ocupada = foto.fase === "enviando" || foto.fase === "analisando";
  const ruim = foto.fase === "reprovada" || foto.fase === "erro" || foto.fase === "indeciso";

  return (
    <figure className="flex flex-col gap-1">
      <div
        className={[
          "relative aspect-[3/4] w-full overflow-hidden rounded-[var(--radius)] border bg-[var(--surface-deep)]",
          ruim ? "border-[var(--status-error)]" : "border-[var(--hairline-strong)]",
        ].join(" ")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto.preview} alt="" className="h-full w-full object-cover" />

        {ocupada ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[11px] font-medium text-white">
            {foto.fase === "enviando" ? t("enviando") : t("analisando")}
          </span>
        ) : null}

        {foto.fase === "aprovada" ? (
          <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
            ✓
          </span>
        ) : null}
        {ruim ? (
          <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white">
            ✕
          </span>
        ) : null}

        {!ocupada ? (
          <div className="absolute bottom-1 left-1 right-1 flex justify-center gap-1">
            <button
              type="button"
              onClick={onTrocar}
              title={t("trocar")}
              aria-label={t("trocar")}
              className="sgp-btn sgp-btn--xs"
            >
              ⟳ {t("trocar")}
            </button>
            <button
              type="button"
              onClick={onRemover}
              title={t("remover")}
              aria-label={t("remover")}
              className="sgp-btn sgp-btn--ghost sgp-btn--xs"
            >
              🗑
            </button>
          </div>
        ) : null}
      </div>

      {foto.fase === "reprovada" ? (
        <figcaption className="text-[10px] leading-[1.3] text-red-400">{foto.motivos.join(" · ")}</figcaption>
      ) : null}
      {foto.fase === "indeciso" || foto.fase === "erro" ? (
        <figcaption className="text-[10px] leading-[1.3] text-[var(--status-error)]">{foto.mensagem}</figcaption>
      ) : null}
    </figure>
  );
}
