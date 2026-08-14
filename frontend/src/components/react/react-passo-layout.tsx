"use client";

/**
 * R5 — como você aparece junto do viral.
 *
 * Os três layouts saem da conversa de 14/08:
 *  · recorte — você por cima do viral, o formato do vídeo do Lucas. Depende
 *    do chroma key, que foi PROVADO na mão em 14/08 (foto → fundo verde →
 *    clone → recorte limpo sobre fundo claro e escuro).
 *  · viral em cima / você embaixo — e o contrário. Empilhar dois vídeos é
 *    ffmpeg puro, sem risco nenhum.
 *
 * O desenho é feito em CSS de propósito: mostrar a ideia não exige carregar
 * vídeo nenhum, e o preview real só existe depois da montagem.
 */
import { LegendaPicker } from "@/components/edicao/legenda-picker";
import type { LayoutReact, ReactDraft } from "./react-tipos";

const OPCOES: { id: LayoutReact; titulo: string; corpo: string }[] = [
  {
    id: "recorte",
    titulo: "Você por cima do viral",
    corpo: "O formato do Lucas: o vídeo ocupa a tela e você aparece recortado num canto.",
  },
  {
    id: "viral-em-cima",
    titulo: "Viral em cima, você embaixo",
    corpo: "Tela dividida ao meio. O jeito mais seguro e legível.",
  },
  {
    id: "viral-embaixo",
    titulo: "Você em cima, viral embaixo",
    corpo: "Mesma divisão, invertida — bom quando a sua reação é o assunto.",
  },
];

export function ReactPassoLayout({
  draft,
  update,
}: {
  draft: ReactDraft;
  update: (m: Partial<ReactDraft>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Como você aparece</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--mute)]">
          O áudio do viral abaixa quando você fala e volta quando você cala — nos três.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {OPCOES.map((o) => {
          const ativo = draft.layout === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => update({ layout: ativo ? null : o.id })}
                className={`flex h-full w-full flex-col gap-2 rounded-[var(--radius-sm)] border p-3 text-left transition-colors ${
                  ativo
                    ? "border-[var(--ink)] bg-[var(--surface-deep)]"
                    : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
                }`}
              >
                <Desenho id={o.id} />
                <span className="text-[13px] font-semibold text-[var(--ink)]">{o.titulo}</span>
                <span className="text-[11.5px] leading-snug text-[var(--mute)]">{o.corpo}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Legenda: o MESMO seletor do editor de vídeo (ordem do Johnny 14/08 —
          "preciso escolher da mesma forma que está no editor"). Reuso direto,
          nada de galeria paralela que envelhece sozinha. */}
      <div className="border-t border-[var(--hairline)] pt-4">
        <h3 className="mb-2 text-[13px] font-semibold text-[var(--ink)]">Legenda</h3>
        <LegendaPicker
          value={draft.legendaEstilo}
          onChange={(id) => update({ legendaEstilo: id })}
          position={draft.legendaPosicao}
          onPosition={(p) => update({ legendaPosicao: p })}
          size={draft.legendaTamanho}
          onSize={(s) => update({ legendaTamanho: s })}
        />
      </div>
    </div>
  );
}

/** Miniatura do formato — CSS puro, sem carregar vídeo. */
function Desenho({ id }: { id: LayoutReact }) {
  const moldura =
    "relative mx-auto aspect-[9/16] w-20 overflow-hidden rounded-[6px] border border-[var(--hairline-strong)] bg-[var(--surface-deep)]";
  const viral = "bg-[var(--surface-elevated)]";
  const eu = "bg-[#ff6a00]/70";

  if (id === "recorte") {
    return (
      <span className={moldura}>
        <span className={`absolute inset-0 ${viral}`} />
        <span className={`absolute bottom-1 left-1 h-7 w-5 rounded-[3px] ${eu}`} />
      </span>
    );
  }
  const emCima = id === "viral-em-cima";
  return (
    <span className={moldura}>
      <span className={`absolute inset-x-0 top-0 h-1/2 ${emCima ? viral : eu}`} />
      <span className={`absolute inset-x-0 bottom-0 h-1/2 ${emCima ? eu : viral}`} />
    </span>
  );
}
