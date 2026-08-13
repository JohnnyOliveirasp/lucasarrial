"use client";

/**
 * E3 · caminho CENAS (W4): motor do Estúdio do Lucas por trás, wizard na
 * frente. O áudio da E2 vira um projeto do Estúdio via import-audio →
 * POST /studio (limpeza+transcrição) → gerar cenas (planner 1 cena/frase,
 * banco pessoal + acervo com reuso grátis) → montagem (J-cut, sem legenda —
 * legendas são da estação Edição). ⚠️ O poll daqui é o MOTOR: o GET
 * /studio/[id] é quem sincroniza Kie/RunPod — a estação mantém o poll vivo
 * e retoma projeto em andamento pelo draft.cenasProjectId.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Clapperboard, Download, Film, Loader2, RefreshCw, X } from "lucide-react";
import { downloadFromUrl } from "@/components/image/download-file";
import { STUDIO_CLEAN_COST } from "@/lib/credits/config";
import { STUDIO_SCENE_COST, STUDIO_MONTAGE_COST } from "@/lib/studio/pricing";
import { CenaPainel } from "./cena-painel";
import { ConfirmCenas } from "./confirm-cenas";
import type { AudioSel, EdicaoDraft, VideoSel } from "./edicao-wizard";

type Cena = {
  id: string;
  concept: string;
  status: string;
  reused: boolean;
  video_url?: string | null;
  /** C2: prompt visível/editável + frases cobertas (painel da miniatura). */
  prompt_en?: string;
  frases?: string[];
  /** C4: cena gerada com as fotos da pessoa. */
  com_pessoa?: boolean;
};
type Projeto = {
  id: string;
  status: string;
  error_message: string | null;
  scenes_status: "idle" | "generating" | "ready" | "failed";
  scenes: Cena[];
  montage_status: string;
  montage_error?: string | null;
  video_url: string | null;
  /** C1: nº de frases da fala (1 cena por frase é a sugestão do motor). */
  sentence_count?: number | null;
};

type Props = {
  draft: EdicaoDraft;
  onChange: (patch: Partial<EdicaoDraft>) => void;
  escolher: (v: VideoSel | null) => void;
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

export function PassoCenas({ draft, onChange, escolher }: Props) {
  const t = useTranslations("edicao.video.cenas");
  const projectId = draft.cenasProjectId;
  const [proj, setProj] = useState<Projeto | null>(null);
  const [busy, setBusy] = useState<"iniciar" | "cenas" | "montar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // C2: miniatura clicada → painel da cena (prompt/regerar/foto).
  const [cenaAberta, setCenaAberta] = useState<string | null>(null);
  const escolhidoRef = useRef(false);

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

  // Poll de 5s enquanto houver trabalho em voo. ⚠️ É o motor do Estúdio:
  // sem este GET nada avança no servidor.
  const ativo =
    !!proj &&
    (proj.status === "processing" || proj.scenes_status === "generating" || proj.montage_status === "processing");
  useEffect(() => {
    if (!projectId) return;
    void carregar(projectId);
  }, [projectId, carregar]);
  useEffect(() => {
    if (!projectId || !ativo) return;
    const timer = setInterval(() => void carregar(projectId), 5000);
    return () => clearInterval(timer);
  }, [projectId, ativo, carregar]);

  // Vídeo montado → vira a escolha da estação (1x).
  useEffect(() => {
    if (!proj || proj.montage_status !== "ready" || escolhidoRef.current) return;
    if (draft.video?.kind === "cenas" && draft.video.id === proj.id) return;
    escolhidoRef.current = true;
    escolher({ kind: "cenas", id: proj.id, label: t("labelVideo", { n: proj.scenes.length }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proj?.montage_status]);

  async function iniciar() {
    if (!draft.audio) return;
    setBusy("iniciar");
    setErro(null);
    try {
      const audioKey = await importarAudio(draft.audio);
      const res = await fetch("/api/v1/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_key: audioKey, name: "Vídeo Edição 2.0" }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(t("semCreditos"));
      if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? t("erroIniciar"));
      const id = (j?.data?.project?.id ?? j?.project?.id) as string;
      onChange({ cenasProjectId: id });
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erroIniciar"));
    } finally {
      setBusy(null);
    }
  }

  async function gerarCenas(sceneCount?: number, photoKeys: string[] = [], bankIds: string[] = []) {
    if (!projectId) return;
    setBusy("cenas");
    setErro(null);
    try {
      const res = await fetch(`/api/v1/studio/${projectId}/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // C1: quantidade confirmada; C4: fotos da pessoa; explorador: cenas
        // do banco escolhidas à mão (reuso grátis).
        body: JSON.stringify({
          ...(sceneCount ? { scene_count: sceneCount } : {}),
          ...(photoKeys.length > 0 ? { photo_keys: photoKeys } : {}),
          ...(bankIds.length > 0 ? { bank_scene_ids: bankIds } : {}),
        }),
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

  async function montar() {
    if (!projectId) return;
    setBusy("montar");
    setErro(null);
    try {
      // Sem legenda de propósito: legendas são opção da estação Edição (E4).
      const res = await fetch(`/api/v1/studio/${projectId}/montage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captions: false, edit_style: "dynamic" }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) throw new Error(t("semCreditos"));
      if (!res.ok) throw new Error(j?.error?.message ?? j?.message ?? t("erroMontar"));
      escolhidoRef.current = false;
      await carregar(projectId);
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erroMontar"));
    } finally {
      setBusy(null);
    }
  }

  // ── Sem projeto ainda: cartão de partida ──
  if (!projectId) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
        <p className="text-[13.5px] text-[var(--ink)]">{t("intro")}</p>
        <p className="text-[12px] text-[var(--ash)]">
          {t("custos", { limpeza: STUDIO_CLEAN_COST, cena: STUDIO_SCENE_COST, montagem: STUDIO_MONTAGE_COST })}
        </p>
        <button
          type="button"
          onClick={() => void iniciar()}
          disabled={busy !== null || !draft.audio}
          className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
        >
          {busy === "iniciar" ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
          {t("iniciar", { custo: STUDIO_CLEAN_COST })}
        </button>
        {erro && <p className="text-[13px] text-red-400">{erro}</p>}
      </div>
    );
  }

  if (!proj) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-[var(--mute)]">
        <Loader2 className="size-4 animate-spin" /> {t("carregando")}
      </p>
    );
  }

  // ── Projeto falhou de vez: recomeçar ──
  if (proj.status === "failed") {
    return (
      <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
        <p className="text-[13px] text-red-400">{proj.error_message || t("erroIniciar")}</p>
        <BotaoReiniciar onClick={() => onChange({ cenasProjectId: null })} rotulo={t("recomecar")} />
      </div>
    );
  }

  const prontas = proj.scenes.filter((c) => c.status === "ready").length;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
      {/* F0: áudio em preparo */}
      {proj.status === "processing" && (
        <p className="flex items-center gap-2 text-[13.5px] text-[var(--ink)]">
          <Loader2 className="size-4 animate-spin" /> {t("preparandoAudio")}
        </p>
      )}

      {/* F3: cenas — C1: confirmação ANTES de gerar/cobrar (pedido Johnny
          13/08: 23 cenas num áudio de 59s assustou; agora a pessoa vê o
          número, aceita ou ajusta — frases vizinhas dividem a mesma cena). */}
      {proj.status === "audio_ready" && proj.scenes_status === "idle" && (
        <ConfirmCenas
          frases={proj.sentence_count ?? 0}
          gerando={busy !== null}
          onGerar={(n, fotos, banco) => void gerarCenas(n, fotos, banco)}
        />
      )}

      {/* C2 (13/08): MINIATURAS em grade (não vídeos empilhados) — clicou,
          abre o painel da cena com player + prompt + regerar/melhorar/foto. */}
      {proj.scenes.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-[var(--mute)]">
            {proj.scenes_status === "generating"
              ? t("gerandoCenas", { prontas, total: proj.scenes.length })
              : t("cenasProntas", { total: proj.scenes.length })}
          </p>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {proj.scenes.map((c) => {
              const aberta = cenaAberta === c.id;
              return (
                <li key={c.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setCenaAberta(aberta ? null : c.id)}
                    aria-pressed={aberta}
                    title={c.concept}
                    className={`relative block w-full overflow-hidden rounded-[var(--radius-sm)] border transition-colors ${
                      aberta
                        ? "border-[var(--hairline-bright)] shadow-[0_0_0_1px_var(--hairline-bright)]"
                        : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
                    }`}
                  >
                    {c.video_url ? (
                      <video src={c.video_url} muted playsInline preload="metadata" className="aspect-[9/16] w-full object-cover" />
                    ) : (
                      <span className="grid aspect-[9/16] w-full place-items-center">
                        {c.status === "failed" ? (
                          <X className="size-4 text-red-400" />
                        ) : (
                          <Loader2 className="size-4 animate-spin text-[var(--ash)]" />
                        )}
                      </span>
                    )}
                    {c.status === "ready" && (
                      <Check className="absolute right-1 top-1 size-3.5 rounded-full bg-[var(--surface-deep)]/80 p-0.5 text-emerald-400" />
                    )}
                  </button>
                  <span className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate text-[10.5px] text-[var(--mute)]">{c.concept}</span>
                    {c.reused && <span className="shrink-0 text-[9px] text-[var(--ash)]">{t("banco")}</span>}
                    {c.video_url && (
                      <button
                        type="button"
                        onClick={() => downloadFromUrl(c.video_url!, c.concept || "cena", "mp4")}
                        title={t("baixarCena")}
                        className="shrink-0 text-[var(--ash)] hover:text-[var(--ink)]"
                      >
                        <Download className="size-3" />
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {cenaAberta &&
            (() => {
              const c = proj.scenes.find((x) => x.id === cenaAberta);
              if (!c || !projectId) return null;
              return (
                <CenaPainel
                  key={c.id}
                  projectId={projectId}
                  cena={c}
                  bloqueado={proj.scenes_status === "generating"}
                  onMudou={() => {
                    setCenaAberta(null);
                    escolhidoRef.current = false;
                    void carregar(projectId);
                  }}
                />
              );
            })()}
        </div>
      )}

      {proj.scenes_status === "failed" && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-amber-300">{t("cenasFalharam")}</p>
          <BotaoReiniciar onClick={() => void gerarCenas()} rotulo={t("tentarCenasDeNovo")} girando={busy === "cenas"} />
        </div>
      )}

      {/* F1: montagem */}
      {proj.scenes_status === "ready" && proj.montage_status !== "processing" && proj.montage_status !== "ready" && (
        <button
          type="button"
          onClick={() => void montar()}
          disabled={busy !== null}
          className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
        >
          {busy === "montar" ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
          {t("montar", { custo: STUDIO_MONTAGE_COST })}
        </button>
      )}
      {proj.montage_status === "processing" && (
        <p className="flex items-center gap-2 text-[13.5px] text-[var(--ink)]">
          <Loader2 className="size-4 animate-spin" /> {t("montando")}
        </p>
      )}
      {proj.montage_status === "failed" && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-red-400">{proj.montage_error || t("erroMontar")}</p>
          <BotaoReiniciar onClick={() => void montar()} rotulo={t("tentarMontarDeNovo")} girando={busy === "montar"} />
        </div>
      )}
      {proj.montage_status === "ready" && (
        <>
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-emerald-300">
            <Film className="size-4" /> {t("pronto")}
          </p>
          {proj.video_url && <video src={proj.video_url} controls className="max-h-96 w-full rounded-[var(--radius-sm)]" />}
        </>
      )}

      {erro && <p className="text-[13px] text-red-400">{erro}</p>}
    </div>
  );
}

function BotaoReiniciar({ onClick, rotulo, girando }: { onClick: () => void; rotulo: string; girando?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={girando}
      className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3.5 py-2 text-[13px] text-[var(--ink)] disabled:opacity-40"
    >
      {girando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} {rotulo}
    </button>
  );
}
