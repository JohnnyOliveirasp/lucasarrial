"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { IMAGE_ACCEPT_WITH_HEIC } from "@/lib/images/heic";
import { putToR2 } from "@/lib/images/upload";
import { paraFormatoAceito } from "@/lib/images/qualquer-formato";
import { CIENCIA_FOTO, SGP_FOTOS_MAX, SGP_FOTOS_MIN, type SgpFoto } from "@/lib/sgp/types";
import { SgpFotoCard, type EstadoFoto } from "./sgp-foto-card";
import { SGP_ERROR_CLASS, SGP_GHOST_CLASS, SGP_HINT_CLASS, SGP_PILL_CLASS } from "./sgp-classes";

type Inicial = { foto: SgpFoto; url: string };

/**
 * Tela 2 do SGP — Foto base do Clone (revisão do Johnny 29/08 08:44):
 *  PDF do guia · 5 checkboxes (ciência) · UM botão "Enviar fotos" que aceita
 *  várias de uma vez · cada foto vira uma miniatura pequena, só as enviadas ·
 *  a IA analisa cada uma ao subir (✓ / ✕ com motivo) · Continuar com ≥ 4
 *  aprovadas (guia: 4 a 5) e os 5 itens marcados.
 */
export function StepFotoForm({ iniciais }: { iniciais: Inicial[] }) {
  const t = useTranslations("sgp.foto");
  const router = useRouter();
  const input = useRef<HTMLInputElement | null>(null);
  const trocando = useRef<string | null>(null);

  const [fotos, setFotos] = useState<EstadoFoto[]>(() =>
    iniciais.map(({ foto, url }) =>
      foto.status === "aprovada"
        ? { id: foto.key, preview: url, fase: "aprovada" }
        : { id: foto.key, preview: url, fase: "reprovada", motivos: foto.motivos ?? [] },
    ),
  );
  const [ciencia, setCiencia] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aprovadas = fotos.filter((f) => f.fase === "aprovada").length;
  const ocupado = fotos.some((f) => f.fase === "enviando" || f.fase === "analisando");
  const podeContinuar = aprovadas >= SGP_FOTOS_MIN && !ocupado && ciencia.size === CIENCIA_FOTO.length;

  function patch(id: string, novo: EstadoFoto) {
    setFotos((prev) => prev.map((f) => (f.id === id ? novo : f)));
  }

  function escolher(files: FileList | null) {
    if (!files) return;
    // Veio de "Trocar": a primeira foto substitui aquela, as demais entram como novas.
    const alvo = trocando.current;
    trocando.current = null;
    const lista = Array.from(files);
    if (alvo) {
      const [primeira, ...resto] = lista;
      if (primeira) void remover(fotos.find((f) => f.id === alvo)!, false).then(() => enviarUma(primeira));
      for (const f of resto.slice(0, Math.max(0, SGP_FOTOS_MAX - fotos.length))) void enviarUma(f);
      return;
    }
    const vagas = SGP_FOTOS_MAX - fotos.length;
    const cortada = lista.slice(0, Math.max(0, vagas));
    if (cortada.length < lista.length) setErro(t("maximo", { max: SGP_FOTOS_MAX }));
    for (const f of cortada) void enviarUma(f);
  }

  function trocar(f: EstadoFoto) {
    trocando.current = f.id;
    input.current?.click();
  }

  async function enviarUma(original: File) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const preview = URL.createObjectURL(original);
    setFotos((prev) => [...prev, { id, preview, fase: "enviando" }]);
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

      patch(id, { id, preview, fase: "analisando" });
      const j = await fetch("/api/v1/sgp/foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (j.status === 202) return patch(id, { id, preview, fase: "indeciso", mensagem: t("indeciso") });
      if (!j.ok) throw new Error(await mensagemDe(j, t("erroAnalise")));
      const { foto } = (await j.json()) as { foto: SgpFoto };
      // id passa a ser a chave definitiva (a adotada em refs/), pro DELETE achar.
      setFotos((prev) =>
        prev.map((f) =>
          f.id === id
            ? foto.status === "aprovada"
              ? { id: foto.key, preview, fase: "aprovada" }
              : { id: foto.key, preview, fase: "reprovada", motivos: foto.motivos ?? [] }
            : f,
        ),
      );
    } catch (e) {
      patch(id, { id, preview, fase: "erro", mensagem: e instanceof Error ? e.message : t("erroUpload") });
    }
  }

  async function remover(f: EstadoFoto, limparErro = true) {
    if (limparErro) setErro(null);
    setFotos((prev) => prev.filter((x) => x.id !== f.id));
    if (f.id.includes("/")) {
      await fetch(`/api/v1/sgp/foto?key=${encodeURIComponent(f.id)}`, { method: "DELETE" }).catch(() => {});
    }
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
      <div className="flex flex-col gap-1.5">
        <a href="/sgp/guia-foto-base.pdf" target="_blank" rel="noopener" className="sgp-btn sgp-btn--block">
          <span aria-hidden>⤓</span> {t("guiaTitulo")}
        </a>
        <p className="text-center text-[12px] text-[var(--mute)]">{t("guiaDescricao")}</p>
      </div>

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

      <div className="flex flex-col gap-3">
        <p className="text-[14px] font-semibold text-[var(--ink)]">{t("fotosTitulo")}</p>
        <p className={SGP_HINT_CLASS}>{t("fotosDica", { min: SGP_FOTOS_MIN, max: SGP_FOTOS_MAX })}</p>

        <button
          type="button"
          disabled={fotos.length >= SGP_FOTOS_MAX}
          onClick={() => input.current?.click()}
          className="sgp-btn sgp-btn--block"
        >
          {t("enviarFotos")}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={`${IMAGE_ACCEPT_WITH_HEIC},image/*`}
          className="hidden"
          onChange={(e) => { escolher(e.target.files); e.target.value = ""; }}
        />

        {fotos.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {fotos.map((f) => (
              <SgpFotoCard key={f.id} foto={f} onTrocar={() => trocar(f)} onRemover={() => remover(f)} />
            ))}
          </div>
        ) : null}
        <p className="text-[12px] text-[var(--silver)]">{t("progresso", { n: aprovadas, min: SGP_FOTOS_MIN })}</p>
      </div>

      {erro ? <p role="alert" className={SGP_ERROR_CLASS}>{erro}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => router.push("/sgp")} className={SGP_GHOST_CLASS}>
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
