"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { putToR2 } from "@/lib/images/upload";
import { paraFormatoAceito } from "@/lib/images/qualquer-formato";
import { CIENCIA_FOTO, SGP_FOTO_SLOTS, type SgpFoto, type SgpFotoSlot } from "@/lib/sgp/types";
import { SgpFotoSlotCard, type EstadoSlot } from "./sgp-foto-slot";
import { SGP_ERROR_CLASS, SGP_HINT_CLASS, SGP_PILL_CLASS } from "./sgp-classes";

const OBRIGATORIOS: SgpFotoSlot[] = ["frente_sorrindo", "frente_neutro", "lado_sorrindo", "lado_neutro"];

type Inicial = { foto: SgpFoto; url: string };

/**
 * Tela 2 do SGP — Foto base do Clone (decisões 29/08):
 *  PDF do guia · 5 checkboxes (ciência, gravada com hora) · 4 slots do guia + 1
 *  extra · cada foto sobe (qualquer formato), o sistema JULGA e marca ✅/❌ com
 *  motivo · Continuar só com os 4 slots aprovados + 5 itens marcados.
 */
export function StepFotoForm({ iniciais }: { iniciais: Inicial[] }) {
  const t = useTranslations("sgp.foto");
  const router = useRouter();

  const [estados, setEstados] = useState<Record<SgpFotoSlot, EstadoSlot>>(() => {
    const base = Object.fromEntries(SGP_FOTO_SLOTS.map((s) => [s, { fase: "vazio" }])) as Record<SgpFotoSlot, EstadoSlot>;
    for (const { foto, url } of iniciais) {
      base[foto.slot] =
        foto.status === "aprovada"
          ? { fase: "aprovada", preview: url }
          : { fase: "reprovada", preview: url, motivos: foto.motivos ?? [] };
    }
    return base;
  });
  const [ciencia, setCiencia] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aprovados = OBRIGATORIOS.filter((s) => estados[s].fase === "aprovada").length;
  const podeContinuar = aprovados === OBRIGATORIOS.length && ciencia.size === CIENCIA_FOTO.length;

  function setSlot(slot: SgpFotoSlot, e: EstadoSlot) {
    setEstados((prev) => ({ ...prev, [slot]: e }));
  }

  async function enviarFoto(slot: SgpFotoSlot, original: File) {
    const preview = URL.createObjectURL(original);
    setSlot(slot, { fase: "enviando", preview });
    try {
      const file = await paraFormatoAceito(original);
      const r = await fetch("/api/v1/images/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content_type: file.type }),
      });
      if (!r.ok) throw new Error(await mensagemDe(r, t("erroUpload")));
      const { key, upload_url } = (await r.json()) as { key: string; upload_url: string };
      await putToR2(upload_url, file, file.type);

      setSlot(slot, { fase: "processando", preview });
      const j = await fetch("/api/v1/sgp/foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, key }),
      });
      if (j.status === 202) return setSlot(slot, { fase: "indeciso", preview });
      if (!j.ok) throw new Error(await mensagemDe(j, t("erroAnalise")));
      const { foto } = (await j.json()) as { foto: SgpFoto };
      setSlot(
        slot,
        foto.status === "aprovada"
          ? { fase: "aprovada", preview }
          : { fase: "reprovada", preview, motivos: foto.motivos ?? [] },
      );
    } catch (e) {
      setSlot(slot, { fase: "erro", preview, mensagem: e instanceof Error ? e.message : t("erroUpload") });
    }
  }

  async function removerFoto(slot: SgpFotoSlot) {
    setSlot(slot, { fase: "vazio" });
    await fetch(`/api/v1/sgp/foto?slot=${slot}`, { method: "DELETE" }).catch(() => {});
  }

  function alternar(item: string) {
    setCiencia((prev) => {
      const n = new Set(prev);
      if (n.has(item)) n.delete(item);
      else n.add(item);
      return n;
    });
  }

  async function continuar() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/v1/sgp/foto/concluir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ciencia: [...ciencia] }),
      });
      if (!r.ok) throw new Error(await mensagemDe(r, t("erroConcluir")));
      router.push("/sgp/audio");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erroConcluir"));
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <a
        href="/sgp/guia-foto-base.pdf"
        target="_blank"
        rel="noopener"
        className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-4 py-3 transition-colors hover:border-[var(--hairline-bright)]"
      >
        <span aria-hidden className="text-lg">⤓</span>
        <span className="flex flex-col">
          <span className="text-[14px] font-medium text-[var(--ink)]">{t("guiaTitulo")}</span>
          <span className="text-[12px] text-[var(--mute)]">{t("guiaDescricao")}</span>
        </span>
      </a>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[14px] font-semibold text-[var(--ink)]">{t("confirmeTitulo")}</legend>
        {CIENCIA_FOTO.map((item) => (
          <label
            key={item}
            className="flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3.5 py-3 text-[13px] text-[var(--silver)] has-[:checked]:border-[var(--hairline-bright)] has-[:checked]:text-[var(--ink)]"
          >
            <input type="checkbox" checked={ciencia.has(item)} onChange={() => alternar(item)} className="h-4 w-4 accent-[var(--pill-bg)]" />
            {t(`ciencia.${item}`)}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2">
        <p className="text-[14px] font-semibold text-[var(--ink)]">{t("fotosTitulo")}</p>
        <p className={SGP_HINT_CLASS}>{t("fotosDica")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SGP_FOTO_SLOTS.map((slot) => (
            <SgpFotoSlotCard
              key={slot}
              slot={slot}
              estado={estados[slot]}
              onArquivo={(f) => enviarFoto(slot, f)}
              onRemover={() => removerFoto(slot)}
            />
          ))}
        </div>
        <p className="text-[12px] text-[var(--silver)]">{t("progresso", { n: aprovados, total: OBRIGATORIOS.length })}</p>
      </div>

      {erro ? (
        <p role="alert" className={SGP_ERROR_CLASS}>{erro}</p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push("/sgp")}
          className="text-[14px] text-[var(--silver)] transition-colors hover:text-[var(--ink)]"
        >
          ← {t("voltar")}
        </button>
        <button type="button" disabled={!podeContinuar || enviando} onClick={continuar} className={SGP_PILL_CLASS}>
          {enviando ? t("salvando") : `${t("continuar")} →`}
        </button>
      </div>
    </div>
  );
}

async function mensagemDe(r: Response, padrao: string): Promise<string> {
  const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
  return j?.error?.message ?? padrao;
}
