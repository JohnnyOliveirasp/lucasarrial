"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { EstadoEtapa } from "@/lib/sgp/etapas";
import type { SgpPrevia } from "@/lib/sgp/previa";
import { SGP_PILL_CLASS } from "./sgp-classes";

type Etapa = { chave: string; estado: EstadoEtapa };
type Estado = {
  etapas: Etapa[];
  pronto: boolean;
  erro: string | null;
  email?: string | null;
  previa?: SgpPrevia | null;
};

const INTERVALO_MS = 8000;
const PREVIA_VAZIA: SgpPrevia = { imagemUrl: null, audioUrl: null, audioSegundos: null };

/**
 * Tela 5 — o acompanhamento (estilo iFood), SEM login: é a continuação do
 * wizard, pela mesma sessão (Johnny 29/08: "ele não pode já estar logado na
 * plataforma; isso é decisão dele").
 * Fica se atualizando sozinha (8s) — foi o que faltou: a foto ficou pronta e
 * a tela seguiu congelada. A etapa em andamento tem animação pra não parecer
 * travada; quando tudo fica pronto, aparece o botão de entrar.
 *
 * E mostra a PRÉVIA (Johnny 29/08: *"ele já vai conseguir ver a imagem clone
 * dele gerado e o áudio gerado"*). É a única prova de valor que o aluno recebe
 * antes de decidir assinar — SGP não dá FastCloner, então esta tela é o motivo
 * de assinar. Antes ela dizia "pronto" e não mostrava nada.
 */
export function SgpAcompanhar({ inicial }: { inicial: Estado }) {
  const t = useTranslations("sgp.acompanhar");
  const [estado, setEstado] = useState<Estado>(inicial);
  const [previa, setPrevia] = useState<SgpPrevia>(inicial.previa ?? PREVIA_VAZIA);

  useEffect(() => {
    if (estado.pronto) return;
    let vivo = true;
    const id = setInterval(async () => {
      try {
        const r = await fetch("/api/v1/sgp/status", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { data?: Estado } & Estado;
        const novo = (j.data ?? j) as Estado;
        if (!vivo || !Array.isArray(novo.etapas)) return;
        setEstado(novo);
        // A URL vem assinada de novo a cada tick, e trocar o `src` faria o
        // browser rebaixar a imagem e REINICIAR o áudio no meio da escuta. Só
        // preenche o que ainda está vazio; o que já chegou fica como está.
        setPrevia((antes) => ({
          imagemUrl: antes.imagemUrl ?? novo.previa?.imagemUrl ?? null,
          audioUrl: antes.audioUrl ?? novo.previa?.audioUrl ?? null,
          audioSegundos: antes.audioSegundos ?? novo.previa?.audioSegundos ?? null,
        }));
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

      <Previa previa={previa} />

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

/**
 * O clone pronto, na própria tela: a foto gerada e a voz clonada falando.
 * Aparece assim que CADA parte fica pronta (a foto costuma sair minutos antes
 * da voz) — não espera o pedido inteiro fechar.
 *
 * A imagem é <img> cru de propósito: a URL é assinada e de host externo (R2),
 * então o otimizador do next/image não a serve sem entrar em `remotePatterns`.
 */
function Previa({ previa }: { previa: SgpPrevia }) {
  const t = useTranslations("sgp.acompanhar");
  if (!previa.imagemUrl && !previa.audioUrl) return null;

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-4">
      <p className="text-[14px] font-medium text-[var(--ink)]">{t("previa.titulo")}</p>

      {previa.imagemUrl ? (
        <figure className="flex flex-col gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previa.imagemUrl}
            alt={t("previa.fotoAlt")}
            className="w-full max-w-[260px] rounded-[var(--radius)] border border-[var(--hairline-strong)]"
          />
          <figcaption className="text-[12px] text-[var(--silver)]">{t("previa.foto")}</figcaption>
        </figure>
      ) : null}

      {previa.audioUrl ? (
        <div className="flex flex-col gap-1.5">
          <audio controls preload="none" src={previa.audioUrl} className="w-full max-w-[360px]">
            {t("previa.semPlayer")}
          </audio>
          <p className="text-[12px] text-[var(--silver)]">{t("previa.audio")}</p>
        </div>
      ) : null}
    </section>
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
