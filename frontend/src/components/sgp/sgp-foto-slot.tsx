"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { IMAGE_ACCEPT_WITH_HEIC } from "@/lib/images/heic";
import type { SgpFotoSlot } from "@/lib/sgp/types";

export type EstadoSlot =
  | { fase: "vazio" }
  | { fase: "enviando"; preview: string }
  | { fase: "processando"; preview: string }
  | { fase: "aprovada"; preview: string }
  | { fase: "reprovada"; preview: string; motivos: string[] }
  | { fase: "indeciso"; preview: string }
  | { fase: "erro"; preview: string | null; mensagem: string };

/** Um slot da tela 2: miniatura + estado (✅ / ❌ motivo / processando). */
export function SgpFotoSlotCard({
  slot,
  estado,
  onArquivo,
  onRemover,
}: {
  slot: SgpFotoSlot;
  estado: EstadoSlot;
  onArquivo: (file: File) => void;
  onRemover: () => void;
}) {
  const t = useTranslations("sgp.foto");
  const input = useRef<HTMLInputElement | null>(null);
  const ocupado = estado.fase === "enviando" || estado.fase === "processando";
  const preview = "preview" in estado ? estado.preview : null;

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[var(--ink)]">{t(`slots.${slot}`)}</p>
        <Selo estado={estado} />
      </div>

      <button
        type="button"
        disabled={ocupado}
        onClick={() => input.current?.click()}
        className="relative aspect-[3/4] w-full overflow-hidden rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] transition-colors hover:border-[var(--hairline-bright)] disabled:cursor-wait"
        aria-label={t("escolherFoto")}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-[12px] text-[var(--ash)]">
            {t("toqueParaEnviar")}
          </span>
        )}
        {ocupado ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[12px] font-medium text-white">
            {estado.fase === "enviando" ? t("enviando") : t("analisando")}
          </span>
        ) : null}
      </button>

      <input
        ref={input}
        type="file"
        accept={`${IMAGE_ACCEPT_WITH_HEIC},image/*`}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onArquivo(f);
        }}
      />

      {estado.fase === "reprovada" ? (
        <ul className="flex flex-col gap-0.5 text-[12px] leading-[1.4] text-[var(--status-error)]">
          {estado.motivos.map((m) => (
            <li key={m}>✕ {m}</li>
          ))}
        </ul>
      ) : null}
      {estado.fase === "indeciso" ? (
        <p className="text-[12px] text-[var(--silver)]">{t("indeciso")}</p>
      ) : null}
      {estado.fase === "erro" ? (
        <p className="text-[12px] text-[var(--status-error)]">{estado.mensagem}</p>
      ) : null}

      {estado.fase !== "vazio" && !ocupado ? (
        <div className="flex gap-3 text-[12px]">
          <button type="button" onClick={() => input.current?.click()} className="text-[var(--silver)] hover:text-[var(--ink)]">
            {t("trocar")}
          </button>
          <button type="button" onClick={onRemover} className="text-[var(--silver)] hover:text-[var(--ink)]">
            {t("remover")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Selo({ estado }: { estado: EstadoSlot }) {
  const t = useTranslations("sgp.foto");
  if (estado.fase === "aprovada") {
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">✓ {t("aprovada")}</span>;
  }
  if (estado.fase === "reprovada") {
    return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">✕ {t("reprovada")}</span>;
  }
  if (estado.fase === "processando" || estado.fase === "enviando") {
    return <span className="rounded-full border border-[var(--hairline-strong)] px-2 py-0.5 text-[11px] text-[var(--silver)]">{t("processando")}</span>;
  }
  return null;
}
