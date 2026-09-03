"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Eyebrow, Input } from "@/components/ui";

/**
 * Mesma regra de força do cadastro e do "nova senha" do reset: mínimo 8
 * caracteres (signup-form.tsx e reset-password-form.tsx usam minLength={8}).
 * Não invente uma regra diferente aqui — as três telas têm que concordar.
 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Trocar a senha SEM sair da conta (chamados #243/#244: o aluno não achava onde
 * mudar e ia parar em Configurações/API, que é outra coisa e ainda aparece
 * travada por crédito).
 *
 * Só é renderizado para conta com provider "email" — quem entra por Google não
 * tem senha nossa pra trocar. Quem decide isso é a page (server), que lê o
 * app_metadata do usuário.
 */
export function ChangePassword() {
  const t = useTranslations("shell.changePassword");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit =
    !saving && password.length >= MIN_PASSWORD_LENGTH && confirm === password;

  function edit(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      // Uma vez que o usuário volta a digitar, o "deu certo" anterior não vale
      // mais pro que está na tela.
      if (done) setDone(false);
      if (error) setError(null);
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);
    setDone(false);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      // Nunca mostrar o erro cru da API: o aluno não sabe o que fazer com
      // "AuthApiError: reauthentication needed".
      const code = authError.message.toLowerCase();
      if (
        code.includes("reauthentication") ||
        code.includes("session") ||
        code.includes("not logged in") ||
        code.includes("missing") ||
        code.includes("expired") ||
        code.includes("jwt")
      )
        setError(t("errors.reauth"));
      else if (code.includes("should be different"))
        setError(t("errors.same"));
      else if (
        code.includes("at least") ||
        code.includes("weak") ||
        code.includes("short")
      )
        setError(t("errors.weak"));
      else if (code.includes("rate") || code.includes("security purposes"))
        setError(t("errors.rateLimited"));
      else setError(t("errors.generic"));

      setSaving(false);
      return;
    }

    setPassword("");
    setConfirm("");
    setDone(true);
    setSaving(false);
  }

  return (
    <section className="flex flex-col gap-4">
      <Eyebrow className="text-[var(--ash)]">{t("eyebrow")}</Eyebrow>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5"
      >
        <div className="flex flex-col gap-1">
          <span className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            {t("title")}
          </span>
          <span className="text-[13px] text-[var(--mute)]">
            {t("description")}
          </span>
        </div>

        <div className="flex max-w-sm flex-col gap-1.5">
          <label
            htmlFor="new-password"
            className="text-[13px] font-medium text-[var(--silver)]"
          >
            {t("newLabel")}
          </label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={edit(setPassword)}
            placeholder={t("newPlaceholder")}
            invalid={tooShort}
          />
          {tooShort && (
            <p className="text-[13px] text-[var(--status-error)]">
              {t("tooShort")}
            </p>
          )}
        </div>

        <div className="flex max-w-sm flex-col gap-1.5">
          <label
            htmlFor="new-password-confirm"
            className="text-[13px] font-medium text-[var(--silver)]"
          >
            {t("confirmLabel")}
          </label>
          <Input
            id="new-password-confirm"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={confirm}
            onChange={edit(setConfirm)}
            placeholder={t("confirmPlaceholder")}
            invalid={mismatch}
          />
          {mismatch && (
            <p className="text-[13px] text-[var(--status-error)]">
              {t("mismatch")}
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="max-w-sm rounded-[var(--radius)] border border-[var(--status-error)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--status-error)]"
          >
            {error}
          </p>
        )}

        {done && !error && (
          <p
            role="status"
            className="flex max-w-sm items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3.5 py-2.5 text-[13px] text-[var(--silver)]"
          >
            <Check className="h-4 w-4 shrink-0 text-[var(--status-online)]" />
            {t("success")}
          </p>
        )}

        <Button
          type="submit"
          variant="secondary"
          disabled={!canSubmit}
          className="w-fit"
          iconLeft={
            saving ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined
          }
        >
          {saving ? t("submitting") : t("submit")}
        </Button>
      </form>
    </section>
  );
}
