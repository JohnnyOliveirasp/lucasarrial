"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { EstadoEtapa } from "@/lib/sgp/etapas";
import { SGP_PILL_CLASS } from "./sgp-classes";

type Etapa = { chave: string; estado: EstadoEtapa };
type Estado = { etapas: Etapa[]; pronto: boolean; erro: string | null; email?: string | null };

const INTERVALO_MS = 8000;

/**
 * Tela 5 — o acompanhamento (estilo iFood), SEM login: é a continuação do
 * wizard, pela mesma sessão (Johnny 29/08: "ele não pode já estar logado na
 * plataforma; isso é decisão dele").
 * Fica se atualizando sozinha (8s) — foi o que faltou: a foto ficou pronta e
 * a tela seguiu congelada. A etapa em andamento tem animação pra não parecer
 * travada; quando tudo fica pronto, aparece o botão de entrar.
 */
export function SgpAcompanhar({ inicial }: { inicial: Estado }) {
  const t = useTranslations("sgp.acompanhar");
  const [estado, setEstado] = useState<Estado>(inicial);

  useEffect(() => {
    if (estado.pronto) return;
    let vivo = true;
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/v1/sgp/status", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { data?: Estado } & Estado;
        const novo = (j.data ?? j) as Estado;
        if (vivo && Array.isArray(novo.etapas)) setEstado(novo);
      } catch {
        /* rede caiu; tenta de novo no próximo tick */
      }
    }, INTERVALO_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [estado.pronto]);

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-3">
        {estado.etapas.map((e, i) => (
          <li
            key={e.chave}
            className={[
              "flex items-start gap-3 rounded-[var(--radius)] border px-4 py-3.5 transition-colors",
              e.estado === "andamento"
                ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)]"
                : "border-[var(--hairline-strong)] bg-[var(--surface-card)]",
            ].join(" ")}
          >
            <Selo estado={e.estado} numero={i + 1} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-[14px] font-medium text-[var(--ink)]">{t(`etapas.${e.chave}.titulo`)}</p>
              <p className="text-[12px] text-[var(--silver)]">{t(`etapas.${e.chave}.${e.estado}`)}</p>
              {e.estado === "andamento" ? <Barra /> : null}
            </div>
          </li>
        ))}
      </ol>

      {estado.erro ? (
        <p className="rounded-[var(--radius)] border border-[var(--status-error)] px-3.5 py-2.5 text-[13px] text-[var(--status-error)]">
          {t("erroTime")}
        </p>
      ) : null}

      {estado.pronto ? (
        <div className="flex flex-col gap-3">
          <p className="text-[14px] text-[var(--ink)]">{t("prontoTexto")}</p>
          <Link href="/login" className={SGP_PILL_CLASS}>{t("entrar")}</Link>
        </div>
      ) : (
        <p className="text-[13px] leading-[1.5] text-[var(--mute)]">{t("podeFechar")}</p>
      )}
    </div>
  );
}

function Selo({ estado, numero }: { estado: EstadoEtapa; numero: number }) {
  if (estado === "feito") {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[12px] font-semibold text-emerald-400">
        ✓
      </span>
    );
  }
  if (estado === "falhou") {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-[12px] font-semibold text-red-400">
        !
      </span>
    );
  }
  if (estado === "andamento") {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--hairline-bright)]">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--ash)] border-t-[var(--ink)]" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--hairline-strong)] text-[12px] text-[var(--ash)]">
      {numero}
    </span>
  );
}

/** Barra indeterminada: mostra que a coisa anda mesmo sem porcentagem real. */
function Barra() {
  return (
    <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-[var(--surface-deep)]">
      <span className="block h-full w-1/3 animate-[sgp-desliza_1.6s_ease-in-out_infinite] rounded-full bg-[var(--hairline-bright)]" />
    </span>
  );
}
