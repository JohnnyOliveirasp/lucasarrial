"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizarWhatsapp } from "@/lib/sgp/types";
import { SgpOtp } from "./sgp-otp";
import {
  SGP_ERROR_CLASS,
  SGP_HINT_CLASS,
  SGP_INPUT_CLASS,
  SGP_LABEL_CLASS,
  SGP_PILL_CLASS,
} from "./sgp-classes";

type Etapa = "form" | "otp";

/**
 * Tela 1 do SGP — Seus dados + Acesso (decisões 29/08):
 *  nome, WhatsApp, e-mail, senha, repetir senha → "Enviar código" → código por
 *  e-mail → validou = grava nome/WhatsApp no perfil e segue pra foto.
 *  - Sem Google. A conta é criada por nós com o e-mail/senha dele (signUp).
 *  - E-mail que JÁ tem conta: não bloqueia — o código vira login
 *    (signInWithOtp) e ele segue o wizard logado. Zero conta duplicada.
 */
export function StepDadosForm({ nomeInicial = "", emailInicial = "" }: { nomeInicial?: string; emailInicial?: string }) {
  const t = useTranslations("sgp.dados");
  const router = useRouter();
  const supabase = createClient();

  const [etapa, setEtapa] = useState<Etapa>("form");
  const [nome, setNome] = useState(nomeInicial);
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState(emailInicial);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [contaNova, setContaNova] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const senhasDiferem = senha2.length > 0 && senha !== senha2;
  const whatsappOk = normalizarWhatsapp(whatsapp) !== null;

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (nome.trim().length < 3) return setErro(t("nomeCurto"));
    if (!whatsappOk) return setErro(t("whatsappInvalido"));
    if (senha !== senha2) return setErro(t("senhasDiferem"));
    setEnviando(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: {
          full_name: nome.trim(),
          whatsapp: normalizarWhatsapp(whatsapp),
          onboarding_source: "sgp",
        },
      },
    });

    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("rate")) setErro(t("muitasTentativas"));
      else if (m.includes("already")) await entrarPorCodigo();
      else setErro(t("erroGenerico"));
      setEnviando(false);
      return;
    }

    // Com confirmação de e-mail ligada, o Supabase NÃO erra quando o e-mail
    // já existe: devolve um usuário sem identidades e não manda nada.
    // É o sinal da conta existente → o código passa a ser o login.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      await entrarPorCodigo();
      setEnviando(false);
      return;
    }

    setContaNova(true);
    setEtapa("otp");
    setEnviando(false);
  }

  async function entrarPorCodigo() {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    if (error) {
      setErro(error.message.toLowerCase().includes("rate") ? t("muitasTentativas") : t("erroGenerico"));
      return;
    }
    setContaNova(false);
    setEtapa("otp");
  }

  async function concluir() {
    const res = await fetch("/api/v1/sgp/pedido", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome: nome.trim(), whatsapp }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new Error(j?.error?.message ?? t("erroGenerico"));
    }
    router.push("/sgp/foto");
    router.refresh();
  }

  if (etapa === "otp") {
    return <SgpOtp email={email.trim()} contaNova={contaNova} onVerificado={concluir} />;
  }

  return (
    <form onSubmit={enviarCodigo} className="flex flex-col gap-5">
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

      <div className="h-px bg-[var(--hairline)]" />

      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-[var(--ink)]">{t("acessoTitulo")}</p>
        <p className="text-[13px] leading-[1.5] text-[var(--mute)]">{t("acessoDescricao")}</p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sgp-senha" className={SGP_LABEL_CLASS}>{t("senha")}</label>
          <input
            id="sgp-senha"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder={t("senhaPlaceholder")}
            className={SGP_INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sgp-senha2" className={SGP_LABEL_CLASS}>{t("senha2")}</label>
          <input
            id="sgp-senha2"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={senha2}
            onChange={(e) => setSenha2(e.target.value)}
            placeholder={t("senha2Placeholder")}
            aria-invalid={senhasDiferem}
            className={SGP_INPUT_CLASS}
          />
        </div>
      </div>
      {senhasDiferem ? (
        <p className="-mt-3 text-[13px] text-[var(--status-error)]">{t("senhasDiferem")}</p>
      ) : null}

      <p className={SGP_HINT_CLASS}>{t("dicaCodigo")}</p>

      {erro ? (
        <p role="alert" className={SGP_ERROR_CLASS}>{erro}</p>
      ) : null}

      <button
        type="submit"
        disabled={enviando || senhasDiferem || senha.length < 8}
        className={SGP_PILL_CLASS}
      >
        {enviando ? t("enviandoCodigo") : t("enviarCodigo")}
      </button>
    </form>
  );
}
