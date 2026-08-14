"use client";

/**
 * Fundo do trecho em que você aparece SOZINHO na tela.
 *
 * Pedido do Johnny (14/08), vendo o 1º React pronto: "essa parte que eu
 * apareço grande na cena deveria ter outro fundo, ou um fundo escolhido por
 * mim, como a imagem do site". O padrão continua sendo o azul escuro — isto é
 * opcional e só aparece quando a fala passa do viral.
 *
 * As imagens saem da galeria que o aluno já tem (/api/v1/images); não existe
 * upload novo aqui de propósito.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type Imagem = { id: string; image_url: string | null };

export function ReactFundoFinal({
  valor,
  onChange,
}: {
  valor: string | null;
  onChange: (url: string | null) => void;
}) {
  const [galeria, setGaleria] = useState<Imagem[] | null>(null);
  const [aberta, setAberta] = useState(false);

  useEffect(() => {
    if (!aberta || galeria) return;
    void (async () => {
      try {
        const r = await fetch("/api/v1/images", { cache: "no-store" });
        const j = await r.json();
        const itens = ((j.images ?? j.items ?? []) as Imagem[]).filter((i) => i.image_url);
        setGaleria(itens.slice(0, 24));
      } catch {
        setGaleria([]);
      }
    })();
  }, [aberta, galeria]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { v: null, r: "Fundo escuro" },
          { v: "galeria", r: "Uma imagem minha" },
        ].map((o) => {
          const ativo = o.v === null ? !valor : Boolean(valor) || aberta;
          return (
            <button
              key={o.r}
              type="button"
              onClick={() => {
                if (o.v === null) {
                  onChange(null);
                  setAberta(false);
                } else {
                  setAberta(true);
                }
              }}
              className={`h-8 rounded-full border px-3 text-[12px] ${
                ativo
                  ? "border-[var(--ink)] text-[var(--ink)]"
                  : "border-[var(--hairline)] text-[var(--mute)]"
              }`}
            >
              {o.r}
            </button>
          );
        })}
        {valor && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={valor}
            alt=""
            className="h-8 w-8 rounded-[4px] border border-[var(--hairline-strong)] object-cover"
          />
        )}
      </div>

      {aberta && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--hairline)] p-2">
          {galeria === null ? (
            <p className="flex items-center gap-2 text-[12px] text-[var(--mute)]">
              <Loader2 className="size-3.5 animate-spin" /> carregando as suas imagens…
            </p>
          ) : galeria.length === 0 ? (
            <p className="text-[12px] text-[var(--mute)]">
              Você ainda não tem imagens na galeria — o fundo escuro fica.
            </p>
          ) : (
            <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
              {galeria.map((img) => (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(img.image_url);
                      setAberta(false);
                    }}
                    className={`block aspect-square w-full overflow-hidden rounded-[4px] border ${
                      valor === img.image_url
                        ? "border-[var(--ink)]"
                        : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.image_url!} alt="" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
