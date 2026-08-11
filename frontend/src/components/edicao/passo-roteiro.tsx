"use client";

/**
 * 🚧 Vídeo Edição 2.0 — E1 Roteiro (W1 da spec 11/08).
 * Três entradas, mesmo produto: escrever/colar direto · gerar com IA (ideia
 * OU link de referência — reusa a API do Gerador de Roteiro) · pegar do
 * histórico. O texto final vive no rascunho do wizard e segue pras próximas
 * estações (E2 pré-preenche o TTS/teleprompter com ele).
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";
import { ROTEIRO_COST, ROTEIRO_DURATIONS, ROTEIRO_IDEA_MAX } from "@/lib/roteiro/config";
import type { EdicaoDraft } from "./edicao-wizard";

type Props = {
  draft: EdicaoDraft;
  onChange: (patch: Partial<EdicaoDraft>) => void;
};

type HistItem = { id: string; idea: string | null; seconds: number; script: string; created_at: string };

export function PassoRoteiro({ draft, onChange }: Props) {
  const t = useTranslations("edicao.roteiro");
  const [modo, setModo] = useState<"escrever" | "gerar" | "historico">(
    draft.roteiro ? "escrever" : "gerar",
  );
  const [idea, setIdea] = useState("");
  const [link, setLink] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [hist, setHist] = useState<HistItem[] | null>(null);

  useEffect(() => {
    if (modo !== "historico" || hist !== null) return;
    void fetch("/api/v1/roteiro")
      .then((r) => r.json())
      .then((j) => setHist(((j?.data?.items ?? j?.items ?? []) as HistItem[]).slice(0, 12)))
      .catch(() => setHist([]));
  }, [modo, hist]);

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = { seconds: draft.seconds };
      if (link.trim()) body.link = link.trim();
      else body.idea = idea.trim();
      const res = await fetch("/api/v1/roteiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(j?.error?.message ?? j?.message ?? t("erroGerar"));
        return;
      }
      const script = (j?.data?.script ?? j?.script ?? "") as string;
      const id = (j?.data?.id ?? j?.id ?? null) as string | null;
      onChange({ roteiro: script, roteiroId: id });
      setModo("escrever");
    } finally {
      setGerando(false);
    }
  }

  const podeGerar = Boolean(link.trim() || idea.trim().length >= 10);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-[13px]">
        {(["gerar", "escrever", "historico"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={[
              "rounded-full border px-3 py-1",
              modo === m
                ? "border-[var(--ink)] text-[var(--ink)]"
                : "border-[var(--hairline)] text-[var(--mute)]",
            ].join(" ")}
          >
            {t(`modos.${m}`)}
          </button>
        ))}
      </div>

      {modo === "gerar" && (
        <div className="flex flex-col gap-3">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value.slice(0, ROTEIRO_IDEA_MAX))}
            placeholder={t("ideaPlaceholder")}
            rows={3}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13.5px] text-[var(--ink)] placeholder:text-[var(--ash)]"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder={t("linkPlaceholder")}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ash)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[13px] text-[var(--mute)]">{t("duracao")}</label>
            <select
              value={draft.seconds}
              onChange={(e) => onChange({ seconds: Number(e.target.value) })}
              className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)]"
            >
              {ROTEIRO_DURATIONS.map((s) => (
                <option key={s} value={s}>
                  {s}s
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void gerar()}
              disabled={gerando || !podeGerar}
              className="ml-auto flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
            >
              {gerando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {gerando ? t("gerando") : t("gerarBtn", { custo: ROTEIRO_COST })}
            </button>
          </div>
          {erro && <p className="text-[13px] text-red-400">{erro}</p>}
        </div>
      )}

      {modo === "historico" && (
        <ul className="flex flex-col gap-1.5">
          {hist === null && (
            <li className="text-[13px] text-[var(--mute)]">{t("carregando")}</li>
          )}
          {hist?.length === 0 && (
            <li className="text-[13px] text-[var(--mute)]">{t("historicoVazio")}</li>
          )}
          {hist?.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({ roteiro: h.script, roteiroId: h.id, seconds: h.seconds });
                  setModo("escrever");
                }}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-left hover:border-[var(--hairline-strong)]"
              >
                <p className="truncate text-[13px] text-[var(--ink)]">
                  {h.idea || h.script.slice(0, 70)}
                </p>
                <p className="text-[11.5px] text-[var(--ash)]">
                  {h.seconds}s · {new Date(h.created_at).toLocaleDateString()}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* O roteiro (fonte da verdade do wizard) — visível em todos os modos */}
      <div>
        <label className="text-[12.5px] font-medium text-[var(--mute)]">{t("seuRoteiro")}</label>
        <textarea
          value={draft.roteiro}
          onChange={(e) => onChange({ roteiro: e.target.value, roteiroId: null })}
          placeholder={t("roteiroPlaceholder")}
          rows={9}
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13.5px] leading-relaxed text-[var(--ink)] placeholder:text-[var(--ash)]"
        />
        {draft.roteiro && (
          <p className="mt-1 text-[11.5px] text-[var(--ash)]">
            {t("contagem", { chars: draft.roteiro.length })}
          </p>
        )}
      </div>
    </div>
  );
}
