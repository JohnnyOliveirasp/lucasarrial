"use client";

/**
 * Botão "Ajuda" das telas do SGP — a Fast dentro do formulário.
 *
 * Mesma ideia do balão da landing (histórico no sessionStorage, API
 * stateless), com duas diferenças que importam: manda o PASSO em que a pessoa
 * está — é assim que a Fast responde sobre a tela certa — e usa os tokens do
 * SGP, pra não colar um balão laranja da landing dentro do wizard.
 *
 * A pessoa aqui não tem conta: quem identifica o pedido é o cookie da sessão,
 * lido no servidor. O navegador nunca manda quem ele é.
 */
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { HelpCircle, Loader2, Send, X } from "lucide-react";
import type { SgpPasso } from "@/lib/sgp/types";
import { SGP_ERROR_CLASS } from "./sgp-classes";

type Msg = { from_me: boolean; content: string };

const STORE = "fc-sgp-ajuda-v1";
const HISTORICO_MAX = 24;

export function SgpAjudaWidget({ passo }: { passo: SgpPasso }) {
  const t = useTranslations("sgp.ajuda");
  const locale = useLocale();
  const [aberto, setAberto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORE);
      if (raw) setMsgs(JSON.parse(raw) as Msg[]);
    } catch {
      /* começa vazio */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-HISTORICO_MAX)));
    } catch {
      /* storage cheio: a conversa da tela continua valendo */
    }
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, aberto]);

  async function enviar() {
    const pergunta = texto.trim();
    if (!pergunta || ocupado) return;
    setTexto("");
    setErro(null);
    const history = msgs.slice(-12);
    setMsgs((m) => [...m, { from_me: false, content: pergunta }]);
    setOcupado(true);
    try {
      const res = await fetch("/api/v1/sgp/ajuda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pergunta, history, passo, locale }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(j?.error?.message || t("erro"));
      setMsgs((m) => [...m, { from_me: true, content: String(j.reply ?? "") }]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erro"));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        aria-label={t("botao")}
        aria-expanded={aberto}
        className="sgp-btn sgp-btn--sm fixed bottom-5 right-5 z-50 shadow-[0_10px_40px_rgba(0,0,0,.45)]"
      >
        {aberto ? <X className="size-4" /> : <HelpCircle className="size-4" />}
        {aberto ? t("fechar") : t("botao")}
      </button>

      {aberto ? (
        <div
          role="dialog"
          aria-label={t("titulo")}
          className="fixed bottom-20 right-5 z-50 flex h-[min(70svh,480px)] w-[min(92vw,360px)] flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-[0_16px_60px_rgba(0,0,0,.6)]"
        >
          <div className="flex items-center gap-2 border-b border-[var(--hairline-strong)] px-4 py-3">
            <span className="inline-flex size-2 rounded-full bg-[var(--status-success,#34d399)]" />
            <span className="text-[13px] font-semibold text-[var(--ink)]">{t("titulo")}</span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            <Balao daFast texto={t("saudacao")} />
            {msgs.map((m, i) => (
              // convenção do app: from_me = mensagem DA Fast
              <Balao key={i} daFast={m.from_me} texto={m.content} />
            ))}
            {ocupado ? (
              <div className="mb-2 flex justify-start">
                <span className="rounded-[var(--radius)] bg-[var(--surface-deep)] px-3 py-2">
                  <Loader2 className="size-4 animate-spin text-[var(--ash)]" />
                </span>
              </div>
            ) : null}
            {erro ? <p className={SGP_ERROR_CLASS}>{erro}</p> : null}
            <div ref={fim} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
            className="flex items-center gap-2 border-t border-[var(--hairline-strong)] p-3"
          >
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={t("placeholder")}
              maxLength={1000}
              className="h-10 min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 text-[13px] text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
            />
            <button
              type="submit"
              disabled={ocupado || !texto.trim()}
              aria-label={t("enviar")}
              className="sgp-btn sgp-btn--sm flex-none px-3"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

function Balao({ daFast = false, texto }: { daFast?: boolean; texto: string }) {
  return (
    <div className={`mb-2 flex ${daFast ? "justify-start" : "justify-end"}`}>
      <span
        className={[
          "max-w-[85%] whitespace-pre-wrap rounded-[var(--radius)] px-3 py-2 text-[13px] leading-[1.5]",
          daFast
            ? "bg-[var(--surface-deep)] text-[var(--silver)]"
            : "bg-[var(--pill-bg)] text-[var(--pill-ink)]",
        ].join(" ")}
      >
        {texto}
      </span>
    </div>
  );
}
