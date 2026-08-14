"use client";

/**
 * R0 — qual viral você vai comentar.
 *
 * Vem da PRATELEIRA (Meus Virais). Prateleira vazia manda garimpar em vez de
 * pedir link: o acervo é o ponto de partida do produto.
 */
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { compacto } from "@/components/lab/virais-estilo";
import type { ReactDraft, ViralEscolhido } from "./react-tipos";

export function ReactPassoVideo({
  draft,
  update,
}: {
  draft: ReactDraft;
  update: (m: Partial<ReactDraft>) => void;
}) {
  const [lista, setLista] = useState<ViralEscolhido[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/v1/virais/videos?meus=1&limite=120&ordem=score");
        const j = await r.json();
        setLista(r.ok ? (j.videos ?? []) : []);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">
          Qual vídeo você vai comentar?
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--mute)]">
          Escolha um dos virais que você guardou. O arquivo só é baixado quando o React
          for gerado — guardar não baixa nada.
        </p>
      </div>

      {carregando ? (
        <p className="text-[13px] text-[var(--mute)]">Carregando sua prateleira…</p>
      ) : lista.length === 0 ? (
        <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--hairline-strong)] p-6 text-center">
          <p className="text-[13.5px] text-[var(--mute)]">
            Sua prateleira está vazia. Garimpe na{" "}
            <Link href="/app/lab/virais" className="font-medium text-[var(--ink)] underline">
              Galeria de Vídeos Virais
            </Link>{" "}
            e guarde os que quiser usar.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {lista.map((v) => {
            const escolhido = draft.viral?.id === v.id;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => update({ viral: escolhido ? null : v })}
                  title={`@${v.autor ?? "?"} · ${compacto(v.likes)} likes`}
                  className={`relative block w-full overflow-hidden rounded-[var(--radius-sm)] border transition-colors ${
                    escolhido
                      ? "border-[var(--ink)] shadow-[0_0_0_1px_var(--ink)]"
                      : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
                  }`}
                >
                  {v.thumb_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumb_url}
                      alt=""
                      className="aspect-[9/16] w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex aspect-[9/16] w-full items-center justify-center bg-black/70 text-[10px] text-white/60">
                      sem capa
                    </span>
                  )}
                  {escolhido && (
                    <span className="absolute right-0.5 top-0.5 rounded bg-[var(--ink)] px-1 text-[9px] font-semibold text-[var(--surface-deep)]">
                      ✓
                    </span>
                  )}
                  {v.download_status === "pronto" && (
                    <span
                      className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] text-white/90"
                      title="Arquivo já baixado"
                    >
                      ⬇
                    </span>
                  )}
                </button>
                <span className="mt-0.5 block truncate text-[9px] text-[var(--mute)]">
                  {v.duracao_seg ? `${Math.round(v.duracao_seg)}s · ` : ""}
                  {compacto(v.likes)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {draft.viral && (
        <p className="rounded-[var(--radius-sm)] bg-[var(--surface-deep)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
          Escolhido: <strong>@{draft.viral.autor ?? "?"}</strong>
          {draft.viral.duracao_seg ? ` · ${Math.round(draft.viral.duracao_seg)}s de vídeo` : ""}
          {draft.viral.download_status === "pronto" ? " · arquivo já baixado" : ""}
        </p>
      )}
    </div>
  );
}
