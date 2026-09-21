"use client";

/**
 * Vídeos Virais 1.0 — a vitrine do acervo que os alunos alimentam.
 *
 * Duas abas: "Todos os virais" (o acervo coletivo) e "Meus envios" (o recorte
 * de quem está olhando). O vídeo toca aqui dentro quando já baixou; enquanto
 * não baixou, o card mostra a capa e o link do post original — melhor do que
 * sumir com o envio.
 */
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Eye, Heart, Loader2, Trash2 } from "lucide-react";
import { EnviarViral } from "@/components/virais/enviar-viral";

type Viral = {
  id: string;
  plataforma: string;
  url: string;
  autor: string | null;
  legenda: string | null;
  likes: number | null;
  views: number | null;
  duracaoSeg: number | null;
  enviadoEm: string | null;
  meu: boolean;
  thumbUrl: string | null;
  videoUrl: string | null;
};

const num = (n: number | null) =>
  n === null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);

export function ViraisComunidade({ isAdmin }: { isAdmin: boolean }) {
  const [aba, setAba] = useState<"todos" | "meus">("todos");
  const [videos, setVideos] = useState<Viral[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const q = new URLSearchParams({ pagina: String(pagina) });
      if (aba === "meus") q.set("meus", "1");
      const res = await fetch(`/api/v1/virais/comunidade?${q}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Falha ao carregar");
      setVideos(json.videos ?? []);
      setTotal(json.total ?? 0);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setCarregando(false);
    }
  }, [aba, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function remover(id: string) {
    const motivo = window.prompt("Motivo da remoção (fica registrado):") ?? "";
    if (motivo === null) return;
    const res = await fetch(`/api/v1/virais/comunidade?id=${id}&motivo=${encodeURIComponent(motivo)}`, {
      method: "DELETE",
    });
    if (res.ok) setVideos((v) => v.filter((x) => x.id !== id));
  }

  const paginas = Math.max(1, Math.ceil(total / 24));

  return (
    <div className="flex flex-col gap-6">
      <EnviarViral
        aoEnviar={() => {
          setAba("meus");
          setPagina(1);
          carregar();
        }}
      />

      <div className="flex items-center gap-1 border-b border-[var(--hairline)]">
        {(["todos", "meus"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setAba(a);
              setPagina(1);
            }}
            className={`-mb-px border-b-2 px-4 py-2 text-[13px] transition-colors ${
              aba === a
                ? "border-[var(--ink)] text-[var(--ink)]"
                : "border-transparent text-[var(--mute)] hover:text-[var(--ink)]"
            }`}
          >
            {a === "todos" ? "Todos os virais" : "Meus envios"}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-[var(--ash)]">{total} vídeo(s)</span>
      </div>

      {erro && <p className="text-[13px] text-[var(--status-error)]">{erro}</p>}

      {carregando ? (
        <div className="flex items-center gap-2 font-mono text-[12px] text-[var(--ash)]">
          <Loader2 className="size-4 animate-spin" /> carregando…
        </div>
      ) : videos.length === 0 ? (
        <p className="text-[13px] text-[var(--mute)]">
          {aba === "meus"
            ? "Você ainda não enviou nenhum viral. Cole um link aí em cima."
            : "O acervo está vazio — seja o primeiro a mandar um viral."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {videos.map((v) => (
            <article
              key={v.id}
              className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)]"
            >
              <div className="relative aspect-[9/16] w-full bg-[var(--surface-deep)]">
                {v.videoUrl ? (
                  <video
                    src={v.videoUrl}
                    poster={v.thumbUrl ?? undefined}
                    controls
                    preload="none"
                    className="size-full object-cover"
                  />
                ) : v.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center font-mono text-[11px] text-[var(--ash)]">
                    sem prévia
                  </div>
                )}
                {v.meu && (
                  <span className="absolute left-2 top-2 rounded-[var(--radius-full)] bg-[var(--surface-deep)]/90 px-2 py-0.5 font-mono text-[10px] text-[var(--status-online)]">
                    seu envio
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px] text-[var(--mute)]">
                    {v.autor ? `@${v.autor.replace(/^@/, "")}` : "—"}
                  </span>
                  <span className="font-mono text-[10px] uppercase text-[var(--ash)]">{v.plataforma}</span>
                </div>

                {v.legenda && (
                  <p className="line-clamp-2 text-[12px] leading-snug text-[var(--body)]">{v.legenda}</p>
                )}

                <div className="mt-auto flex items-center gap-3 font-mono text-[11px] text-[var(--ash)]">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="size-3" />
                    {num(v.likes)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3" />
                    {num(v.views)}
                  </span>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir o post original"
                    className="ml-auto inline-flex items-center gap-1 hover:text-[var(--ink)]"
                  >
                    <ExternalLink className="size-3" /> post
                  </a>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => remover(v.id)}
                      title="Tirar do acervo"
                      className="text-[var(--status-error)] hover:opacity-70"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {paginas > 1 && (
        <div className="flex items-center justify-center gap-3 font-mono text-[11px] text-[var(--ash)]">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => p - 1)}
            className="rounded-[var(--radius)] border border-[var(--hairline-strong)] px-2.5 py-1 disabled:opacity-40"
          >
            anterior
          </button>
          <span>
            {pagina} / {paginas}
          </span>
          <button
            type="button"
            disabled={pagina >= paginas}
            onClick={() => setPagina((p) => p + 1)}
            className="rounded-[var(--radius)] border border-[var(--hairline-strong)] px-2.5 py-1 disabled:opacity-40"
          >
            próxima
          </button>
        </div>
      )}
    </div>
  );
}
