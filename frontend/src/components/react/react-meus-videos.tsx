"use client";

/**
 * Os React que a pessoa já criou — a lista que faltava embaixo do wizard.
 *
 * Johnny (22/08): *"quando eu clico em React, não está aparecendo os vídeos
 * que foram criados, e deveriam aparecer abaixo numa lista"*. O wizard só
 * conhecia o rascunho atual: vídeo pronto de ontem era invisível, e o único
 * jeito de rever era acertar o rascunho no viral certo.
 *
 * ⚠️ O mp4 vive no bucket com TTL de 30 dias. Quando ele já saiu, a lista diz
 * "não está mais disponível" em vez de mostrar um play que não toca.
 */
import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Play, RefreshCw, X } from "lucide-react";

type ReactPronto = {
  id: string;
  status: string;
  erro: string | null;
  segundos: number;
  criado_em: string;
  autor: string | null;
  thumb_url: string | null;
  video_url: string | null;
  expirado: boolean;
};

const ROTULO: Record<string, string> = {
  pronto: "pronto",
  erro: "falhou",
  baixando: "baixando o viral…",
  clonando: "clonando você…",
  montando: "montando…",
};

function quando(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

export function ReactMeusVideos() {
  const [videos, setVideos] = useState<ReactPronto[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  /** Miniaturas na lista, player só ao clicar (Johnny 25/08: os cards
      gigantes de 3 por linha viravam a tela inteira). */
  const [aberto, setAberto] = useState<ReactPronto | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const r = await fetch("/api/v1/react/meus", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) {
        setErro(j?.error?.message ?? "Não consegui carregar a sua lista.");
        setVideos([]);
        return;
      }
      setVideos((j.videos ?? []) as ReactPronto[]);
    } catch {
      setErro("Falha de rede.");
      setVideos([]);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (videos === null) {
    return <p className="text-[13px] text-[var(--mute)]">Carregando os seus React…</p>;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Seus React</h2>
        <span className="text-[12px] text-[var(--mute)]">{videos.length}</span>
        <button
          type="button"
          onClick={() => void carregar()}
          className="ml-auto flex items-center gap-1.5 text-[12px] text-[var(--mute)] underline"
        >
          <RefreshCw className="size-3.5" />
          atualizar
        </button>
      </div>

      {erro && <p className="text-[12.5px] text-red-400">{erro}</p>}

      {videos.length === 0 && !erro && (
        <p className="rounded-[var(--radius)] border border-dashed border-[var(--hairline)] p-4 text-[13px] text-[var(--mute)]">
          Você ainda não criou nenhum React. O primeiro aparece aqui assim que ficar pronto.
        </p>
      )}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {videos.map((v) => {
          const falhou = v.status === "erro" || v.expirado;
          const rotulo = v.expirado ? "não está mais disponível" : (v.erro ?? "falhou");
          return (
            <li key={v.id} className="flex flex-col gap-0.5" title={falhou ? rotulo : "Abrir para assistir"}>
              <button
                type="button"
                onClick={() => v.video_url && setAberto(v)}
                disabled={!v.video_url}
                className="relative block aspect-[9/16] w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-black/80 disabled:cursor-default"
              >
                {v.thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumb_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : v.video_url ? (
                  <video src={v.video_url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : null}
                {v.video_url ? (
                  <span className="absolute inset-0 grid place-items-center">
                    <Play className="size-6 text-white drop-shadow" />
                  </span>
                ) : falhou ? (
                  <span className="absolute inset-0 grid place-items-center px-1 text-center text-[10px] leading-tight text-white/70">
                    {v.expirado ? "expirou" : "falhou"}
                  </span>
                ) : (
                  <span className="absolute inset-0 grid place-items-center">
                    <Loader2 className="size-5 animate-spin text-white/70" />
                  </span>
                )}
                {v.segundos > 0 && (
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[9px] text-white">
                    {v.segundos}s
                  </span>
                )}
              </button>
              <span className="truncate text-[9px] leading-tight text-[var(--mute)]">
                {v.autor ? `@${v.autor}` : "React"} · {quando(v.criado_em)}
              </span>
            </li>
          );
        })}
      </ul>

      {aberto && aberto.video_url && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          onClick={() => setAberto(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-full flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <video
              src={aberto.video_url}
              controls
              autoPlay
              playsInline
              poster={aberto.thumb_url ?? undefined}
              className="max-h-[80vh] rounded-[var(--radius)] border border-[var(--hairline)]"
            />
            <div className="flex items-center gap-2 text-[12.5px] text-white">
              <span className="min-w-0 flex-1 truncate">
                {aberto.autor ? `@${aberto.autor}` : "React"} · {quando(aberto.criado_em)} · {ROTULO[aberto.status] ?? aberto.status}
                {aberto.segundos > 0 && ` · ${aberto.segundos}s`}
              </span>
              <a
                href={aberto.video_url}
                download
                title="Baixar"
                aria-label="Baixar"
                className="grid size-8 place-items-center rounded-[var(--radius-sm)] border border-white/30"
              >
                <Download className="size-4" />
              </a>
              <button
                type="button"
                onClick={() => setAberto(null)}
                aria-label="Fechar"
                className="grid size-8 place-items-center rounded-[var(--radius-sm)] border border-white/30"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
