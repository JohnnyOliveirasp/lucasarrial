"use client";

/**
 * Gerador de Roteiro — tela única: o formulário no topo, o roteiro entregue
 * logo abaixo e o histórico no fim.
 *
 * O seletor de segundos NÃO é enfeite: ele vira alvo de palavras (~2,5 pal/s
 * em pt-BR). Sem ele a LLM escreve 400 palavras e o criador só descobre que o
 * roteiro não cabe no meio da gravação.
 *
 * "Gerar áudio com a minha voz" só aparece COM o roteiro na tela — é o passo
 * seguinte do funil (roteiro → áudio → vídeo), não um campo do formulário.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { AudioLines, Check, Copy, Link2 as LinkIcon, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button, Eyebrow } from "@/components/ui";
import { PaywallModal } from "@/components/app/paywall-modal";
import { RoteiroChat } from "@/components/roteiro/roteiro-chat";
import {
  ROTEIRO_COST,
  ROTEIRO_DURATIONS,
  ROTEIRO_IDEA_MAX,
  ROTEIRO_IDEA_MIN,
  type RoteiroDuration,
} from "@/lib/roteiro/config";

type HistoryItem = {
  id: string;
  idea: string;
  seconds: number;
  script: string;
  credits_charged: number;
  created_at: string;
};

type Props = {
  /** Assinatura ativa? Só decide o CTA do paywall. */
  subscribed: boolean;
  /** Equipe/admin não paga — a tela não mostra preço pra eles. */
  unlimited: boolean;
};

export function RoteiroWorkspace({ subscribed, unlimited }: Props) {
  const t = useTranslations("roteiro");

  const [idea, setIdea] = useState("");
  /** Link de vídeo de referência (Fase 6). Opcional: vira BASE de assunto. */
  const [link, setLink] = useState("");
  const [seconds, setSeconds] = useState<RoteiroDuration>(45);
  const [busy, setBusy] = useState(false);
  /** Roteiro ABERTO na tela: o recém-gerado ou um do histórico. O id é o que
   *  liga o chat — sem ele não dá pra ajustar. */
  const [open, setOpen] = useState<{ id: string; script: string; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/roteiro");
      if (!res.ok) return;
      const data = (await res.json()) as { items?: HistoryItem[] };
      setHistory(data.items ?? []);
    } catch {
      /* histórico é secundário: falhar aqui não atrapalha gerar */
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function generate() {
    if (busy || !canGenerate) return;
    setBusy(true);
    setError(null);
    setOpen(null);
    setCopied(false);
    try {
      const res = await fetch("/api/v1/roteiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim(), link: link.trim() || undefined, seconds }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        script?: string;
        error?: { code?: string; message?: string };
        message?: string;
      };
      if (res.status === 402) {
        setPaywall(data.error?.message ?? data.message ?? null);
        return;
      }
      if (!res.ok || !data.script || !data.id) {
        setError(data.error?.message ?? data.message ?? t("errorGeneric"));
        return;
      }
      setOpen({ id: data.id, script: data.script, seconds });
      void loadHistory();
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      /* clipboard bloqueado: o texto está na tela, dá pra selecionar */
    }
  }

  async function remove(id: string) {
    setHistory((h) => h.filter((x) => x.id !== id));
    try {
      await fetch(`/api/v1/roteiro/${id}`, { method: "DELETE" });
    } catch {
      void loadHistory();
    }
  }

  /** Abre um roteiro do histórico no painel de cima (e com ele, o chat dele). */
  function openFromHistory(h: HistoryItem) {
    setOpen({ id: h.id, script: h.script, seconds: h.seconds });
    setCopied(false);
    setError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const words = open ? open.script.trim().split(/\s+/).filter(Boolean).length : 0;
  // Com link, a ideia escrita vira opcional — o assunto vem do vídeo.
  const canGenerate = idea.trim().length >= ROTEIRO_IDEA_MIN || link.trim().length > 8;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="roteiro-idea"
            className="font-sans text-sm font-medium text-[var(--ink)]"
          >
            {t("ideaLabel")}
          </label>
          <textarea
            id="roteiro-idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value.slice(0, ROTEIRO_IDEA_MAX))}
            rows={4}
            placeholder={t("ideaPlaceholder")}
            className="w-full resize-y rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-4 py-3 font-sans text-[15px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ash)] focus:border-[var(--hairline-bright)]"
          />
          <span className="self-end font-mono text-[11px] text-[var(--ash)]">
            {idea.length}/{ROTEIRO_IDEA_MAX}
          </span>
        </div>

        {/* Entrada por link: o vídeo vira BASE DE ASSUNTO, nunca cópia — a
            regra está no prompt e o aviso fica aqui, na frente do aluno. */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="roteiro-link"
            className="font-sans text-sm font-medium text-[var(--ink)]"
          >
            {t("linkLabel")}
          </label>
          <div className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-4">
            <LinkIcon className="h-4 w-4 shrink-0 text-[var(--ash)]" />
            <input
              id="roteiro-link"
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value.slice(0, 500))}
              placeholder={t("linkPlaceholder")}
              className="w-full bg-transparent py-3 font-sans text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ash)]"
            />
          </div>
          <p className="text-xs text-[var(--mute)]">{t("linkHelp")}</p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-sans text-sm font-medium text-[var(--ink)]">
            {t("durationLabel")}
          </span>
          <p className="text-xs text-[var(--mute)]">{t("durationHelp")}</p>
          <div className="flex flex-wrap gap-2">
            {ROTEIRO_DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSeconds(d)}
                aria-pressed={seconds === d}
                className={[
                  "h-10 rounded-[var(--radius)] border px-4 font-sans text-[14px] transition-[background-color,border-color]",
                  seconds === d
                    ? "border-[var(--hairline-bright)] bg-[var(--surface-raised)] text-[var(--ink)]"
                    : "border-[var(--hairline)] bg-[var(--surface-elevated)] text-[var(--mute)] hover:text-[var(--ink)]",
                ].join(" ")}
              >
                {t("durationOption", { n: d })}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={busy || !canGenerate}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("generating")}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t("generate")}
              </>
            )}
          </Button>
          {!unlimited && (
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ash)]">
              {t("cost", { n: ROTEIRO_COST.toLocaleString("pt-BR") })}
            </span>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-[var(--danger,#ff6b6b)]">
            {error}
          </p>
        )}
      </section>

      {open && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Eyebrow>{t("resultEyebrow", { n: open.seconds })}</Eyebrow>
            {/* Tempo estimado pela CONTAGEM REAL de palavras, não pelo que foi
                pedido: se o texto saiu maior, o criador precisa saber ANTES
                de gravar, não no meio. */}
            <span className="font-mono text-[11px] text-[var(--ash)]">
              {t("wordCount", { n: words })} · {t("spokenTime", { n: Math.round(words / 2.5) })}
            </span>
          </div>

          <p className="whitespace-pre-wrap font-sans text-[17px] leading-[1.7] text-[var(--ink)]">
            {open.script}
          </p>

          <div className="flex flex-wrap gap-3 border-t border-[var(--hairline)] pt-4">
            <Button variant="secondary" onClick={() => copy(open.script)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("copied") : t("copy")}
            </Button>
            <Link
              href="/app/voice-cloning/generate"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]"
            >
              <AudioLines className="h-4 w-4" />
              {t("toAudio")}
            </Link>
          </div>
          <p className="text-xs text-[var(--mute)]">{t("toAudioHelp")}</p>
        </section>
      )}

      {open && (
        <RoteiroChat
          key={open.id}
          scriptId={open.id}
          unlimited={unlimited}
          onScript={(s) => {
            setOpen((o) => (o ? { ...o, script: s } : o));
            setCopied(false);
            void loadHistory();
          }}
          onPaywall={setPaywall}
        />
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            {t("historyTitle")}
          </h2>
          <ul className="flex flex-col gap-3">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Abrir traz o roteiro pro topo COM o chat dele — é o único
                      jeito de continuar ajustando um roteiro de ontem. */}
                  <button
                    type="button"
                    onClick={() => openFromHistory(h)}
                    className="flex flex-1 flex-col gap-1 text-left"
                  >
                    <span className="font-sans text-[15px] font-medium text-[var(--ink)] hover:underline">
                      {h.idea.length > 90 ? `${h.idea.slice(0, 90)}…` : h.idea}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--ash)]">
                      {new Date(h.created_at).toLocaleString("pt-BR")} · {h.seconds}s
                    </span>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => copy(h.script)}
                      title={t("copy")}
                      className="rounded-[var(--radius-sm)] p-2 text-[var(--ash)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(h.id)}
                      title={t("delete")}
                      className="rounded-[var(--radius-sm)] p-2 text-[var(--ash)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-[1.6] text-[var(--mute)]">
                  {h.script}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PaywallModal
        open={!!paywall}
        onClose={() => setPaywall(null)}
        subscribed={subscribed}
        action={t("paywallAction")}
        detail={paywall}
      />
    </div>
  );
}
