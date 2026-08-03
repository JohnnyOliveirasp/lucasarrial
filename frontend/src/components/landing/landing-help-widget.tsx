"use client";

/**
 * Mary na LANDING — balão flutuante pra visitante NÃO logado (pré-venda).
 * Versão enxuta do help-widget do app: só texto, histórico no sessionStorage
 * (API é stateless), sem prints/áudio. Estilo casado com o DS dark do site.
 */
import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

type Msg = { from_me: boolean; content: string };

const STORE = "fc-landing-help-v1";

const I18N: Record<string, { title: string; hello: string; placeholder: string; error: string }> = {
  pt: {
    title: "Mary · FastCloner",
    hello: "Oi! 👋 Eu sou a Mary. Posso te explicar como funciona a clonagem de voz, os vídeos, o preço… o que você quiser saber!",
    placeholder: "Escreva sua dúvida…",
    error: "Não consegui responder agora — tente de novo em instantes.",
  },
  es: {
    title: "Mary · FastCloner",
    hello: "¡Hola! 👋 Soy Mary. Puedo explicarte cómo funciona la clonación de voz, los videos, el precio… ¡lo que quieras saber!",
    placeholder: "Escribe tu duda…",
    error: "No pude responder ahora — inténtalo de nuevo en unos instantes.",
  },
  en: {
    title: "Mary · FastCloner",
    hello: "Hi! 👋 I'm Mary. I can explain how voice cloning works, the videos, pricing… whatever you'd like to know!",
    placeholder: "Type your question…",
    error: "I couldn't reply right now — please try again in a moment.",
  },
};

export function LandingHelpWidget({ locale }: { locale: string }) {
  const t = I18N[locale.slice(0, 2)] ?? I18N.pt;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE);
      if (raw) setMsgs(JSON.parse(raw) as Msg[]);
    } catch { /* começa vazio */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-24))); } catch { /* cheio */ }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    const history = msgs.slice(-12);
    setMsgs((m) => [...m, { from_me: false, content: text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/landing-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history, locale }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || t.error);
      setMsgs((m) => [...m, { from_me: true, content: String(j.reply ?? "") }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Balão flutuante */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.title}
        className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full border border-white/15 bg-[#111114] shadow-[0_8px_30px_rgba(0,0,0,.5)] transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="size-6 text-white" /> : <MessageCircle className="size-6 text-white" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[480px] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0f] shadow-[0_16px_60px_rgba(0,0,0,.6)]">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="inline-flex size-2 rounded-full bg-emerald-400" />
            <span className="font-sans text-[14px] font-semibold text-white">{t.title}</span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            <Bubble mary text={t.hello} />
            {msgs.map((m, i) => (
              // convenção do app: from_me = mensagem DA MARY
              <Bubble key={i} mary={m.from_me} text={m.content} />
            ))}
            {busy && (
              <div className="mb-2 flex justify-start">
                <span className="rounded-2xl bg-white/[0.06] px-3 py-2">
                  <Loader2 className="size-4 animate-spin text-neutral-400" />
                </span>
              </div>
            )}
            {error && <p className="px-1 text-[11px] text-red-400">{error}</p>}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="flex items-center gap-2 border-t border-white/10 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.placeholder}
              maxLength={1000}
              className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 font-sans text-[13px] text-white placeholder:text-neutral-500 focus:border-white/25 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Enviar"
              className="flex size-10 flex-none items-center justify-center rounded-xl bg-white text-black transition-opacity disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ mary = false, text }: { mary?: boolean; text: string }) {
  // Mary à esquerda (cinza); visitante à direita (branco).
  return (
    <div className={`mb-2 flex ${mary ? "justify-start" : "justify-end"}`}>
      <span
        className={[
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 font-sans text-[13px] leading-relaxed",
          mary ? "bg-white/[0.06] text-neutral-100" : "bg-white text-black",
        ].join(" ")}
      >
        {text}
      </span>
    </div>
  );
}
