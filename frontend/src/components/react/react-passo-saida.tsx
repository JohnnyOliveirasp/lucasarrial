"use client";

/**
 * R6 — a conta e o botão de gerar.
 *
 * A regra do Johnny sobre preço aparece AQUI, antes de gastar: a conta vem
 * separada (React fixo · clone por segundo) pra pessoa entender que o caro é
 * o vídeo, não o nosso trabalho.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Loader2, Trash2 } from "lucide-react";
import { downloadFromUrl } from "@/components/image/download-file";
import { getSubtitlePreset } from "@/lib/video/subtitle-presets";
import type { ReactDraft } from "./react-tipos";

/** Taxa fixa do React: LLM + preparo da foto + montagem + legenda. */
const CUSTO_REACT = 300;
/** Clone de vídeo — o que realmente pesa. */
const CREDITOS_POR_SEGUNDO = 105;

/** As etapas do job (migração 76), na ordem em que acontecem. */
const ETAPAS = [
  { id: "baixando", rotulo: "Baixando o viral" },
  { id: "clonando", rotulo: "Gravando você (clone)" },
  { id: "montando", rotulo: "Montando o vídeo" },
  { id: "pronto", rotulo: "Pronto" },
] as const;

type JobReact = {
  status: string;
  erro?: string | null;
  video_url?: string | null;
  thumb_url?: string | null;
};

export function ReactPassoSaida({
  draft,
  update,
}: {
  draft: ReactDraft;
  update: (m: Partial<ReactDraft>) => void;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [job, setJob] = useState<JobReact | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  /**
   * Acompanha o pedido até acabar. ⚠️ É o GET que faz o job ANDAR (mesmo
   * padrão do Vídeo Clone) — sem esta tela perguntando, ele fica parado em
   * "clonando" pra sempre. Foi o que aconteceu no 1º React do Johnny, 14/08.
   */
  const acompanhar = useCallback(async (jobId: string): Promise<JobReact | null> => {
    let ultimo: JobReact | null = null;
    for (let i = 0; i < 400; i++) {
      const j = (await fetch(`/api/v1/react/gerar?job=${encodeURIComponent(jobId)}`, {
        cache: "no-store",
      })
        .then((r) => r.json())
        .catch(() => null)) as JobReact | null;
      if (j?.status) {
        setJob(j);
        ultimo = j;
      }
      if (j?.status === "pronto" || j?.status === "erro") return ultimo;
      if (!vivo.current) return ultimo;
      await new Promise((s) => setTimeout(s, 5000));
    }
    return ultimo;
  }, []);

  /**
   * Ao abrir: retoma o pedido do rascunho ou, se não houver, pergunta ao
   * servidor se existe um em voo (pedido feito antes de o rascunho guardar o
   * jobId, ou aberto de outro navegador).
   */
  useEffect(() => {
    void (async () => {
      if (draft.jobId) {
        const fim = await acompanhar(draft.jobId);
        // O rascunho pode apontar pra um job MORTO enquanto existe um melhor
        // do mesmo viral (caso 17/08: a duplicata cancelada escondia o vídeo
        // PRONTO do job anterior). Deu erro? Pergunta pelo melhor e adota.
        if (fim?.status === "erro" && draft.viral?.id && vivo.current) {
          const melhor = (await fetch(
            `/api/v1/react/gerar?viral=${encodeURIComponent(draft.viral.id)}`,
            { cache: "no-store" },
          )
            .then((r) => r.json())
            .catch(() => null)) as (JobReact & { id?: string }) | null;
          if (melhor?.id && melhor.id !== draft.jobId && melhor.status !== "erro") {
            update({ jobId: melhor.id });
            setJob(melhor);
            if (melhor.status !== "pronto") await acompanhar(melhor.id);
          }
        }
        return;
      }
      const j = (await fetch("/api/v1/react/gerar", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null)) as (JobReact & { id?: string; job?: null }) | null;
      const emVoo = j?.status === "baixando" || j?.status === "clonando" || j?.status === "montando";
      if (!j?.id || !emVoo || !vivo.current) return;
      update({ jobId: j.id });
      setJob(j);
      await acompanhar(j.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const texto = [draft.roteiro, draft.cta].filter(Boolean).join(" ");
  const palavras = texto.trim().split(/\s+/).filter(Boolean).length;
  const segundosFala = Math.max(1, Math.round(palavras / 2.5));
  const custoClone = draft.modoAudio === "gravar" ? 0 : segundosFala * CREDITOS_POR_SEGUNDO;
  const total = CUSTO_REACT + custoClone;

  const faltando: string[] = [];
  if (!draft.viral) faltando.push("o vídeo");
  if (!draft.fotoPronta) faltando.push("a foto pronta");
  if (draft.roteiro.trim().length < 20) faltando.push("o roteiro");
  if (!draft.layout) faltando.push("o layout");
  if (draft.modoAudio === "clone" && !draft.audioUrl) faltando.push("o áudio");

  /** Apaga o React de vez: mp4 final, clone, foto e fala saem do R2 junto. */
  async function apagar() {
    const jobId = draft.jobId;
    if (!window.confirm("Apagar este vídeo? Ele sai do seu acervo e não volta.")) return;
    setApagando(true);
    setErro(null);
    try {
      if (jobId) {
        const r = await fetch(`/api/v1/react/gerar?job=${encodeURIComponent(jobId)}`, {
          method: "DELETE",
        });
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          setErro(j?.error?.message ?? "Não consegui apagar o vídeo.");
          return;
        }
      }
      update({ jobId: null });
      setJob(null);
    } catch {
      setErro("Falha de rede ao apagar.");
    } finally {
      setApagando(false);
    }
  }

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const r = await fetch("/api/v1/react/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viral_id: draft.viral?.id,
          foto_url: draft.fotoPronta,
          audio_url: draft.audioUrl,
          layout: draft.layout,
          roteiro: draft.roteiro,
          cta: draft.cta,
          fundo_url: draft.fundoFinal,
          legenda_estilo: draft.legendaEstilo,
          legenda_posicao: draft.legendaPosicao,
          legenda_tamanho: draft.legendaTamanho,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j?.error?.message ?? "Não consegui gerar agora.");
        return;
      }
      const jobId = j.job_id as string;
      update({ jobId });
      setJob({ status: j.status ?? "clonando" });
      await acompanhar(jobId);
    } catch {
      setErro("Falha de rede.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Revisar e gerar</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--mute)]">
          Confira antes — depois de gerar, o crédito já foi.
        </p>
      </div>

      <dl className="grid gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline)] p-3 text-[12.5px]">
        {[
          ["Vídeo", draft.viral ? `@${draft.viral.autor ?? "?"} · ${Math.round(draft.viral.duracao_seg ?? 0)}s` : "—"],
          ["Quem reage", draft.avatar?.label ?? "—"],
          ["Foto", draft.fotoPronta ? "pronta (meio corpo, fundo preparado)" : "—"],
          ["Fala", `${palavras} palavras · ~${segundosFala}s`],
          ["Chamada final", draft.cta ? "sim" : "não"],
          ["Layout", draft.layout ?? "—"],
          [
            "Divisão",
            draft.viral?.duracao_seg && segundosFala > Math.round(draft.viral.duracao_seg)
              ? `${Math.round(draft.viral.duracao_seg)}s com o viral + ${segundosFala - Math.round(draft.viral.duracao_seg)}s só você`
              : "o viral cobre a fala inteira",
          ],
          ["Voz", draft.modoAudio === "gravar" ? "você grava" : draft.audioUrl ? "gerada" : "—"],
          ["Legenda", getSubtitlePreset(draft.legendaEstilo).label],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-28 shrink-0 text-[var(--mute)]">{k}</dt>
            <dd className="text-[var(--ink)]">{v}</dd>
          </div>
        ))}
      </dl>

      {/* A conta separada — o caro é o vídeo, não o nosso trabalho. */}
      <div className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3 text-[12.5px]">
        <div className="flex justify-between">
          <span className="text-[var(--mute)]">React (roteiro, foto, montagem, legenda)</span>
          <span className="text-[var(--ink)]">{CUSTO_REACT} cr</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--mute)]">
            Seu vídeo — {segundosFala}s × {CREDITOS_POR_SEGUNDO} cr
          </span>
          <span className="text-[var(--ink)]">{custoClone.toLocaleString("pt-BR")} cr</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-[var(--hairline)] pt-1 font-semibold">
          <span className="text-[var(--ink)]">Total</span>
          <span className="text-[var(--ink)]">{total.toLocaleString("pt-BR")} cr</span>
        </div>
      </div>

      {faltando.length > 0 && (
        <p className="text-[12.5px] text-[var(--mute)]">
          Falta definir: <strong className="text-[var(--ink)]">{faltando.join(", ")}</strong>.
        </p>
      )}

      {!job && (
        <button
          type="button"
          onClick={gerar}
          disabled={gerando || faltando.length > 0}
          className="h-11 rounded-[var(--radius-sm)] bg-[var(--ink)] text-[14px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
        >
          {gerando ? "Enviando o pedido…" : "Gerar o Video React"}
        </button>
      )}

      {job && (
        <Acompanhamento
          job={job}
          thumbFallback={draft.viral?.thumb_url ?? null}
          baixando={baixando}
          onBaixar={(url) => {
            setBaixando(true);
            void downloadFromUrl(url, "video-react", "mp4").finally(() => setBaixando(false));
          }}
          onDeNovo={() => {
            update({ jobId: null });
            setJob(null);
          }}
          onApagar={apagar}
          apagando={apagando}
        />
      )}

      {erro && <p className="text-[12.5px] text-red-400">{erro}</p>}
    </div>
  );
}

/**
 * O vídeo nascendo NA TELA — pedido do Johnny 14/08: "tem que aparecer logo
 * abaixo, na sequência", como no editor. Antes só dizia "pedido enviado" e
 * mandava procurar em Vídeos gerados.
 */
function Acompanhamento({
  job,
  thumbFallback,
  baixando,
  onBaixar,
  onDeNovo,
  onApagar,
  apagando,
}: {
  job: JobReact;
  thumbFallback: string | null;
  baixando: boolean;
  onBaixar: (url: string) => void;
  onDeNovo: () => void;
  onApagar: () => void;
  apagando: boolean;
}) {
  const atual = ETAPAS.findIndex((e) => e.id === job.status);
  const capa = job.thumb_url ?? thumbFallback;
  const falhou = job.status === "erro";
  const pronto = job.status === "pronto" && job.video_url;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3">
      <div className="flex gap-3">
        {/* Miniatura: a capa do viral enquanto monta, o vídeo quando fica pronto. */}
        <div className="h-[120px] w-[68px] shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-black/40">
          {pronto ? (
            <video
              src={job.video_url!}
              poster={capa ?? undefined}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capa} alt="" className="h-full w-full object-cover opacity-70" />
          ) : null}
        </div>

        <ol className="flex flex-1 flex-col gap-1.5">
          {ETAPAS.map((e, i) => {
            // ⚠️ "pronto" é a última etapa: sem o `&& !pronto` ela caía no ramo
            // "acontecendo agora" e o spinner girava pra sempre com o vídeo já
            // na tela (o círculo de "aguarde" que o Johnny viu, 15/08).
            const feito = !falhou && (atual > i || Boolean(pronto));
            const agora = !falhou && atual === i && !pronto;
            return (
              <li key={e.id} className="flex items-center gap-2 text-[12.5px]">
                {feito ? (
                  <Check className="size-3.5 shrink-0 text-emerald-400" />
                ) : agora ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--ink)]" />
                ) : (
                  <span className="size-3.5 shrink-0 rounded-full border border-[var(--hairline-strong)]" />
                )}
                <span className={feito || agora ? "text-[var(--ink)]" : "text-[var(--ash)]"}>
                  {e.rotulo}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {!falhou && !pronto && (
        <p className="text-[11.5px] text-[var(--mute)]">
          Pode deixar esta tela aberta — o clone leva alguns minutos.
        </p>
      )}

      {pronto && (
        <div className="flex flex-col gap-2">
          <video
            src={job.video_url!}
            controls
            playsInline
            preload="metadata"
            className="max-h-[420px] w-auto self-start rounded-[var(--radius-sm)] border border-[var(--hairline)]"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onBaixar(job.video_url!)}
              disabled={baixando}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
            >
              {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Baixar
            </button>
            <button
              type="button"
              onClick={onDeNovo}
              className="text-[12.5px] text-[var(--mute)] underline"
            >
              gerar outro
            </button>
            <button
              type="button"
              onClick={onApagar}
              disabled={apagando}
              title="Apagar este vídeo"
              aria-label="Apagar este vídeo"
              className="ml-auto grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] text-[var(--mute)] transition-colors hover:border-red-400/60 hover:text-red-400 disabled:opacity-40"
            >
              {apagando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {falhou && (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-red-400">{job.erro ?? "A geração falhou."}</p>
          <button
            type="button"
            onClick={onDeNovo}
            className="self-start rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 py-1.5 text-[12.5px] text-[var(--ink)]"
          >
            Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}
