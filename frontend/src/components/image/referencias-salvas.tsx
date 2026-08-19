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
import { Loader2, Pin, Trash2 } from "lucide-react";

type Ref = { key: string; url: string; size: number; at: string | null };

export function ReferenciasSalvas({
  reloadKey = 0,
  onUseAsRef,
}: {
  reloadKey?: number;
  onUseAsRef?: (key: string, url: string) => void;
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
  }, [load, reloadKey]);

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
        {refs.map((r) => (
          <li
            key={r.key}
            className="group flex flex-col gap-1.5 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-2"
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-deep)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.url} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onUseAsRef?.(r.key, r.url)}
                title={t("use")}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] py-1 font-sans text-[11px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
              >
                <Pin className="h-3 w-3 text-[var(--silver)]" />
                {t("use")}
              </button>
              <button
                type="button"
                onClick={() => void apagar(r.key)}
                disabled={apagando === r.key}
                title={t("delete")}
                className="inline-flex h-[24px] w-[24px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline)] text-[var(--mute)] hover:text-[var(--status-error)] disabled:opacity-50"
              >
                {apagando === r.key ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
