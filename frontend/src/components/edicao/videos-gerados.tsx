"use client";

/**
 * 🚧 Vídeo Edição 2.0 — "Vídeos gerados" (Task #13, pedido Johnny 13/08).
 * Histórico dos vídeos MONTADOS no fim da tela do Estúdio Automático (decisão:
 * na própria tela, não no menu — menu só muda após veredito do Lucas).
 * Grade de miniaturas; clicar expande com player + Baixar + Publicar.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Film, Loader2, X } from "lucide-react";
import { downloadFromUrl } from "@/components/image/download-file";
import { PublishButton, type PublishButtonSource } from "@/components/social/publish-button";

type VideoGerado = {
  tipo: "edicao" | "cenas";
  key: string | null;
  id: string | null;
  name: string;
  at: string | null;
  url: string;
};

export function VideosGerados() {
  const t = useTranslations("edicao.videosGerados");
  const [videos, setVideos] = useState<VideoGerado[] | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/v1/edicao/videos", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        const d = j?.data ?? j ?? {};
        if (alive) setVideos((d.videos ?? []) as VideoGerado[]);
      } catch {
        /* seção é opcional: sem histórico, não aparece */
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  if (!videos || videos.length === 0) return null;

  const sel = aberto !== null ? videos[aberto] : null;
  const publishSource: PublishButtonSource | null = sel
    ? sel.tipo === "edicao" && sel.key
      ? { kind: "edicao", key: sel.key }
      : sel.id
        ? { kind: "cenas", id: sel.id }
        : null
    : null;

  return (
    <section className="border-t border-[var(--hairline)] pt-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]">
        <Film className="size-4" /> {t("titulo")}
        <span className="font-mono text-[11px] font-normal text-[var(--ash)]">{videos.length}</span>
      </p>

      {/* Miniaturas (vídeos verticais 9:16) */}
      <ul className="mt-3 flex flex-wrap gap-2">
        {videos.map((v, i) => (
          <li key={`${v.tipo}-${v.key ?? v.id}`}>
            <button
              type="button"
              onClick={() => setAberto(aberto === i ? null : i)}
              title={v.name}
              className={[
                "relative block h-28 w-16 overflow-hidden rounded-[var(--radius-sm)] border bg-black/40",
                aberto === i
                  ? "border-[var(--ink)]"
                  : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]",
              ].join(" ")}
            >
              <video
                src={v.url}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {/* Expandido: player + baixar + publicar */}
      {sel && (
        <div className="mt-3 flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-[var(--ink)]">
              {sel.name}
              {sel.at && (
                <span className="ml-2 font-mono text-[11px] text-[var(--ash)]">
                  {new Date(sel.at).toLocaleString()}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setAberto(null)}
              className="text-[var(--ash)] hover:text-[var(--ink)]"
              aria-label={t("fechar")}
            >
              <X className="size-4" />
            </button>
          </div>
          <video
            src={sel.url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[420px] w-auto self-start rounded-[var(--radius)] border border-[var(--hairline)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBaixando(true);
                void downloadFromUrl(sel.url, sel.name || "video", "mp4").finally(() =>
                  setBaixando(false),
                );
              }}
              disabled={baixando}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
            >
              {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {t("baixar")}
            </button>
            {/* Opcional por desenho: só aparece com o Publicador liberado. */}
            {publishSource && <PublishButton source={publishSource} previewVideoUrl={sel.url} />}
          </div>
        </div>
      )}
    </section>
  );
}
