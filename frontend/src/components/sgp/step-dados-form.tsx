"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { normalizarWhatsapp } from "@/lib/sgp/types";
import {
  SGP_ERROR_CLASS,
  SGP_GHOST_CLASS,
  SGP_HINT_CLASS,
  SGP_INPUT_CLASS,
  SGP_LABEL_CLASS,
  SGP_PILL_CLASS,
} from "./sgp-classes";

const REENVIO_S = 60;

/**
 * Tela 1 do SGP — Seus dados (Johnny 29/08, 2ª rodada):
 * nome, WhatsApp e e-mail + **código de 6 dígitos que NÓS mandamos** pelo
 * suporte@. **Nenhuma conta é criada aqui** — o cadastro na plataforma
 * acontece só no "Confirmar e Enviar" da tela 4. Por isso a senha migrou
 * pra lá: não faz sentido pedir senha de conta que ainda não vai existir.
 */
export function StepDadosForm({
  nomeInicial = "",
  emailInicial = "",
  whatsappInicial = "",
}: {
  nomeInicial?: string;
  emailInicial?: string;
  whatsappInicial?: string;
}) {
  const t = useTranslations("sgp.dados");
  const router = useRouter();

  const [etapa, setEtapa] = useState<"form" | "codigo">("form");
  const [nome, setNome] = useState(nomeInicial);
  const [whatsapp, setWhatsapp] = useState(whatsappInicial);
  const [email, setEmail] = useState(emailInicial);
  const [contaExistente, setContaExistente] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [espera, setEspera] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (espera <= 0) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }
    if (!timer.current) timer.current = setInterval(() => setEspera((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [espera]);

  const whatsappOk = normalizarWhatsapp(whatsapp) !== null;

  async function pedirCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    setErro(null);
    if (nome.trim().length < 3) return setErro(t("nomeCurto"));
    if (!whatsappOk) return setErro(t("whatsappInvalido"));
    setEnviando(true);
    try {
      const r = await fetch("/api/v1/sgp/inicio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), whatsapp, email: email.trim() }),
      });
      const j = (await r.json().catch(() => null)) as
        | { error?: { message?: string }; conta_existente?: boolean }
        | null;
      if (!r.ok) throw new Error(j?.error?.message ?? t("erroGenerico"));
      setContaExistente(j?.conta_existente === true);
      setEtapa("codigo");
      setEspera(REENVIO_S);
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : t("erroGenerico"));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/v1/sgp/codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
      if (!r.ok) throw new Error(j?.error?.message ?? t("codigoInvalido"));
      router.push("/sgp/foto");
      router.refresh();
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : t("erroGenerico"));
      setEnviando(false);
    }
  }

  if (etapa === "codigo") {
    return (
      <form onSubmit={confirmar} className="flex flex-col gap-4">
        <div className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-4 py-4">
          <p className="mb-1 text-[13px] font-medium text-[var(--silver)]">
            {contaExistente ? t("codigoEnviadoContaExistente") : t("codigoEnviado")}
          </p>
          <p className="text-[14px] text-[var(--ink)]">{email.trim()}</p>
        </div>

        <label htmlFor="sgp-codigo" className={SGP_LABEL_CLASS}>{t("codigoLabel")}</label>
        <input
          id="sgp-codigo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-4 text-center font-mono text-2xl tracking-[0.4em] text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
        />

        {erro ? <p role="alert" className={SGP_ERROR_CLASS}>{erro}</p> : null}

        <button type="submit" disabled={enviando || codigo.length < 6} className={SGP_PILL_CLASS}>
          {enviando ? t("verificando") : t("verificarEContinuar")}
        </button>

        <div className="flex justify-center gap-3">
          <button type="button" onClick={() => setEtapa("form")} className={`${SGP_GHOST_CLASS} sgp-btn--sm`}>
            {t("mudarEmail")}
          </button>
          <button
            type="button"
            onClick={() => pedirCodigo()}
            disabled={espera > 0 || enviando}
            className={`${SGP_GHOST_CLASS} sgp-btn--sm`}
          >
            {espera > 0 ? t("reenviarEm", { seconds: espera }) : t("reenviar")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={pedirCodigo} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="sgp-nome" className={SGP_LABEL_CLASS}>{t("nome")}</label>
        <input
          id="sgp-nome"
          type="text"
          required
          autoComplete="name"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={t("nomePlaceholder")}
          className={SGP_INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sgp-whatsapp" className={SGP_LABEL_CLASS}>{t("whatsapp")}</label>
        <input
          id="sgp-whatsapp"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="+55 (11) 99999-9999"
          aria-invalid={whatsapp.length > 0 && !whatsappOk}
          className={SGP_INPUT_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sgp-email" className={SGP_LABEL_CLASS}>{t("email")}</label>
        <input
          id="sgp-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className={SGP_INPUT_CLASS}
        />
      </div>

      <p className={SGP_HINT_CLASS}>{t("dicaCodigo")}</p>

      {erro ? <p role="alert" className={SGP_ERROR_CLASS}>{erro}</p> : null}

      <button type="submit" disabled={enviando} className={SGP_PILL_CLASS}>
        {enviando ? t("enviandoCodigo") : t("enviarCodigo")}
      </button>
    </form>
  );
}
