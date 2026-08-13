"use client";

/**
 * Banco de Cenas (13/08) — galeria com duas abas:
 *   Minhas cenas → tudo do usuário (as com pessoa levam selo "com você")
 *   Acervo       → cenas compartilhadas de todo mundo (reuso grátis, sem rosto)
 * Miniaturas em grade; clicou → player expandido. Só visualização — o reuso
 * continua automático no planejador do Estúdio.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, UserRound, X } from "lucide-react";

type Item = {
  id: string;
  concept: string;
  created_at: string;
  video_url: string | null;
  com_pessoa: boolean;
};

export function BancoCenas() {
  const t = useTranslations("bancoCenas");
  const [aba, setAba] = useState<"mine" | "acervo">("mine");
  const [dados, setDados] = useState<{ mine: Item[]; acervo: Item[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [abertaId, setAbertaId] = useState<string | null>(null);

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
  const aberta = lista.find((c) => c.id === abertaId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-[13px]">
        {(["mine", "acervo"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setAba(a);
              setAbertaId(null);
            }}
            className={[
              "rounded-full border px-3 py-1",
              aba === a ? "border-[var(--ink)] text-[var(--ink)]" : "border-[var(--hairline)] text-[var(--mute)]",
            ].join(" ")}
          >
            {t(`abas.${a}`)}
            {dados && <span className="ml-1.5 text-[11px] text-[var(--ash)]">{dados[a].length}</span>}
          </button>
        ))}
      </div>

      {erro ? (
        <p className="text-[13px] text-red-400">{t("erro")}</p>
      ) : dados === null ? (
        <p className="flex items-center gap-2 text-[13px] text-[var(--mute)]">
          <Loader2 className="size-4 animate-spin" /> {t("carregando")}
        </p>
      ) : lista.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] p-4 text-[13px] text-[var(--mute)]">
          {t(aba === "mine" ? "vazioMine" : "vazioAcervo")}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {lista.map((c) => (
            <li key={c.id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setAbertaId(abertaId === c.id ? null : c.id)}
                aria-pressed={abertaId === c.id}
                title={c.concept}
                className={`relative block w-full overflow-hidden rounded-[var(--radius-sm)] border transition-colors ${
                  abertaId === c.id
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
                {c.com_pessoa && (
                  <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-[var(--surface-deep)]/85 px-1.5 py-0.5 text-[9px] text-[var(--silver)]">
                    <UserRound className="size-2.5" /> {t("comVoce")}
                  </span>
                )}
              </button>
              <span className="truncate text-[10.5px] text-[var(--mute)]">{c.concept}</span>
            </li>
          ))}
        </ul>
      )}

      {aberta?.video_url && (
        <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] p-3.5">
          <p className="text-[13px] font-medium text-[var(--ink)]">{aberta.concept}</p>
          <video src={aberta.video_url} controls playsInline preload="metadata" className="max-h-96 w-auto self-start rounded-[var(--radius-sm)] border border-[var(--hairline)]" />
        </div>
      )}
    </div>
  );
}
