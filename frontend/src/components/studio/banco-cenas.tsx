"use client";

/**
 * Explorador do Banco de Cenas (13/08) — vive DENTRO da geração de cenas do
 * Estúdio Automático (decisão Johnny: solto no menu fica fora de contexto).
 * Abas: Minhas cenas (inclui as privadas "com você") · Acervo (compartilhadas
 * de todos — C3). Clicar numa miniatura SELECIONA a cena pro vídeo (reuso
 * grátis); a IA encaixa cada escolhida na frase onde faz mais sentido.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, UserRound, X } from "lucide-react";

type Item = {
  id: string;
  concept: string;
  created_at: string;
  video_url: string | null;
  com_pessoa: boolean;
};

export function BancoCenasPicker({
  selecionadas,
  onToggle,
  max,
}: {
  selecionadas: string[];
  onToggle: (id: string) => void;
  max: number;
}) {
  const t = useTranslations("bancoCenas");
  const [aba, setAba] = useState<"mine" | "acervo">("acervo");
  const [dados, setDados] = useState<{ mine: Item[]; acervo: Item[] } | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    fetch("/api/v1/studio/scenes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http"))))
      .then((j) => {
        const d = j?.data ?? j ?? {};
        setDados({ mine: d.mine ?? [], acervo: d.acervo ?? [] });
      })
      .catch(() => setErro(true));
  }, []);

  const lista = dados ? dados[aba] : [];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2 text-[12.5px]">
        {(["acervo", "mine"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={[
              "rounded-full border px-3 py-1",
              aba === a ? "border-[var(--ink)] text-[var(--ink)]" : "border-[var(--hairline)] text-[var(--mute)]",
            ].join(" ")}
          >
            {t(`abas.${a}`)}
            {dados && <span className="ml-1.5 text-[11px] text-[var(--ash)]">{dados[a].length}</span>}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-[var(--ash)]">
          {t("selecionadas", { n: selecionadas.length, max })}
        </span>
      </div>

      {erro ? (
        <p className="text-[13px] text-red-400">{t("erro")}</p>
      ) : dados === null ? (
        <p className="flex items-center gap-2 text-[13px] text-[var(--mute)]">
          <Loader2 className="size-4 animate-spin" /> {t("carregando")}
        </p>
      ) : lista.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--hairline-strong)] p-3 text-[12.5px] text-[var(--mute)]">
          {t(aba === "mine" ? "vazioMine" : "vazioAcervo")}
        </p>
      ) : (
        <ul className="grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-5">
          {lista.map((c) => {
            const ativa = selecionadas.includes(c.id);
            return (
              <li key={c.id} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => onToggle(c.id)}
                  disabled={!ativa && selecionadas.length >= max}
                  aria-pressed={ativa}
                  title={c.concept}
                  className={`relative block w-full overflow-hidden rounded-[var(--radius-sm)] border transition-colors disabled:opacity-40 ${
                    ativa
                      ? "border-[var(--hairline-bright)] shadow-[0_0_0_1px_var(--hairline-bright)]"
                      : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
                  }`}
                >
                  {c.video_url ? (
                    <video src={c.video_url} muted playsInline preload="metadata" className="aspect-[9/16] w-full object-cover" />
                  ) : (
                    <span className="grid aspect-[9/16] w-full place-items-center">
                      <X className="size-4 text-[var(--ash)]" />
                    </span>
                  )}
                  {ativa && (
                    <span className="absolute right-1 top-1 rounded-full bg-[var(--silver)] p-0.5 text-[var(--canvas)]">
                      <Check className="size-3" />
                    </span>
                  )}
                  {c.com_pessoa && (
                    <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-[var(--surface-deep)]/85 px-1.5 py-0.5 text-[9px] text-[var(--silver)]">
                      <UserRound className="size-2.5" /> {t("comVoce")}
                    </span>
                  )}
                </button>
                <span className="truncate text-[10px] text-[var(--mute)]">{c.concept}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
