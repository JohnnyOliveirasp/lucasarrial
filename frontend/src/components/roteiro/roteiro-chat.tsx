"use client";

/**
 * Chat de ajuste do roteiro (Fase 5).
 *
 * Cada mensagem custa crédito, então o preço fica visível ANTES de enviar
 * (pedido do Lucas) e a conversa vem do servidor — assim um F5 não apaga o
 * que o aluno pagou.
 *
 * Quando a resposta traz um roteiro novo, quem troca o texto na tela é o pai
 * (`onScript`): o roteiro é um só, e ele mora no painel de cima.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MessageSquare, SendHorizontal } from "lucide-react";
import { ROTEIRO_CHAT_COST, ROTEIRO_CHAT_MAX } from "@/lib/roteiro/config";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Props = {
  scriptId: string;
  /** Equipe/admin não paga — não faz sentido mostrar preço pra eles. */
  unlimited: boolean;
  /** Chamado quando a resposta reescreve o roteiro. */
  onScript: (script: string) => void;
  /** Faltou crédito no meio da conversa. */
  onPaywall: (detail: string | null) => void;
};

export function RoteiroChat({ scriptId, unlimited, onScript, onPaywall }: Props) {
  const t = useTranslations("roteiro");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/roteiro/${scriptId}/chat`);
      if (!res.ok) return;
      const data = (await res.json()) as { items?: Msg[] };
      setMsgs(data.items ?? []);
    } catch {
      /* conversa vazia é estado válido */
    }
  }, [scriptId]);

  useEffect(() => {
    setMsgs([]);
    setError(null);
    void load();
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs.length, busy]);

  async function send() {
    const message = text.trim();
    if (busy || message.length < 2) return;
    setBusy(true);
    setError(null);
    // Eco otimista: a mensagem do aluno aparece na hora, o resto vem do servidor.
    const eco: Msg = {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
    };
    setMsgs((m) => [...m, eco]);
    setText("");
    try {
      const res = await fetch(`/api/v1/roteiro/${scriptId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        script?: string | null;
        error?: { message?: string };
        message?: string;
      };
      if (res.status === 402) {
        setMsgs((m) => m.filter((x) => x.id !== eco.id));
        setText(message);
        onPaywall(data.error?.message ?? data.message ?? null);
        return;
      }
      if (!res.ok || !data.reply) {
        setMsgs((m) => m.filter((x) => x.id !== eco.id));
        setText(message);
        setError(data.error?.message ?? data.message ?? t("errorGeneric"));
        return;
      }
      if (data.script) onScript(data.script);
      await load();
    } catch {
      setMsgs((m) => m.filter((x) => x.id !== eco.id));
      setText(message);
      setError(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[var(--silver)]" />
        <h2 className="font-sans text-[15px] font-semibold text-[var(--ink)]">
          {t("chatTitle")}
        </h2>
      </div>
      <p className="text-xs text-[var(--mute)]">{t("chatHelp")}</p>

      {msgs.length > 0 && (
        <ul className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
          {msgs.map((m) => (
            <li
              key={m.id}
              className={[
                "max-w-[85%] rounded-[var(--radius)] px-4 py-3 text-sm leading-[1.6]",
                m.role === "user"
                  ? "self-end border border-[var(--hairline-strong)] bg-[var(--surface-raised)] text-[var(--ink)]"
                  : "self-start border border-[var(--hairline)] bg-[var(--surface-elevated)] text-[var(--mute)]",
              ].join(" ")}
            >
              <span className="whitespace-pre-wrap">{m.content}</span>
            </li>
          ))}
          {busy && (
            <li className="self-start rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-elevated)] px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--ash)]" />
            </li>
          )}
          <div ref={endRef} />
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, ROTEIRO_CHAT_MAX))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={t("chatPlaceholder")}
            className="w-full resize-y rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-4 py-3 font-sans text-[15px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ash)] focus:border-[var(--hairline-bright)]"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || text.trim().length < 2}
            title={t("chatSend")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] text-[var(--ink)] transition-[background-color,border-color] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </button>
        </div>
        {!unlimited && (
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--ash)]">
            {t("chatCost", { n: ROTEIRO_CHAT_COST })}
          </span>
        )}
        {error && (
          <p role="alert" className="text-sm text-[var(--danger,#ff6b6b)]">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
