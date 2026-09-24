"use client";

/**
 * E4 · b-roll POR CIMA do vídeo clone (W5 fase 4 — "planner sugere, pessoa
 * ajusta", decisão do Johnny 12/08). Esteira: áudio da E2 vira projeto do
 * Estúdio (import-audio, MESMO fluxo do caminho Cenas) → planner sugere 1
 * cena por frase (plan_only, sem custo) → pessoa desmarca frases → gera SÓ
 * as escolhidas (1.800 cr/nova, reuso grátis) → job broll_overlay aplica as
 * cenas nas janelas das frases (áudio/duração do clone intocados).
 * Resultado → draft.videoEditadoKey (a legenda encadeia por cima dele).
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Clapperboard, Film, Loader2, RotateCcw, X } from "lucide-react";
import { STUDIO_SCENE_COST } from "@/lib/studio/pricing";
import { STUDIO_CLEAN_COST } from "@/lib/credits/config";
import { EDICAO_BROLL_COST } from "@/lib/edicao/pricing";
import { CODIGO_SUBSTITUICAO, podeVoltarAoOriginal, voltarAoOriginal } from "@/lib/edicao/reaplicar";
import type { AudioSel, EdicaoDraft } from "./edicao-wizard";

type Sugestao = { sentence: number; text: string; reused: boolean };
type Cena = { id: string; concept: string; status: string; reused: boolean };
type Projeto = {
  id: string;
  status: string;
  error_message: string | null;
  scenes_status: "idle" | "generating" | "ready" | "failed";
  scenes: Cena[];
};

type Props = {
  draft: EdicaoDraft;
  onChange: (patch: Partial<EdicaoDraft>) => void;
};

async function importarAudio(audio: AudioSel): Promise<string> {
  const body = audio.kind === "generation" ? { generation_id: audio.id } : { take_key: audio.key };
  const res = await fetch("/api/v1/studio/import-audio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? "");
  return (j?.data?.audio_key ?? j?.audio_key) as string;
}

export function EditarCloneBroll({ draft, onChange }: Props) {
  const t = useTranslations("edicao.editar.broll");
  const projectId = draft.brollProjectId;
  const [proj, setProj] = useState<Projeto | null>(null);
  const [plano, setPlano] = useState<Sugestao[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  /** Texto da recusa 409 do servidor — abre o diálogo de substituir. */
  const [confirmarSubst, setConfirmarSubst] = useState<string | null>(null);
  const job = draft.brollJob;

  const carregar = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/v1/studio/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      const p = (j?.data?.project ?? j?.project) as Projeto | undefined;
      if (p) setProj(p);
    } catch {
      /* próximo tick */
    }
  }, []);

  // Poll do projeto (o GET é o motor do Estúdio).
  const ativo = !!proj && (proj.status === "processing" || proj.scenes_status === "generating");
  useEffect(() => {
    if (!projectId) return;
    void carregar(projectId);
  }, [projectId, carregar]);
  useEffect(() => {
    if (!projectId || !ativo) return;
    const timer = setInterval(() => void carregar(projectId), 5000);
    return () => clearInterval(timer);
  }, [projectId, ativo, carregar]);

  // Sugestão do planner assim que o áudio fica pronto (sem custo).
  useEffect(() => {
    if (!projectId || !proj || proj.status !== "audio_ready" || proj.scenes_status !== "idle" || plano) return;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/studio/${projectId}/scenes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_only: true }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error?.message ?? "");
        const p = ((j?.data?.plan ?? j?.plan ?? []) as Sugestao[]);
        setPlano(p);
        setMarcadas(new Set(p.map((s) => s.sentence)));
      } catch {
        setErro(t("erroPlanejar"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, proj?.status, proj?.scenes_status]);

  // Poll do job de overlay.
  useEffect(() => {
    if (!job) return;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/v1/edicao/broll?job=${encodeURIComponent(job.job)}&key=${encodeURIComponent(job.key)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        // jsonOk devolve o objeto direto — fallback igual aos outros passos.
        const j = await res.json();
        const d = j?.data ?? j ?? {};
        if (d.status === "ready") {
          setVideoUrl(d.video_url ?? null);
          onChange({ videoEditadoKey: job.key, brollJob: null });
        } else if (d.status === "failed") {
          setErro(d.error ?? t("erroAplicar"));
          onChange({ brollJob: null });
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

  async function iniciar() {
    if (!draft.audio) return;
    setBusy("iniciar");
    setErro(null);
    try {
      const audioKey = await importarAudio(draft.audio);
      const res = await fetch("/api/v1/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_key: audioKey, name: "Vídeo Edição 2.0 — b-roll" }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(t("semCreditos"));
      if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? t("erroIniciar"));
      onChange({ brollProjectId: (j?.data?.project?.id ?? j?.project?.id) as string });
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erroIniciar"));
    } finally {
      setBusy(null);
    }
  }

  async function gerarCenas() {
    if (!projectId) return;
    setBusy("cenas");
    setErro(null);
    try {
      const res = await fetch(`/api/v1/studio/${projectId}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentences: [...marcadas] }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(t("semCreditos"));
      if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? t("erroCenas"));
      await carregar(projectId);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erroCenas"));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Aplica o b-roll. `confirmado` só vai true quando a pessoa passou pelo
   * diálogo de substituição — a chave de saída é determinística e o arquivo
   * anterior se perde (caso Leonice 19/09: 4 débitos, 1 arquivo).
   */
  async function aplicar(confirmado = false) {
    if (!projectId || !draft.video || draft.video.kind === "cenas") return;
    setBusy("aplicar");
    setErro(null);
    try {
      const res = await fetch("/api/v1/edicao/broll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          video: { kind: draft.video.kind, id: draft.video.id },
          ...(confirmado ? { confirmar_substituicao: true } : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(t("semCreditos"));
      // 409: já existe saída e ninguém confirmou. NÃO é erro — é a pergunta.
      // Nada foi cobrado aqui; o texto vem do servidor (fonte única do aviso).
      if (res.status === 409 && j?.error?.code === CODIGO_SUBSTITUICAO) {
        setConfirmarSubst(j.error.message ?? t("substituir.texto", { custo: EDICAO_BROLL_COST }));
        return;
      }
      if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? t("erroAplicar"));
      const d = j?.data ?? j;
      setConfirmarSubst(null);
      onChange({ brollJob: { job: d.job_id, key: d.output_key } });
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erroAplicar"));
    } finally {
      setBusy(null);
    }
  }

  /**
   * "Voltar ao original" (defeito 1, 19/09): a tela só PARA de apontar pra
   * saída de edição. Não apaga nada no R2, não chama job, não cobra crédito —
   * o vídeo do clone (`video_clones.video_path`) nunca foi destruído.
   */
  function voltar() {
    setVideoUrl(null);
    setErro(null);
    onChange(voltarAoOriginal());
  }

  const mostrarVoltar = podeVoltarAoOriginal({
    videoEditadoKey: draft.videoEditadoKey,
    jobEmVoo: job !== null || draft.captionJob !== null,
  });

  const novasMarcadas = plano ? plano.filter((s) => marcadas.has(s.sentence) && !s.reused).length : 0;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--ink)]">
        <Clapperboard className="size-4" /> {t("titulo")}
      </p>

      {/* Alavanca que faltava (19/09): quem aplicou e se arrependeu só tinha
          "aplicar de novo" — e aplicar de novo sobrescreve o que já foi pago.
          Fica FORA do condicional grande porque vale sempre que existe uma
          edição em uso, inclusive quando o b-roll nem foi iniciado. */}
      {mostrarVoltar && (
        <div className="flex flex-col gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 py-2.5">
          <button
            type="button"
            onClick={voltar}
            className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3.5 py-2 text-[13px] text-[var(--ink)] hover:border-[var(--hairline-bright)]"
          >
            <RotateCcw className="size-3.5" /> {t("voltarOriginal")}
          </button>
          <p className="text-[11.5px] leading-snug text-[var(--ash)]">{t("voltarOriginalNota")}</p>
        </div>
      )}

      {job ? (
        <p className="flex items-center gap-2 text-[13.5px] text-[var(--ink)]">
          <Loader2 className="size-4 animate-spin" /> {t("aplicando")}
        </p>
      ) : !projectId ? (
        <>
          <p className="text-[13px] text-[var(--mute)]">{t("intro")}</p>
          <button
            type="button"
            onClick={() => void iniciar()}
            disabled={busy !== null}
            className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            {busy === "iniciar" ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
            {t("iniciar", { custo: STUDIO_CLEAN_COST })}
          </button>
        </>
      ) : !proj || proj.status === "processing" ? (
        <p className="flex items-center gap-2 text-[13px] text-[var(--mute)]">
          <Loader2 className="size-4 animate-spin" /> {t("preparando")}
        </p>
      ) : proj.status === "failed" ? (
        <p className="text-[13px] text-red-400">{proj.error_message || t("erroIniciar")}</p>
      ) : proj.scenes_status === "idle" && plano ? (
        <>
          <p className="text-[13px] text-[var(--mute)]">{t("sugestao")}</p>
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
            {plano.map((s) => (
              <li key={s.sentence}>
                <label className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2">
                  <input
                    type="checkbox"
                    checked={marcadas.has(s.sentence)}
                    onChange={(e) => {
                      const novo = new Set(marcadas);
                      if (e.target.checked) novo.add(s.sentence);
                      else novo.delete(s.sentence);
                      setMarcadas(novo);
                    }}
                    className="mt-0.5 accent-[var(--ink)]"
                  />
                  <span className="text-[12.5px] leading-snug text-[var(--ink)]">
                    “{s.text}”{" "}
                    {s.reused && <span className="text-[10.5px] text-emerald-400">{t("gratis")}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void gerarCenas()}
            disabled={busy !== null || marcadas.size === 0}
            className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            {busy === "cenas" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {t("gerarCenas", { n: marcadas.size, custo: novasMarcadas * STUDIO_SCENE_COST })}
          </button>
        </>
      ) : proj.scenes_status === "idle" ? (
        <p className="flex items-center gap-2 text-[13px] text-[var(--mute)]">
          <Loader2 className="size-4 animate-spin" /> {t("planejando")}
        </p>
      ) : proj.scenes_status === "generating" ? (
        <p className="flex items-center gap-2 text-[13px] text-[var(--ink)]">
          <Loader2 className="size-4 animate-spin" />
          {t("gerandoCenas", {
            prontas: proj.scenes.filter((c) => c.status === "ready").length,
            total: proj.scenes.length,
          })}
        </p>
      ) : proj.scenes_status === "failed" ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[13px] text-amber-300">
            <X className="size-3.5" /> {t("cenasFalharam")}
          </p>
          <button
            type="button"
            onClick={() => void gerarCenas()}
            disabled={busy !== null}
            className="w-fit rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3.5 py-2 text-[13px] text-[var(--ink)] disabled:opacity-40"
          >
            {t("tentarDeNovo")}
          </button>
        </div>
      ) : (
        <>
          {videoUrl && <video src={videoUrl} controls className="max-h-96 w-full rounded-[var(--radius-sm)]" />}
          <button
            type="button"
            onClick={() => void aplicar()}
            disabled={busy !== null}
            className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            {busy === "aplicar" ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
            {t("aplicar", { custo: EDICAO_BROLL_COST })}
          </button>
        </>
      )}

      {erro && <p className="text-[13px] text-red-400">{erro}</p>}

      {/* Diálogo de SUBSTITUIÇÃO (19/09). O texto vem do servidor — é o mesmo
          que recusou a chamada — pra não existir duas versões do aviso. Nada
          foi cobrado até aqui: o 409 acontece antes do gate de crédito. */}
      {confirmarSubst && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmarSubst(null)}
        >
          <div
            className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              <h3 className="text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
                {t("substituir.titulo")}
              </h3>
            </div>
            <p className="text-sm text-[var(--body)]">{confirmarSubst}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmarSubst(null)}
                className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
              >
                {t("substituir.cancelar")}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setConfirmarSubst(null);
                  void aplicar(true);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] bg-[var(--ink)] px-[18px] text-[14px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
              >
                {t("substituir.confirmar", { custo: EDICAO_BROLL_COST })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
