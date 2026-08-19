"use client";

/**
 * Aba "Referências salvas" (19/08, pedido do Johnny depois do print do erro
 * "uma das fotos de referência não existe mais").
 *
 * Toda foto que vira referência é COPIADA pra cá pelo servidor (`refs/`), e o
 * apagar-do-histórico nunca toca nesta área — então a foto da pessoa não some
 * mais quando ela limpa gerações antigas. Esta aba é a cara desse acervo:
 * ver, reusar ("Usar como referência") e apagar de propósito.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Loader2, Pin, Trash2 } from "lucide-react";

type Ref = { key: string; url: string; size: number; at: string | null };

export function ReferenciasSalvas({
  reloadKey = 0,
  currentRefKey = null,
  extrasKeys = [],
  onUseAsRef,
  onAddExtra,
}: {
  reloadKey?: number;
  /** Chave da referência EM USO: o card dela ganha a marca e trava o botão. */
  currentRefKey?: string | null;
  /** Chaves já no quadro de fotos extras: o card marca e trava o botão. */
  extrasKeys?: string[];
  onUseAsRef?: (key: string, url: string) => void;
  /** Manda a foto pro quadro de fotos extras do gerador (sem upload novo). */
  onAddExtra?: (key: string, url: string) => void;
}) {
  const t = useTranslations("images.refs");
  const [refs, setRefs] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/v1/images/refs", { cache: "no-store" });
      if (!r.ok) throw new Error(t("errors.load"));
      const j = await r.json();
      setRefs((j.refs ?? []) as Ref[]);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
    // currentRefKey na dependência: quando uma foto nova é adotada (vira a
    // atual), a lista recarrega e ela já aparece aqui com a marca.
  }, [load, reloadKey, currentRefKey]);

  async function apagar(key: string) {
    setApagando(key);
    try {
      const r = await fetch(`/api/v1/images/refs?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      if (!r.ok) throw new Error(t("errors.delete"));
      setRefs((prev) => prev.filter((x) => x.key !== key));
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("errors.delete"));
    } finally {
      setApagando(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-[var(--mute)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="font-mono text-[12px]">{t("loading")}</span>
      </div>
    );
  }

  if (refs.length === 0) {
    return (
      <p className="py-6 text-[13px] text-[var(--mute)]">{t("empty")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <p className="text-[12px] text-[var(--status-error)]">{erro}</p>}
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {refs.map((r) => {
          const emUso = currentRefKey === r.key;
          const nasExtras = extrasKeys.includes(r.key);
          return (
          <li
            key={r.key}
            className={`group flex flex-col gap-1.5 rounded-[var(--radius)] border bg-[var(--surface-card)] p-2 ${
              emUso ? "border-[var(--ink)]" : "border-[var(--hairline)]"
            }`}
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-deep)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.url} alt="" className="h-full w-full object-cover" />
              {emUso && (
                <span className="absolute left-1 top-1 rounded-full bg-[var(--canvas)]/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-white">
                  {t("current")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={emUso}
                onClick={() => onUseAsRef?.(r.key, r.url)}
                title={emUso ? t("currentTitle") : t("use")}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] py-1 font-sans text-[11px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)] disabled:opacity-60"
              >
                <Pin className="h-3 w-3 text-[var(--silver)]" />
                {emUso ? t("current") : t("use")}
              </button>
              {/* Quem está no quadro (atual OU extra) não se apaga daqui: o
                  gerador ficaria apontando pra uma foto morta — o mesmo
                  defeito que esta aba existe pra curar. Tire do quadro
                  primeiro, depois apague. */}
              <button
                type="button"
                onClick={() => void apagar(r.key)}
                disabled={apagando === r.key || emUso || nasExtras}
                title={emUso ? t("currentTitle") : nasExtras ? t("inExtras") : t("delete")}
                className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline)] text-[var(--mute)] hover:text-[var(--status-error)] disabled:opacity-50"
              >
                {apagando === r.key ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </div>
            {/* Do banco direto pro quadro de extras (sem upload novo): é assim
                que a pessoa monta o conjunto principal + extras da geração. */}
            <button
              type="button"
              disabled={emUso || nasExtras}
              onClick={() => onAddExtra?.(r.key, r.url)}
              title={emUso ? t("currentTitle") : nasExtras ? t("inExtras") : t("addExtra")}
              className="inline-flex items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-[var(--hairline)] py-1 font-sans text-[11px] font-medium text-[var(--mute)] hover:border-[var(--hairline-strong)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              <ImagePlus className="h-3 w-3" />
              {nasExtras ? t("inExtras") : t("addExtra")}
            </button>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
