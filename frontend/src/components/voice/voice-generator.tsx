"use client";

/**
 * Gerar Áudio — padrão "estúdio" (estilo ElevenLabs): o formulário fica SEMPRE
 * visível e cada geração vira um "take" numa lista logo abaixo, na MESMA tela
 * (player + duração + baixar). O texto não some — regenerar é clicar de novo.
 * O Histórico continua existindo como acervo; aqui é a sessão de trabalho.
 *
 * Os últimos takes da voz são HIDRATADOS ao abrir (pedido Johnny 07/08): o
 * último áudio fica sempre na tela — refresh não apaga a lista nem perde o
 * spinner de uma geração em andamento. Barra fixa no rodapé com o take mais
 * recente pronto (sem autoplay: a pessoa dá o play).
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AudioLines, Download, Loader2, AlertTriangle , Trash2 } from "lucide-react";
import { formatDuration } from "@/lib/audio/duration";
import { clientLogger } from "@/lib/logger/client";
import { SupportError } from "@/components/ui/support-error";
import { PaywallModal } from "@/components/app/paywall-modal";

// Limite generoso pra cobrir ~2 min de fala em pt-BR (~150 wpm, ~5 chars/word).
// Bate com o TEXT_MAX da rota /api/v1/voices/[id]/generate.
const TEXT_MAX = 2000;

type Props = { voiceId: string };

const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none";

type Take = {
  id: string;
  status: "pending" | "generating" | "ready" | "failed";
  text: string;
  audio_url: string | null;
  error_message: string | null;
  duration_seconds: number | null;
  elapsed_seconds: number | null;
  startedAt: number;
};

const ANIM_CSS = `
@keyframes vg-shimmer { 0% { transform: translateX(-120%) skewX(-12deg); } 100% { transform: translateX(220%) skewX(-12deg); } }
.vg-shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent); animation: vg-shimmer 1.8s ease-in-out infinite; }
@keyframes vg-dots { 0%,20%{content:'';} 40%{content:'.';} 60%{content:'..';} 80%,100%{content:'...';} }
.vg-dots::after { content:''; animation: vg-dots 1.6s steps(1) infinite; }
`;

/** Quantos takes recentes desta voz pré-carregar ao abrir a tela. */
const HYDRATE_LIMIT = 5;

export function VoiceGenerator({ voiceId }: Props) {
  const t = useTranslations("voice");
  const router = useRouter();
  const [text, setText] = useState("");
  // Pausa entre frases (vai como chunk_silence_ms; backend já aceita).
  const [pauseMs, setPauseMs] = useState<number | null>(null);
  /** Ritmo (opcao B, Johnny 25/08): regua da pessoa x 0,85 / 1 / 1,15. */
  const [speed, setSpeed] = useState<"calm" | "normal" | "fast">("normal");
  /**
   * "Ajustar ao meu ritmo" — DESLIGADO por padrão (Johnny 29/08: a voz sai
   * como o modelo gerou; quem decide é o aluno). Ligado, o worker aproxima a
   * saída da velocidade natural medida da pessoa.
   */
  const [ajustarRitmo, setAjustarRitmo] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noCredits, setNoCredits] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [paywallDetail, setPaywallDetail] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inflight = takes.some((t) => t.status === "pending" || t.status === "generating");
  const canSubmit = text.trim().length > 0 && !submitting && !inflight;
  const latestReady = takes.find((t) => t.status === "ready" && t.audio_url) ?? null;

  // Hidrata os últimos takes DESTA voz ao abrir — o último áudio fica sempre
  // na tela e gerações em andamento voltam com o spinner (o poll retoma).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/v1/generations?voice_id=${voiceId}&limit=${HYDRATE_LIMIT}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const json = await r.json();
        const rows = (json.generations ?? []) as Array<{
          id: string;
          status: Take["status"];
          text_raw: string | null;
          audio_url: string | null;
          error_message: string | null;
          duration_seconds: number | null;
          elapsed_seconds: number | null;
          created_at: string;
        }>;
        if (cancelled || rows.length === 0) return;
        setTakes((prev) => {
          const seen = new Set(prev.map((t) => t.id));
          const hydrated: Take[] = rows
            .filter((g) => !seen.has(g.id))
            .map((g) => ({
              id: g.id,
              status: g.status,
              text: g.text_raw ?? "",
              audio_url: g.audio_url,
              error_message: g.error_message,
              duration_seconds: g.duration_seconds,
              elapsed_seconds: g.elapsed_seconds,
              startedAt: Date.parse(g.created_at) || Date.now(),
            }));
          return [...prev, ...hydrated];
        });
      } catch {
        /* sem hidratação — a tela segue funcionando como antes */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [voiceId]);

  /**
   * Apagar um take aqui mesmo (Johnny 29/08: "não tem botão de delete para
   * apagar os áudios gerados"). O botão existia só na tela Histórico; quem
   * está gerando não via saída nenhuma. Mesma rota (DELETE /generations),
   * que já limpa o arquivo no R2 e a linha no banco.
   */
  async function apagarTake(id: string) {
    setTakes((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch("/api/v1/generations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      /* o take já saiu da tela; o histórico mostra a verdade no próximo load */
    }
  }

  // Poll dos takes em andamento — atualiza a lista in place.
  useEffect(() => {
    if (!inflight) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const pending = takes.filter((t) => t.status === "pending" || t.status === "generating");
      for (const t of pending) {
        try {
          const r = await fetch(`/api/v1/generations/${t.id}`, { cache: "no-store" });
          if (!r.ok) continue;
          const json = await r.json();
          const gen = json.generation as Omit<Take, "text" | "startedAt">;
          setTakes((prev) =>
            prev.map((p) => (p.id === t.id ? { ...p, ...gen } : p)),
          );
          if (gen.status === "ready" || gen.status === "failed") router.refresh();
        } catch {
          /* próximo tick */
        }
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [inflight, takes, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setNoCredits(false);

    try {
      // A referência (se houver) é lida da voz no backend — nada de upload aqui.
      const genRes = await fetch(`/api/v1/voices/${voiceId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          ...(pauseMs !== null ? { chunk_silence_ms: pauseMs } : {}),
          ...(speed !== "normal" ? { speed } : {}),
          ...(ajustarRitmo ? { rate_qa: true } : {}),
        }),
      });
      if (genRes.status === 402) {
        const j = await genRes.json().catch(() => ({}));
        setSubscribed(Boolean(j?.error?.details?.subscribed));
        setPaywallDetail(j?.error?.message ?? null);
        setNoCredits(true);
        return;
      }
      if (!genRes.ok) {
        const j = await genRes.json().catch(() => ({}));
        throw new Error(j?.error?.message || t("generator.startError"));
      }
      const { generation_id } = await genRes.json();
      setTakes((prev) => [
        {
          id: generation_id,
          status: "pending",
          text: text.trim(),
          audio_url: null,
          error_message: null,
          duration_seconds: null,
          elapsed_seconds: null,
          startedAt: Date.now(),
        },
        ...prev,
      ]);
    } catch (e) {
      // Falha de rede/cliente não passa pelo servidor — registra pra existir
      // no nosso log (mesmo defeito do image-studio, caso VP 19/08).
      clientLogger.error("voice.generate_start_failed", {
        voiceId,
        message: e instanceof Error ? e.message : String(e),
      });
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadAudio(url: string) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `fastpost-voz-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank"); // fallback: abre em nova aba
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <style>{ANIM_CSS}</style>

      {/* Formulário — nunca some */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gen-text" className="font-mono text-[11px] tracking-wide text-[var(--mute)]">
            {t("generator.textLabel")}
          </label>
          <textarea
            id="gen-text"
            required
            maxLength={TEXT_MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={t("generator.placeholder")}
            className="resize-none rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
          />
          <span className="self-end font-mono text-[10px] tabular-nums text-[var(--ash)]">
            {text.length} / {TEXT_MAX}
          </span>
        </div>

        {/* Ritmo da fala — controle simples por cima do chunk_silence_ms */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">
            {t("generator.pauseLabel")}
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { v: null, label: t("generator.pauseNatural") },
              { v: 250, label: t("generator.pauseMedium") },
              { v: 550, label: t("generator.pauseLong") },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setPauseMs(opt.v)}
                aria-pressed={pauseMs === opt.v}
                className={`rounded-[var(--radius)] border px-3 py-1.5 font-mono text-[11px] tracking-wide transition-colors ${
                  pauseMs === opt.v
                    ? "border-[var(--hairline-bright)] text-[var(--ink)]"
                    : "border-[var(--hairline)] text-[var(--ash)] hover:text-[var(--ink)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ajuste de ritmo — escolha do aluno (29/08). Padrão desligado. */}
        <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] px-3.5 py-3 has-[:checked]:border-[var(--hairline-bright)]">
          <input
            type="checkbox"
            checked={ajustarRitmo}
            onChange={(e) => {
              const ligado = e.target.checked;
              setAjustarRitmo(ligado);
              // Sem o QA de ritmo o worker DESCARTA o speech_rate_factor
              // (inference.py:137-138 retorna antes de ler a 145-146). Zerar a
              // escolha aqui evita que ela fique gravada em request_params e
              // seja repetida no reenvio automático sem nunca ter efeito.
              if (!ligado) setSpeed("normal");
            }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--pill-bg)]"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-[13px] font-medium text-[var(--ink)]">{t("generator.rateQaLabel")}</span>
            <span className="text-[12px] leading-[1.45] text-[var(--mute)]">{t("generator.rateQaHelp")}</span>
          </span>
        </label>

        {/* Ritmo (opcao B, 25/08): o QA de ritmo segura o clone na velocidade
            natural da pessoa (medida no treino); aqui o aluno desloca essa
            regua em 15% pra baixo ou pra cima.
            ⚠️ Este seletor SO tem efeito com a caixa acima marcada: ele vira
            `speech_rate_factor`, que multiplica a REGUA do QA de ritmo
            (inference.py:145-146). Com o QA desligado nao existe regua, o
            worker retorna antes (137-138) e `_ajustar_ritmo_global` no-opa
            (158-159) — o audio sai identico. Ate 30/08 o seletor aparecia
            sempre e a escolha era descartada em silencio, gastando credito
            (incidente #200). Se um dia o fator passar a valer sem o QA,
            remova o `disabled` — nao o contrario. */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">
            {t("generator.speedLabel")}
          </span>
          <div className="flex flex-wrap gap-2">
            {([
              { v: "calm", label: t("generator.speedCalm") },
              { v: "normal", label: t("generator.speedNormal") },
              { v: "fast", label: t("generator.speedFast") },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setSpeed(opt.v)}
                disabled={!ajustarRitmo}
                aria-pressed={speed === opt.v}
                className={`rounded-[var(--radius)] border px-3 py-1.5 font-mono text-[11px] tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  speed === opt.v
                    ? "border-[var(--hairline-bright)] text-[var(--ink)]"
                    : `border-[var(--hairline)] text-[var(--ash)] ${ajustarRitmo ? "hover:text-[var(--ink)]" : ""}`
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {!ajustarRitmo && (
            <span className="text-[12px] leading-[1.45] text-[var(--mute)]">
              {t("generator.speedNeedsRateQa")}
            </span>
          )}
        </div>

        {error && <SupportError action={t("generator.supportAction")} message={error} />}

        <button type="submit" disabled={!canSubmit} className={`${PILL} w-fit`}>
          {submitting || inflight ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <AudioLines className="h-4 w-4" />
          )}
          {inflight ? t("generator.generating") : t("generator.generate")}
        </button>
      </form>

      {/* Takes da sessão — mesma janela, mais novo em cima */}
      {takes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]">
            {t("generator.sessionTitle")}
          </h2>
          <ul className="flex flex-col gap-2">
            {takes.map((take) => (
              <li
                key={take.id}
                className="relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-3"
              >
                {(take.status === "pending" || take.status === "generating") && (
                  <>
                    <span className="vg-shimmer pointer-events-none absolute inset-0" aria-hidden />
                    <span className="flex items-center gap-2 text-sm text-[var(--body)]">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--silver)]" />
                      {t("generator.generatingWord")}<span className="vg-dots" />
                    </span>
                  </>
                )}
                {take.status === "failed" && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 font-mono text-[11px] text-[var(--status-error)]">
                      <AlertTriangle className="h-4 w-4" />
                      {take.error_message || t("generator.failed")}
                    </span>
                    <button
                      type="button"
                      onClick={() => apagarTake(take.id)}
                      aria-label={t("generator.deleteAria")}
                      title={t("generator.deleteAria")}
                      className="shrink-0 text-[var(--mute)] transition-colors hover:text-[var(--status-error)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {take.status === "ready" && take.audio_url && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <audio src={take.audio_url} controls preload="metadata" className="w-full sm:flex-1" />
                    <button
                      type="button"
                      onClick={() => downloadAudio(take.audio_url!)}
                      aria-label={t("generator.downloadAria")}
                      className="inline-flex h-9 w-fit shrink-0 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-3 text-[13px] text-[var(--ink)] hover:border-[var(--hairline-bright)]"
                    >
                      <Download className="h-4 w-4" /> {t("generator.download")}
                    </button>
                    <button
                      type="button"
                      onClick={() => apagarTake(take.id)}
                      aria-label={t("generator.deleteAria")}
                      title={t("generator.deleteAria")}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] text-[var(--mute)] transition-colors hover:border-[var(--hairline-bright)] hover:text-[var(--status-error)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <p className="line-clamp-2 text-[12px] leading-snug text-[var(--mute)]">“{take.text}”</p>
                {/* 29/08 (Johnny): "não consigo copiar o texto novamente se
                    quiser" — o texto ficava preso no card, cortado em 2 linhas.
                    Copiar leva pra área de transferência; Reusar devolve pro
                    campo de cima, pra gerar de novo com um ajuste. */}
                <div className="flex flex-wrap gap-3 font-mono text-[10px] tracking-wide">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(take.text);
                        setCopiado(take.id);
                        setTimeout(() => setCopiado((c) => (c === take.id ? null : c)), 2000);
                      } catch {
                        /* navegador sem permissão: o Reusar ainda resolve */
                      }
                    }}
                    className="text-[var(--silver)] underline decoration-[var(--hairline-bright)] underline-offset-[3px] hover:text-[var(--ink)]"
                  >
                    {copiado === take.id ? t("generator.copiado") : t("generator.copiarTexto")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setText(take.text);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="text-[var(--silver)] underline decoration-[var(--hairline-bright)] underline-offset-[3px] hover:text-[var(--ink)]"
                  >
                    {t("generator.reusarTexto")}
                  </button>
                </div>
                <div className="flex gap-3 font-mono text-[10px] tracking-wide text-[var(--ash)]">
                  <span>{new Date(take.startedAt).toLocaleTimeString("pt-BR")}</span>
                  {take.duration_seconds ? <span>· {formatDuration(take.duration_seconds)}</span> : null}
                  {/* Só em take pronta (18/08, incidente d3d8d1b2): falha agora
                      também grava elapsed_seconds pra diagnóstico, e "gerado em
                      1879.6s" embaixo da mensagem de erro confundiria o aluno. */}
                  {take.status === "ready" && take.elapsed_seconds ? (
                    <span>{t("generator.generatedIn", { s: take.elapsed_seconds.toFixed(1) })}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <p className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
            {t("generator.savedNote")}
          </p>
        </section>
      )}

      {/* Barra fixa: o último áudio pronto, sempre à mão (sem autoplay). */}
      {latestReady && (
        <div className="sticky bottom-0 z-10 -mx-1 border-t border-[var(--hairline-strong)] bg-[var(--surface-deep)]/95 px-1 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-wide text-[var(--ash)] sm:inline">
              {t("generator.latestBar")}
            </span>
            <audio
              key={latestReady.id}
              src={latestReady.audio_url!}
              controls
              preload="metadata"
              className="h-9 w-full flex-1"
            />
            <button
              type="button"
              onClick={() => downloadAudio(latestReady.audio_url!)}
              aria-label={t("generator.downloadAria")}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-3 text-[13px] text-[var(--ink)] hover:border-[var(--hairline-bright)]"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <PaywallModal
        open={noCredits}
        onClose={() => setNoCredits(false)}
        subscribed={subscribed}
        action={t("generator.paywallAction")}
        detail={paywallDetail}
      />
    </div>
  );
}
