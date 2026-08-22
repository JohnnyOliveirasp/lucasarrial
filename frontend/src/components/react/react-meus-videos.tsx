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
import { Download, Loader2, RefreshCw } from "lucide-react";

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

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((v) => (
          <li
            key={v.id}
            className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface)] p-2.5"
          >
            {v.video_url ? (
              <video
                src={v.video_url}
                controls
                playsInline
                preload="metadata"
                poster={v.thumb_url ?? undefined}
                className="aspect-[9/16] w-full rounded-[var(--radius-sm)] border border-[var(--hairline)] object-cover"
              />
            ) : (
              <div className="grid aspect-[9/16] w-full place-items-center rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-deep)]">
                {v.status === "erro" || v.expirado ? (
                  <span className="px-3 text-center text-[12px] text-[var(--mute)]">
                    {v.expirado ? "não está mais disponível" : (v.erro ?? "falhou")}
                  </span>
                ) : (
                  <Loader2 className="size-5 animate-spin text-[var(--mute)]" />
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-[var(--ink)]">
                  {v.autor ? `@${v.autor}` : "React"}
                </span>
                <span className="block truncate font-mono text-[10.5px] text-[var(--ash)]">
                  {quando(v.criado_em)} · {ROTULO[v.status] ?? v.status}
                  {v.segundos > 0 && ` · ${v.segundos}s`}
                </span>
              </span>
              {v.video_url && (
                <a
                  href={v.video_url}
                  download
                  title="Baixar"
                  aria-label="Baixar"
                  className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] text-[var(--mute)]"
                >
                  <Download className="size-4" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
