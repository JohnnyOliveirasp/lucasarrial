"use client";

/**
 * "Meus Virais" — a prateleira de cada um.
 *
 * Só o que ESTA pessoa guardou (mig 75). Nada aqui foi baixado: guardar é
 * metadado + capa. O mp4 só desce quando ela for produzir o Video React —
 * decisão do Johnny 14/08 ("não vou baixar o que talvez ninguém use").
 *
 * Da miniatura saem os dois caminhos que a gente fechou:
 *   ▶ Fazer React            → wizard com o vídeo já escolhido
 *   💡 Usar a ideia no Estúdio → joga o link no passo de roteiro (que já
 *      aceita link hoje) e sai um roteiro dele, sem o viral na tela.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { GRADE } from "./virais-estilo";
import { Miniatura } from "./virais-miniatura";
import { PainelViral } from "./meus-virais-painel";
import type { Viral } from "./virais-tipos";

export function MeusVirais() {
  const [videos, setVideos] = useState<Viral[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<Viral | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/v1/virais/videos?meus=1&limite=300&ordem=score");
      const j = await r.json();
      setVideos(r.ok ? j.videos ?? [] : []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Tirar da prateleira. Não apaga o vídeo do acervo de ninguém. */
  async function devolver(v: Viral) {
    setVideos((atual) => atual.filter((x) => x.id !== v.id));
    setAberto(null);
    const r = await fetch("/api/v1/virais/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, reservado: false }),
    });
    if (!r.ok) {
      setRecado("Não consegui tirar agora.");
      await carregar();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">
          Meus Virais
          <span className="ml-2 text-[13px] font-normal text-[var(--mute)]">
            {videos.length} guardados
          </span>
        </h2>
        <Link
          href="/app/lab/virais"
          className="ml-auto h-8 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 text-[12px] leading-8 text-[var(--ink)]"
        >
          Garimpar mais na Galeria
        </Link>
      </div>

      {recado && <p className="text-[13px] text-[var(--ink)]">{recado}</p>}

      {carregando ? (
        <p className="text-[14px] text-[var(--mute)]">Carregando…</p>
      ) : videos.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] p-8 text-center">
          <p className="text-[14px] text-[var(--mute)]">
            Sua prateleira está vazia. Vá até a{" "}
            <Link href="/app/lab/virais" className="font-medium text-[var(--ink)] underline">
              Galeria de Vídeos Virais
            </Link>{" "}
            e guarde os que você quer usar.
          </p>
        </div>
      ) : (
        <ul className={GRADE}>
          {videos.map((v) => (
            <Miniatura
              key={v.id}
              v={v}
              selecionadoNaLista={false}
              onSelecionar={() => setAberto(v)}
              onAbrir={() => setAberto(v)}
              onMarcar={() => devolver(v)}
            />
          ))}
        </ul>
      )}

      {aberto && (
        <PainelViral v={aberto} onFechar={() => setAberto(null)} onDevolver={() => devolver(aberto)} />
      )}
    </div>
  );
}
