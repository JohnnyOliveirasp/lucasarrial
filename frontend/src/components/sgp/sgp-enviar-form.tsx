"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { SGP_ERROR_CLASS, SGP_GHOST_CLASS, SGP_INPUT_CLASS, SGP_LABEL_CLASS, SGP_PILL_CLASS } from "./sgp-classes";

/**
 * Rodapé da tela 4: **criar a senha** (é aqui que a conta nasce — Johnny
 * 29/08), LGPD + declaração e "Confirmar e Enviar".
 * E-mail que já tinha conta no FastCloner não pede senha: o material é
 * anexado à conta dele e o acompanhamento pede login.
 */
export function SgpEnviarForm({ email, contaExistente }: { email: string; contaExistente: boolean }) {
  const t = useTranslations("sgp.revisao");
  const router = useRouter();
  const supabase = createClient();

  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const senhasDiferem = senha2.length > 0 && senha !== senha2;
  const senhaOk = contaExistente || (senha.length >= 8 && senha === senha2);

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/v1/sgp/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aceite, senha: contaExistente ? null : senha }),
      });
      const j = (await r.json().catch(() => null)) as
        | { error?: { message?: string }; contaCriada?: boolean; proximo?: string }
        | null;
      if (!r.ok) throw new Error(j?.error?.message ?? t("erroEnviar"));

      // Conta recém-criada: já entra, pra cair direto no acompanhamento.
      if (j?.contaCriada && senha) {
        await supabase.auth.signInWithPassword({ email, password: senha }).catch(() => null);
      }
      router.push(j?.proximo ?? "/app/sgp");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erroEnviar"));
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--silver)]">
          {t("acessoTitulo")}
        </p>
        {contaExistente ? (
          <p className="text-[13px] leading-[1.5] text-[var(--silver)]">{t("acessoExistente", { email })}</p>
        ) : (
          <>
            <p className="text-[13px] leading-[1.5] text-[var(--mute)]">{t("acessoDescricao", { email })}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sgp-senha" className={SGP_LABEL_CLASS}>{t("senha")}</label>
                <input
                  id="sgp-senha"
                  type="password"
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
                  minLength={8}
                  autoComplete="new-password"
                  value={senha2}
                  onChange={(e) => setSenha2(e.target.value)}
                  aria-invalid={senhasDiferem}
                  className={SGP_INPUT_CLASS}
                />
              </div>
            </div>
            {senhasDiferem ? (
              <p className="text-[13px] text-[var(--status-error)]">{t("senhasDiferem")}</p>
            ) : null}
          </>
        )}
      </section>

      <div className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-4 py-4 text-[13px] leading-[1.55] text-[var(--silver)]">
        <p className="mb-1 font-semibold text-[var(--ink)]">{t("lgpdTitulo")}</p>
        <p>{t("lgpdTexto")}</p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-4 py-4 text-[13px] leading-[1.5] text-[var(--silver)] has-[:checked]:border-[var(--hairline-bright)] has-[:checked]:text-[var(--ink)]">
        <input
          type="checkbox"
          checked={aceite}
          onChange={(e) => setAceite(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--pill-bg)]"
        />
        <span>{t("declaracao")}</span>
      </label>

      <p className="text-[13px] leading-[1.5] text-[var(--mute)]">{t("avisoProcessamento")}</p>

      {erro ? <p role="alert" className={SGP_ERROR_CLASS}>{erro}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => router.push("/sgp/audio")} className={SGP_GHOST_CLASS}>
          ← {t("voltar")}
        </button>
        <button type="button" disabled={!aceite || !senhaOk || enviando} onClick={enviar} className={SGP_PILL_CLASS}>
          {enviando ? t("enviando") : t("confirmarEnviar")}
        </button>
      </div>
    </div>
  );
}
