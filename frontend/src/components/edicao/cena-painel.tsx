"use client";

/**
 * C2 (13/08) — painel de UMA cena aberto pela miniatura da estação Cenas:
 * player + frases cobertas + PROMPT editável com 3 ações:
 *   · Melhorar prompt (IA, 1 cr — só reescreve, nada é gerado)
 *   · Regerar a cena com o prompt atual (custa 1 cena)
 *   · Usar minha foto no lugar (upload → anima; custa 1 cena)
 * Regerar/foto invalidam a montagem — o botão Montar reaparece na estação.
 */
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageUp, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { STUDIO_SCENE_COST } from "@/lib/studio/pricing";
import { IMPROVE_PROMPT_COST } from "@/lib/video/config";

export type CenaDetalhe = {
  id: string;
  concept: string;
  status: string;
  video_url?: string | null;
  prompt_en?: string;
  frases?: string[];
};

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
  const [busy, setBusy] = useState<"melhorar" | "regerar" | "foto" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);

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

  async function regerar() {
    setBusy("regerar");
    setErro(null);
    try {
      await acao({ action: "redo", prompt_en: prompt });
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erroAcao"));
    } finally {
      setBusy(null);
    }
  }

  async function enviarFoto(file: File) {
    setBusy("foto");
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
      const put = await fetch(ud.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error(t("erroFoto"));
      await acao({ action: "photo", photo_key: ud.key });
      onMudou();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erroFoto"));
    } finally {
      setBusy(null);
      if (fotoRef.current) fotoRef.current.value = "";
    }
  }

  const travado = bloqueado || busy !== null;
  const BTN =
    "flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 py-1.5 text-[12.5px] text-[var(--ink)] disabled:opacity-40";

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] p-3.5">
      <p className="text-[13px] font-medium text-[var(--ink)]">{cena.concept}</p>

      {cena.video_url && (
        <video src={cena.video_url} controls playsInline preload="metadata" className="max-h-80 w-auto self-start rounded-[var(--radius-sm)] border border-[var(--hairline)]" />
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

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void melhorar()} disabled={travado} className={BTN}>
          {busy === "melhorar" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {t("melhorar", { custo: IMPROVE_PROMPT_COST })}
        </button>
        <button type="button" onClick={() => void regerar()} disabled={travado || !prompt.trim()} className={BTN}>
          {busy === "regerar" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          {t("regerar", { custo: STUDIO_SCENE_COST })}
        </button>
        <button type="button" onClick={() => fotoRef.current?.click()} disabled={travado} className={BTN}>
          {busy === "foto" ? <Loader2 className="size-3.5 animate-spin" /> : <ImageUp className="size-3.5" />}
          {t("minhaFoto", { custo: STUDIO_SCENE_COST })}
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
      {bloqueado && <p className="text-[12px] text-[var(--ash)]">{t("aguardeGerando")}</p>}
      {erro && <p className="text-[13px] text-red-400">{erro}</p>}
    </div>
  );
}
