"use client";

/**
 * Painel de UMA cena (spec final Johnny 13/08, screenshot _Bugs/Video_Edit):
 *   1. Melhorar prompt (IA, 1 cr — só reescreve o texto)
 *   2. Regerar com minha imagem → pergunta: escolher da GALERIA de imagens
 *      (popup) OU fazer UPLOAD de foto nova (upload também entra na galeria).
 *      A foto vira a referência e a cena é gerada a partir dela.
 *   3. Regerar cena genérica (b-roll sem pessoa; prompt convertido pela LLM
 *      quando a cena tinha gente)
 * Regerar (2 e 3) cria cena NOVA, troca o ponteiro só neste projeto e
 * reabre a montagem.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ImageUp, Images, Loader2, RefreshCw, Sparkles, UserRound, TriangleAlert } from "lucide-react";
import { STUDIO_SCENE_COST } from "@/lib/studio/pricing";
import { IMPROVE_PROMPT_COST } from "@/lib/video/config";

export type CenaDetalhe = {
  id: string;
  concept: string;
  status: string;
  video_url?: string | null;
  prompt_en?: string;
  frases?: string[];
  /** Por que a cena falhou — o aluno precisa LER isso pra saber o que fazer. */
  error_message?: string | null;
  /** C4: cena gerada com as fotos da pessoa. */
  com_pessoa?: boolean;
};

type FotoAcervo = { id: string; image_url: string | null; image_path: string | null; status: string };

export function CenaPainel({
  projectId,
  cena,
  bloqueado,
  onMudou,
}: {
  projectId: string;
  cena: CenaDetalhe;
  /** true enquanto o projeto gera cenas — ações ficam travadas. */
  bloqueado: boolean;
  /** Regerou/substituiu → estação recarrega o projeto. */
  onMudou: () => void;
}) {
  const t = useTranslations("edicao.video.cenas.painel");
  const [prompt, setPrompt] = useState(cena.prompt_en ?? "");
  const [busy, setBusy] = useState<"melhorar" | "regerar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // "Regerar com minha imagem": null = fechado; "menu" = upload×galeria;
  // "galeria" = popup de fotos do acervo aberto.
  const [escolha, setEscolha] = useState<null | "menu" | "galeria">(null);
  const [fotos, setFotos] = useState<FotoAcervo[] | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (escolha !== "galeria" || fotos !== null) return;
    fetch("/api/v1/images", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { images: [] }))
      .then((j) =>
        setFotos(
          ((j.images ?? []) as FotoAcervo[]).filter((f) => f.status === "ready" && f.image_url && f.image_path),
        ),
      )
      .catch(() => setFotos([]));
  }, [escolha, fotos]);

  async function acao(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(`/api/v1/studio/${projectId}/scenes/${cena.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    const d = (j?.data ?? j ?? {}) as Record<string, unknown> & {
      error?: { message?: string };
      message?: string;
    };
    if (res.status === 402) throw new Error(t("semCreditos"));
    if (!res.ok) throw new Error(d?.error?.message ?? d?.message ?? t("erroAcao"));
    return d;
  }

  async function melhorar() {
    setBusy("melhorar");
    setErro(null);
    try {
      const d = await acao({ action: "improve" });
      if (typeof d.prompt === "string" && d.prompt) setPrompt(d.prompt);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erroAcao"));
    } finally {
      setBusy(null);
    }
  }

  /** Regenera: com foto escolhida (galeria/upload) OU genérica sem pessoa. */
  async function regerar(opts: { photoKeys?: string[]; saveToGallery?: boolean; generica?: boolean }) {
    setBusy("regerar");
    setErro(null);
    try {
      await acao({
        action: "redo",
        prompt_en: prompt,
        ...(opts.photoKeys?.length
          ? { photo_keys: opts.photoKeys, save_to_gallery: opts.saveToGallery === true }
          : {}),
        ...(opts.generica ? { keep_person: false } : {}),
      });
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erroAcao"));
    } finally {
      setBusy(null);
    }
  }

  async function enviarFoto(file: File) {
    setBusy("regerar");
    setErro(null);
    try {
      const up = await fetch("/api/v1/images/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content_type: file.type }),
      });
      const uj = await up.json().catch(() => ({}));
      const ud = (uj?.data ?? uj ?? {}) as { key?: string; upload_url?: string; error?: { message?: string } };
      if (!up.ok || !ud.key || !ud.upload_url) throw new Error(ud?.error?.message ?? t("erroFoto"));
      const put = await fetch(ud.upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error(t("erroFoto"));
      setBusy(null);
      // Upload também entra na galeria de imagens (save_to_gallery).
      await regerar({ photoKeys: [ud.key], saveToGallery: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erroFoto"));
      setBusy(null);
    } finally {
      if (fotoRef.current) fotoRef.current.value = "";
    }
  }

  const travado = bloqueado || busy !== null;
  const BTN =
    "flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 py-1.5 text-[12.5px] text-[var(--ink)] disabled:opacity-40";

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] p-3.5">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink)]">
        {cena.com_pessoa && <UserRound className="size-3.5 text-[var(--silver)]" />}
        {cena.concept}
      </p>

      {cena.video_url && (
        <video src={cena.video_url} controls playsInline preload="metadata" className="max-h-80 w-auto self-start rounded-[var(--radius-sm)] border border-[var(--hairline)]" />
      )}

      {/* Caso Fabio Fiuza (26/08): a cena falhava por moderação e a tela só
          mostrava um X. Ele clicava em regerar, caía no mesmo bloqueio e
          ficava preso, sem nunca saber o motivo nem o que fazer. */}
      {cena.status === "failed" && cena.error_message && (
        <p className="flex items-start gap-1.5 rounded-[var(--radius-sm)] border border-red-500/40 bg-red-500/10 px-2.5 py-2 text-[12.5px] leading-snug text-[var(--ink)]">
          <TriangleAlert className="mt-[1px] size-3.5 shrink-0 text-red-400" />
          <span>{cena.error_message}</span>
        </p>
      )}

      {(cena.frases ?? []).length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ash)]">{t("frases")}</p>
          <p className="text-[12.5px] leading-snug text-[var(--mute)]">“{(cena.frases ?? []).join(" ")}”</p>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ash)]">{t("prompt")}</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-transparent px-2.5 py-2 text-[13px] leading-snug text-[var(--ink)]"
        />
      </label>

      {/* Spec 13/08: melhorar · regerar com minha imagem · regerar genérica */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void melhorar()} disabled={travado} className={BTN}>
          {busy === "melhorar" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {t("melhorar", { custo: IMPROVE_PROMPT_COST })}
        </button>
        <button
          type="button"
          onClick={() => setEscolha(escolha ? null : "menu")}
          disabled={travado}
          aria-expanded={escolha !== null}
          className={BTN}
        >
          <UserRound className="size-3.5" />
          {t("regerarComImagem", { custo: STUDIO_SCENE_COST })}
        </button>
        <button type="button" onClick={() => void regerar({ generica: true })} disabled={travado} className={BTN}>
          {busy === "regerar" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {t("regerarGenerica", { custo: STUDIO_SCENE_COST })}
        </button>
        <input
          ref={fotoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void enviarFoto(f);
          }}
        />
      </div>

      {/* "Com minha imagem": upload novo × galeria de imagens já prontas */}
      {escolha && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] p-3">
          <p className="text-[12.5px] text-[var(--ink)]">{t("escolhaPergunta")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEscolha("galeria")} disabled={travado} className={BTN}>
              <Images className="size-3.5" /> {t("escolherGaleria")}
            </button>
            <button type="button" onClick={() => fotoRef.current?.click()} disabled={travado} className={BTN}>
              <ImageUp className="size-3.5" /> {t("uploadNovaFoto")}
            </button>
          </div>

          {escolha === "galeria" &&
            (fotos === null ? (
              <p className="flex items-center gap-2 text-[12.5px] text-[var(--mute)]">
                <Loader2 className="size-3.5 animate-spin" /> {t("carregandoFotos")}
              </p>
            ) : fotos.length === 0 ? (
              <p className="text-[12.5px] text-[var(--mute)]">{t("galeriaVazia")}</p>
            ) : (
              <ul className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-6">
                {fotos.slice(0, 24).map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => void regerar({ photoKeys: [f.image_path as string] })}
                      disabled={travado}
                      title={t("usarEstaFoto")}
                      className="group relative block aspect-square w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--hairline)] transition-colors hover:border-[var(--hairline-bright)] disabled:opacity-40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.image_url as string} alt="" className="h-full w-full object-cover" />
                      <span className="absolute inset-0 hidden place-items-center bg-black/40 group-hover:grid">
                        <Check className="size-4 text-white" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}

      {bloqueado && <p className="text-[12px] text-[var(--ash)]">{t("aguardeGerando")}</p>}
      {erro && <p className="text-[13px] text-red-400">{erro}</p>}
    </div>
  );
}
