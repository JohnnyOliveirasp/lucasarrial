"use client";

/**
 * Player do viral: abre por cima da grade, toca o vídeo SEM baixar nada e é
 * onde o Johnny decide "este eu quero" — a marcação aqui é o que autoriza o
 * download pro R2 mais tarde.
 *
 * A URL do mp4 vem da CDN da rede e EXPIRA; quando falhar, o link do post
 * original é a saída (por isso ele fica sempre visível).
 */
import { useState } from "react";
import type { Viral } from "./virais-busca";
import { compacto } from "./virais-busca";

export function ViralPlayer({
  v,
  onFechar,
  onMarcar,
}: {
  v: Viral;
  onFechar: () => void;
  onMarcar: () => void;
}) {
  const [falhou, setFalhou] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onFechar}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-3 overflow-auto rounded-[16px] border border-[var(--hairline)] bg-[var(--surface)] p-4"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-semibold text-[var(--ink)]">
              @{v.autor ?? "?"}
              {v.autor_seguidores ? (
                <span className="ml-2 text-[12px] font-normal text-[var(--mute)]">
                  {compacto(v.autor_seguidores)} seguidores
                </span>
              ) : null}
            </h3>
            <p className="text-[12px] text-[var(--mute)]">
              ❤️ {compacto(v.likes)}
              {v.views ? ` · ${compacto(v.views)} views` : ""}
              {v.comentarios ? ` · ${compacto(v.comentarios)} comentários` : ""}
              {v.publicado_em
                ? ` · ${new Date(v.publicado_em).toLocaleDateString("pt-BR")}`
                : ""}
              {v.duracao_seg ? ` · ${Math.round(v.duracao_seg)}s` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="h-8 rounded-[8px] border border-[var(--hairline)] px-3 text-[13px] text-[var(--ink)]"
          >
            Fechar
          </button>
        </div>

        <div className="flex justify-center rounded-[12px] bg-black/80 p-2">
          {v.video_url && !falhou ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={v.video_url}
              poster={v.thumb_url ?? undefined}
              controls
              autoPlay
              playsInline
              onError={() => setFalhou(true)}
              className="max-h-[60vh] rounded-[8px]"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              {v.thumb_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.thumb_url}
                  alt=""
                  className="max-h-[40vh] rounded-[8px]"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <p className="text-[13px] text-white/80">
                O link direto do vídeo expirou — abra no original pra assistir.
              </p>
            </div>
          )}
        </div>

        {v.legenda && (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ink)]">
            {v.legenda}
          </p>
        )}

        {v.hashtags && v.hashtags.length > 0 && (
          <p className="text-[12px] text-[var(--mute)]">
            {v.hashtags.slice(0, 12).map((h) => `#${h}`).join(" ")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--hairline)] pt-3">
          <label className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)]">
            <input type="checkbox" checked={v.selecionado} onChange={onMarcar} />
            Quero baixar este pra trabalhar
          </label>
          {v.selecionado && (
            <span className="text-[12px] text-[var(--mute)]">
              {v.download_status === "nao_baixado"
                ? "entra na fila de download"
                : v.download_status}
            </span>
          )}
          <a
            href={v.url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-[13px] font-medium text-[var(--ink)] underline"
          >
            Abrir no {v.plataforma === "tiktok" ? "TikTok" : "original"}
          </a>
        </div>
      </div>
    </div>
  );
}
