"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SGP_ERROR_CLASS, SGP_GHOST_CLASS, SGP_PILL_CLASS } from "./sgp-classes";

/** Rodapé da tela 4: LGPD + declaração (telas 4A/4B) + "Confirmar e Enviar". */
export function SgpEnviarForm() {
  const t = useTranslations("sgp.revisao");
  const router = useRouter();
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/v1/sgp/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aceite }),
      });
      const j = (await r.json().catch(() => null)) as { error?: { message?: string }; proximo?: string } | null;
      if (!r.ok) throw new Error(j?.error?.message ?? t("erroEnviar"));
      router.push(j?.proximo ?? "/app/sgp");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erroEnviar"));
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-4 py-4 text-[13px] leading-[1.55] text-[var(--silver)]">
        <p className="mb-1 font-semibold text-[var(--ink)]">{t("lgpdTitulo")}</p>
        <p>{t("lgpdTexto")}</p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-4 py-4 text-[13px] leading-[1.5] text-[var(--silver)] has-[:checked]:border-[var(--hairline-bright)] has-[:checked]:text-[var(--ink)]">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--pill-bg)]" />
        <span>{t("declaracao")}</span>
      </label>

      <p className="text-[13px] leading-[1.5] text-[var(--mute)]">{t("avisoProcessamento")}</p>

      {erro ? <p role="alert" className={SGP_ERROR_CLASS}>{erro}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => router.push("/sgp/audio")} className={SGP_GHOST_CLASS}>← {t("voltar")}</button>
        <button type="button" disabled={!aceite || enviando} onClick={enviar} className={SGP_PILL_CLASS}>
          {enviando ? t("enviando") : t("confirmarEnviar")}
        </button>
      </div>
    </div>
  );
}
