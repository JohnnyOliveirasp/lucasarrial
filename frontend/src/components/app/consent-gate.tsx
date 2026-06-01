"use client";

/**
 * Popup bloqueante de aceite de termos, exibido após o login.
 * - Checa via /api/v1/consent se o usuário já aceitou a versão vigente.
 * - Não é dismissível: só "Aceitar e continuar" (POST) ou "Sair" (signOut).
 * - Fast path por localStorage (por versão) pra não piscar a cada navegação.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LEGAL_DOCS, CONSENT_VERSION } from "@/lib/legal";
import { LegalDocView } from "@/components/legal/legal-doc-view";

const CACHE_KEY = `aiverse-consent-${CONSENT_VERSION}`;

export function ConsentGate() {
  const router = useRouter();
  const [checkedServer, setCheckedServer] = useState(false);
  const [show, setShow] = useState(false);
  const [tab, setTab] = useState(0);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (localStorage.getItem(CACHE_KEY) === "1") return;
        const res = await fetch("/api/v1/consent", { cache: "no-store" });
        if (!active || !res.ok) return;
        const json = await res.json();
        if (json.accepted) {
          try {
            localStorage.setItem(CACHE_KEY, "1");
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
        throw new Error(j?.error?.message || "Falha ao registrar o aceite");
      }
      try {
        localStorage.setItem(CACHE_KEY, "1");
      } catch {
        /* ignora */
      }
      setShow(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col border border-accent bg-bg">
        {/* Header + abas */}
        <div className="flex flex-col gap-3 border-b border-border p-5">
          <h2
            id="consent-title"
            className="font-display text-2xl uppercase tracking-tight text-fg"
          >
            Antes de continuar
          </h2>
          <p className="text-sm text-muted-fg">
            Leia e aceite nossos termos para usar a plataforma.
          </p>
          <div className="flex flex-wrap gap-2">
            {LEGAL_DOCS.map((d, i) => (
              <button
                key={d.slug}
                type="button"
                onClick={() => setTab(i)}
                className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                  tab === i
                    ? "bg-accent text-accent-fg"
                    : "border border-border text-muted-fg hover:text-fg"
                }`}
              >
                {d.title}
              </button>
            ))}
          </div>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto p-5">
          <LegalDocView doc={doc} compact />
        </div>

        {/* Rodapé: aceite */}
        <div className="flex flex-col gap-3 border-t border-border p-5">
          <label className="flex cursor-pointer gap-3">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-1 accent-[var(--color-accent,#ff5500)]"
            />
            <span className="text-sm text-fg">
              Declaro que li e concordo com os{" "}
              <strong className="font-semibold">Termos de Uso</strong>, a{" "}
              <strong className="font-semibold">Política de Privacidade</strong> e a{" "}
              <strong className="font-semibold">Política de Uso</strong>.
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={decline}
              disabled={submitting}
              className="flex items-center gap-2 border border-border px-5 py-3 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:bg-surface disabled:opacity-40"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
            <button
              type="button"
              onClick={accept}
              disabled={!agree || submitting}
              className="flex items-center gap-2 bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitting ? "Registrando…" : "Aceitar e continuar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
