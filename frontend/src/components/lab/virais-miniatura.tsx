"use client";

/**
 * Uma miniatura da folha de contato.
 *
 * Capa + uma linha, e nada mais: card com borda, legenda de 2 linhas e
 * checkbox de texto embaixo fazia cada vídeo ocupar meia tela (Johnny, 14/08).
 * A legenda inteira vive no `title` — passar o mouse mostra.
 */
import { compacto } from "./virais-estilo";
import type { Viral } from "./virais-tipos";

export function Miniatura({
  v,
  selecionadoNaLista,
  onSelecionar,
  onAbrir,
  onMarcar,
}: {
  v: Viral;
  selecionadoNaLista: boolean;
  onSelecionar: () => void;
  onAbrir: () => void;
  onMarcar: () => void;
}) {
  return (
    <li className="flex flex-col gap-0.5" title={v.legenda ?? ""}>
      <div
        className={`relative overflow-hidden rounded-[var(--radius-sm)] border ${
          selecionadoNaLista ? "border-[var(--ink)]" : "border-[var(--hairline)]"
        }`}
      >
        {/* seleção em massa: caixinha por cima da capa, estilo caixa de e-mail */}
        <label
          className="absolute left-0.5 top-0.5 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded bg-black/60"
          title="Selecionar para apagar ou marcar em massa"
        >
          <input
            type="checkbox"
            checked={selecionadoNaLista}
            onChange={onSelecionar}
            className="h-3 w-3"
          />
        </label>
        <button
          type="button"
          onClick={onAbrir}
          className="relative block aspect-[9/16] w-full overflow-hidden bg-black/80"
          title="Abrir para assistir"
        >
          {v.thumb_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.thumb_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[10px] text-white/60">
              sem capa
            </span>
          )}
          <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] font-medium text-white">
            ❤️ {compacto(v.likes)}
          </span>
        </button>
        {/* "baixar" é selo no canto: a linha de checkbox com texto embaixo
            dobrava a altura da miniatura. */}
        <button
          type="button"
          onClick={onMarcar}
          aria-pressed={v.selecionado}
          title={v.selecionado ? "Na lista de download — clique pra tirar" : "Marcar pra baixar"}
          className={`absolute bottom-0.5 right-0.5 z-10 rounded px-1 text-[9px] font-semibold ${
            v.selecionado
              ? "bg-[var(--ink)] text-[var(--surface-deep)]"
              : "bg-black/60 text-white/70"
          }`}
        >
          {v.selecionado ? "✓ baixar" : "baixar"}
        </button>
      </div>
      <span className="truncate text-[9px] leading-tight text-[var(--mute)]">
        @{v.autor ?? "?"}
        {v.views ? ` · ${compacto(v.views)}` : ""}
      </span>
    </li>
  );
}
