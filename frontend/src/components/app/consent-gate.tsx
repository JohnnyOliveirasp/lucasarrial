"use client";

/**
 * Popup bloqueante de aceite de termos, exibido após o login.
 * - Checa via /api/v1/consent se o usuário já aceitou a versão vigente.
 * - Não é dismissível: só "Aceitar e continuar" (POST) ou "Sair" (signOut).
 * - Fast path por localStorage (por versão) pra não piscar a cada navegação.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LEGAL_DOCS, CONSENT_VERSION } from "@/lib/legal";
import { LegalDocView } from "@/components/legal/legal-doc-view";
import { Button } from "@/components/ui";

// Prefixo do cache; a chave final inclui o USER ID — senão, num navegador
// compartilhado, o aceite de um usuário escondia o popup de outro.
const CACHE_PREFIX = `aiverse-consent-${CONSENT_VERSION}`;

export function ConsentGate() {
  const t = useTranslations("shell.consent");
  const router = useRouter();
  const [checkedServer, setCheckedServer] = useState(false);
  const [show, setShow] = useState(false);
  const [tab, setTab] = useState(0);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Chave de cache do usuário logado (preenchida no effect). O accept() usa ela.
  const cacheKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!active || !user) return; // sem login o layout já redireciona
        const key = `${CACHE_PREFIX}-${user.id}`;
        cacheKeyRef.current = key;
        if (localStorage.getItem(key) === "1") return;
        const res = await fetch("/api/v1/consent", { cache: "no-store" });
        if (!active || !res.ok) return;
        const json = await res.json();
        if (json.accepted) {
          try {
            localStorage.setItem(key, "1");
          } catch {
            /* ignora */
          }
        } else {
          setShow(true);
        }
      } catch {
        /* se a checagem falhar, não bloqueia o uso */
      } finally {
        if (active) setCheckedServer(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function accept() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/consent", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || t("registerError"));
      }
      try {
        if (cacheKeyRef.current) localStorage.setItem(cacheKeyRef.current, "1");
      } catch {
        /* ignora */
      }
      setShow(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function decline() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!checkedServer || !show) return null;

  const doc = LEGAL_DOCS[tab];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)]">
        {/* Header + abas */}
        <div className="flex flex-col gap-3 border-b border-[var(--hairline)] p-6">
          <h2
            id="consent-title"
            className="font-sans text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]"
          >
            {t("title")}
          </h2>
          <p className="text-sm text-[var(--mute)]">
            {t("subtitle")}
          </p>
          <div className="flex flex-wrap gap-2">
            {LEGAL_DOCS.map((d, i) => (
              <button
                key={d.slug}
                type="button"
                onClick={() => setTab(i)}
                className={`rounded-[var(--radius)] px-3 py-1.5 text-[12px] font-medium tracking-[-0.01em] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] ${
                  tab === i
                    ? "border border-[var(--hairline-bright)] bg-[var(--surface-elevated)] text-[var(--ink)]"
                    : "border border-[var(--hairline-strong)] text-[var(--mute)] hover:text-[var(--ink)]"
                }`}
              >
                {d.title}
              </button>
            ))}
          </div>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-6">
          <LegalDocView doc={doc} compact />
        </div>

        {/* Rodapé: aceite */}
        <div className="flex flex-col gap-4 border-t border-[var(--hairline)] p-6">
          <label className="flex cursor-pointer gap-3">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--ink)]"
            />
            <span className="text-sm text-[var(--body)]">
              {t.rich("declaration", {
                strong: (chunks) => (
                  <strong className="font-semibold text-[var(--ink)]">{chunks}</strong>
                ),
              })}
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 font-mono text-[12px] tracking-[-0.01em] text-[var(--status-error)]"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={decline}
              disabled={submitting}
              iconLeft={<LogOut className="h-4 w-4" />}
            >
              {t("signOut")}
            </Button>
            <Button
              variant="primary"
              onClick={accept}
              disabled={!agree || submitting}
              iconLeft={<CheckCircle2 className="h-4 w-4" />}
            >
              {submitting ? t("submitting") : t("accept")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
