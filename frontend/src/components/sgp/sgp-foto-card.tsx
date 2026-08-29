"use client";

import { useTranslations } from "next-intl";

export type EstadoFoto =
  | { id: string; preview: string; fase: "enviando" | "analisando" | "aprovada" }
  | { id: string; preview: string; fase: "reprovada"; motivos: string[] }
  | { id: string; preview: string; fase: "indeciso" | "erro"; mensagem: string };

/** Miniatura pequena de UMA foto enviada: processando → ✓ / ✕ com motivo. */
export function SgpFotoCard({ foto, onRemover }: { foto: EstadoFoto; onRemover: () => void }) {
  const t = useTranslations("sgp.foto");
  const ocupada = foto.fase === "enviando" || foto.fase === "analisando";

  return (
    <figure className="flex flex-col gap-1">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto.preview} alt="" className="h-full w-full object-cover" />
        {ocupada ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[11px] font-medium text-white">
            {foto.fase === "enviando" ? t("enviando") : t("analisando")}
          </span>
        ) : null}
        {foto.fase === "aprovada" ? (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">✓</span>
        ) : null}
        {foto.fase === "reprovada" || foto.fase === "erro" || foto.fase === "indeciso" ? (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white">✕</span>
        ) : null}
        {!ocupada ? (
          <button
            type="button"
            onClick={onRemover}
            aria-label={t("remover")}
            className="sgp-btn sgp-btn--ghost sgp-btn--xs absolute bottom-1 right-1"
          >
            {t("remover")}
          </button>
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
