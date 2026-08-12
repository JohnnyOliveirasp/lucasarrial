"use client";

/**
 * 🚧 Vídeo Edição 2.0 — E4 "Quer editar?" (W5 da spec 11/08, fase 1).
 * NÃO → avança direto pra publicação (a estação é opcional por desenho).
 * SIM → por tipo de vídeo base:
 *  - CENAS: re-montagem do MESMO projeto do Estúdio com legendas karaokê,
 *    trilha e estilo de corte (o worker já suporta tudo — 200 cr por render).
 *  - CLONE: legendas/b-roll exigem os jobs novos do worker (fase 2 da W5,
 *    caption_burn + overlay) — placeholder honesto até lá.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Captions, Check, Film, Loader2, Music, Sparkles, SkipForward } from "lucide-react";
import { STUDIO_MONTAGE_COST } from "@/lib/studio/pricing";
import { EDICAO_CAPTION_COST } from "@/lib/edicao/pricing";
import type { EdicaoDraft } from "./edicao-wizard";

type Trilha = { key: string; label: string };

type Props = {
  draft: EdicaoDraft;
  onChange: (patch: Partial<EdicaoDraft>) => void;
};

export function PassoEditar({ draft, onChange }: Props) {
  const t = useTranslations("edicao.editar");
  const [querEditar, setQuerEditar] = useState<boolean | null>(null);

  if (!draft.video) {
    return (
      <p className="rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-[13px] text-[var(--mute)]">
        {t("semVideo")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setQuerEditar(false)}
          className={[
            "rounded-[var(--radius)] border p-4 text-left",
            querEditar === false ? "border-[var(--ink)]" : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]",
          ].join(" ")}
        >
          <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
            <SkipForward className="size-4" /> {t("nao.titulo")}
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--mute)]">{t("nao.corpo")}</p>
        </button>
        <button
          type="button"
          onClick={() => setQuerEditar(true)}
          className={[
            "rounded-[var(--radius)] border p-4 text-left",
            querEditar === true ? "border-[var(--ink)]" : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]",
          ].join(" ")}
        >
          <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
            <Sparkles className="size-4" /> {t("sim.titulo")}
          </p>
          <p className="mt-1 text-[12.5px] text-[var(--mute)]">{t("sim.corpo")}</p>
        </button>
      </div>

      {querEditar === false && (
        <p className="rounded-[var(--radius-sm)] border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">
          {t("podeAvancar")}
        </p>
      )}

      {querEditar === true &&
        (draft.video.kind === "cenas" ? (
          <EditarCenas draft={draft} />
        ) : (
          <EditarClone draft={draft} onChange={onChange} />
        ))}
    </div>
  );
}

/* ── Clone: legendas karaokê queimadas no MP4 pronto (job caption_burn) ── */
function EditarClone({ draft, onChange }: Props) {
  const t = useTranslations("edicao.editar.clone");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const job = draft.captionJob;

  // Poll do job em voo (retomável — o job mora no draft/localStorage).
  useEffect(() => {
    if (!job) return;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/v1/edicao/captions?job=${encodeURIComponent(job.job)}&key=${encodeURIComponent(job.key)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const j = await res.json();
        const d = j?.data ?? j;
        if (d.status === "ready") {
          setVideoUrl(d.video_url ?? null);
          onChange({ videoEditadoKey: job.key, captionJob: null });
        } else if (d.status === "failed") {
          setErro(d.error ?? t("erro"));
          onChange({ captionJob: null });
        }
      } catch {
        /* próximo tick */
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.job]);

  async function legendar() {
    if (!draft.video || !draft.audio) return;
    setBusy(true);
    setErro(null);
    setVideoUrl(null);
    try {
      const res = await fetch("/api/v1/edicao/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: { kind: draft.video.kind, id: draft.video.id },
          audio:
            draft.audio.kind === "generation"
              ? { kind: "generation", id: draft.audio.id }
              : { kind: "take", key: draft.audio.key },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(t("semCreditos"));
      if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? t("erro"));
      const d = j?.data ?? j;
      onChange({ captionJob: { job: d.job_id, key: d.output_key }, videoEditadoKey: null });
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erro"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
      {job ? (
        <p className="flex items-center gap-2 text-[13.5px] text-[var(--ink)]">
          <Loader2 className="size-4 animate-spin" /> {t("legendando")}
        </p>
      ) : (
        <>
          {draft.videoEditadoKey && (
            <p className="flex items-center gap-2 text-[13.5px] font-medium text-emerald-300">
              <Film className="size-4" /> {t("pronto")}
            </p>
          )}
          {videoUrl && <video src={videoUrl} controls className="max-h-96 w-full rounded-[var(--radius-sm)]" />}
          <p className="text-[13px] text-[var(--mute)]">{t("intro")}</p>
          <button
            type="button"
            onClick={() => void legendar()}
            disabled={busy}
            className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Captions className="size-4" />}
            {draft.videoEditadoKey ? t("legendarDeNovo", { custo: EDICAO_CAPTION_COST }) : t("legendar", { custo: EDICAO_CAPTION_COST })}
          </button>
          <p className="text-[12px] text-[var(--ash)]">{t("brollEmBreve")}</p>
          {erro && <p className="text-[13px] text-red-400">{erro}</p>}
        </>
      )}
    </div>
  );
}

/* ── Cenas: re-montagem com legendas + trilha + estilo (200 cr) ── */
function EditarCenas({ draft }: { draft: EdicaoDraft }) {
  const t = useTranslations("edicao.editar.cenas");
  const projectId = draft.video?.kind === "cenas" ? draft.video.id : null;
  const [trilhas, setTrilhas] = useState<Trilha[] | null>(null);
  const [legendas, setLegendas] = useState(true);
  const [musicKey, setMusicKey] = useState("");
  const [estilo, setEstilo] = useState<"dynamic" | "sober">("dynamic");
  const [transicao, setTransicao] = useState<"corte" | "fade" | "fade_branco">("corte");
  const [fase, setFase] = useState<"form" | "montando" | "pronto">("form");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/v1/studio/music")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setTrilhas(((j?.data?.tracks ?? j?.tracks ?? []) as Trilha[])))
      .catch(() => setTrilhas([]));
  }, []);

  const carregar = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/v1/studio/${projectId}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      const p = j?.data?.project ?? j?.project;
      if (!p) return;
      if (p.montage_status === "ready") {
        setVideoUrl(p.video_url ?? null);
        setFase("pronto");
      } else if (p.montage_status === "failed") {
        setErro(p.montage_error || t("erro"));
        setFase("form");
      }
    } catch {
      /* próximo tick */
    }
  }, [projectId, t]);

  // Poll da re-montagem (o GET é o motor do Estúdio).
  useEffect(() => {
    if (fase !== "montando") return;
    const timer = setInterval(() => void carregar(), 5000);
    return () => clearInterval(timer);
  }, [fase, carregar]);

  async function aplicar() {
    if (!projectId) return;
    setBusy(true);
    setErro(null);
    try {
      const res = await fetch(`/api/v1/studio/${projectId}/montage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captions: legendas,
          edit_style: estilo,
          transition: transicao,
          ...(musicKey ? { music_key: musicKey } : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(t("semCreditos"));
      if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? t("erro"));
      setFase("montando");
      setVideoUrl(null);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erro"));
    } finally {
      setBusy(false);
    }
  }

  if (!projectId) return null;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
      {fase === "montando" ? (
        <p className="flex items-center gap-2 text-[13.5px] text-[var(--ink)]">
          <Loader2 className="size-4 animate-spin" /> {t("montando")}
        </p>
      ) : (
        <>
          {fase === "pronto" && (
            <>
              <p className="flex items-center gap-2 text-[13.5px] font-medium text-emerald-300">
                <Film className="size-4" /> {t("pronto")}
              </p>
              {videoUrl && <video src={videoUrl} controls className="max-h-96 w-full rounded-[var(--radius-sm)]" />}
            </>
          )}

          <label className="flex w-fit cursor-pointer items-center gap-2 text-[13.5px] text-[var(--ink)]">
            <input
              type="checkbox"
              checked={legendas}
              onChange={(e) => setLegendas(e.target.checked)}
              className="accent-[var(--ink)]"
            />
            {t("legendas")}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Music className="size-4 text-[var(--mute)]" aria-hidden />
            <select
              value={musicKey}
              onChange={(e) => setMusicKey(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)]"
            >
              <option value="">{t("semMusica")}</option>
              {(trilhas ?? []).map((tr) => (
                <option key={tr.key} value={tr.key}>
                  {tr.label}
                </option>
              ))}
            </select>
            <select
              value={estilo}
              onChange={(e) => setEstilo(e.target.value === "sober" ? "sober" : "dynamic")}
              className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)]"
            >
              <option value="dynamic">{t("estiloDinamico")}</option>
              <option value="sober">{t("estiloSobrio")}</option>
            </select>
            <select
              value={transicao}
              onChange={(e) =>
                setTransicao(
                  e.target.value === "fade" ? "fade" : e.target.value === "fade_branco" ? "fade_branco" : "corte",
                )
              }
              className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)]"
            >
              <option value="corte">{t("transicaoCorte")}</option>
              <option value="fade">{t("transicaoFade")}</option>
              <option value="fade_branco">{t("transicaoFadeBranco")}</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void aplicar()}
            disabled={busy}
            className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {fase === "pronto" ? t("aplicarDeNovo", { custo: STUDIO_MONTAGE_COST }) : t("aplicar", { custo: STUDIO_MONTAGE_COST })}
          </button>
          <p className="text-[12px] text-[var(--ash)]">{t("nota")}</p>
          {erro && <p className="text-[13px] text-red-400">{erro}</p>}
        </>
      )}
    </div>
  );
}
