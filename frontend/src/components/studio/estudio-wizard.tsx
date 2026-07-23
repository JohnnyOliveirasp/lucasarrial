"use client";

/**
 * Estúdio de Vídeo — F0: entrada única com o wizard de 2 perguntas
 * (plano aprovado pelo Lucas, _Bugs/PLANO_UNIFICACAO_VIDEO.md + PDF 22/07).
 *
 * SÓ reorganiza a casa: cada combinação roteia pro fluxo que JÁ existe.
 * Nenhum motor novo aqui. 🚧 Admin-only até o Lucas validar (gate na page).
 *
 *   origem ✍️ texto  → /app/videos/studio  (workspace: roteiro→voz→cenas/rosto)
 *   origem 🎙️ áudio + 🎬 cenas → /app/videos/new    (Vídeo História de hoje)
 *   origem 🎙️ áudio + 👤 eu    → /app/videos/clone  (avatar clone lip-sync)
 *   origem 🎙️ áudio + 🔀 mix   → /app/videos/studio (workspace aceita áudio)
 *   origem 🎥 vídeo  → F2 (card visível, desabilitado com "em breve")
 *   origem 🛍️ produto → standby TikTok Shop (OCULTO — decisão da reunião)
 */
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  PenLine,
  Mic,
  Video,
  User,
  Clapperboard,
  Shuffle,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

type Origem = "texto" | "audio" | "video" | "produto";
type Formato = "eu" | "cenas" | "mix";

// Reserva do TikTok Shop (🛍️ produto): a arquitetura guarda o lugar, a
// interface não mostra (decisão da reunião 21/07). Ligar = true.
const SHOW_PRODUTO = false;

function destino(origem: Origem, formato: Formato): string {
  if (origem === "produto") return "/app/videos/vendas/new";
  if (origem === "texto") return "/app/videos/studio";
  // F2: gravação crua -> CapCut automático (eu+cenas intercalado vem depois,
  // por ora tudo cai na edição da gravação)
  if (origem === "video") return "/app/videos/estudio/gravacao";
  // áudio:
  if (formato === "cenas") return "/app/videos/new";
  if (formato === "eu") return "/app/videos/clone";
  return "/app/videos/studio";
}

export function EstudioWizard() {
  const t = useTranslations("studio.unified");
  const router = useRouter();
  const [origem, setOrigem] = useState<Origem | null>(null);
  const [formato, setFormato] = useState<Formato | null>(null);

  const origens: Array<{
    id: Origem;
    icon: typeof PenLine;
    disabled?: boolean;
  }> = [
    { id: "texto", icon: PenLine },
    { id: "audio", icon: Mic },
    { id: "video", icon: Video }, // F2 no ar: CapCut automático
    ...(SHOW_PRODUTO
      ? [{ id: "produto" as const, icon: ShoppingBag }]
      : []),
  ];

  const formatos: Array<{ id: Formato; icon: typeof User }> = [
    { id: "eu", icon: User },
    { id: "cenas", icon: Clapperboard },
    { id: "mix", icon: Shuffle },
  ];

  function start() {
    if (!origem || !formato) return;
    // Query params pros destinos se pré-configurarem nas próximas fases.
    router.push(`${destino(origem, formato)}?origem=${origem}&formato=${formato}`);
  }

  // ── Pergunta 1: origem ──────────────────────────────────────────────────
  if (!origem) {
    return (
      <section className="flex flex-col gap-5">
        <StepHeading n={1} title={t("q1.title")} hint={t("q1.hint")} />
        <div className="grid gap-3 sm:grid-cols-3">
          {origens.map(({ id, icon: Icon, disabled }) => (
            <OptionCard
              key={id}
              icon={Icon}
              title={t(`q1.${id}.title`)}
              body={t(`q1.${id}.body`)}
              badge={disabled ? t("soon") : undefined}
              disabled={disabled}
              onClick={() => setOrigem(id)}
            />
          ))}
        </div>
      </section>
    );
  }

  // ── Pergunta 2: formato ─────────────────────────────────────────────────
  return (
    <section className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => {
          setFormato(null);
          setOrigem(null);
        }}
        className="inline-flex w-fit items-center gap-1.5 font-mono text-[11px] tracking-wide text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("back", { origem: t(`q1.${origem}.title`) })}
      </button>

      <StepHeading n={2} title={t("q2.title")} hint={t("q2.hint")} />
      <div className="grid gap-3 sm:grid-cols-3">
        {formatos.map(({ id, icon: Icon }) => (
          <OptionCard
            key={id}
            icon={Icon}
            title={t(`q2.${id}.title`)}
            // "EU" se adapta à origem: texto/áudio → avatar clone;
            // vídeo (F2) → a própria gravação editada.
            body={t(`q2.${id}.body.${origem}`)}
            selected={formato === id}
            onClick={() => setFormato(id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={start}
        disabled={!formato}
        className="inline-flex h-11 w-fit items-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-6 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:pointer-events-none disabled:opacity-[0.42]"
      >
        {t("start")}
        <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function StepHeading({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[11px] tracking-[0.08em] text-[var(--ash)]">
        {n}/2
      </span>
      <h2 className="font-sans text-[22px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
        {title}
      </h2>
      <p className="text-sm text-[var(--mute)]">{hint}</p>
    </div>
  );
}

function OptionCard({
  icon: Icon,
  title,
  body,
  badge,
  disabled,
  selected,
  onClick,
}: {
  icon: typeof PenLine;
  title: string;
  body: string;
  badge?: string;
  disabled?: boolean;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border p-5 text-left transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)]",
        selected
          ? "border-[var(--hairline-bright)] bg-[var(--surface-raised)]"
          : "border-[var(--hairline-strong)] bg-[var(--surface-card)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-elevated)]",
        disabled ? "cursor-not-allowed opacity-50 hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-card)]" : "",
      ].join(" ")}
    >
      <span className="inline-flex size-9 items-center justify-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)]">
        <Icon className="h-4 w-4 text-[var(--silver)]" />
      </span>
      <span className="flex items-center gap-2">
        <span className="font-sans text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {title}
        </span>
        {badge && (
          <span className="rounded-[var(--radius-full)] border border-[var(--hairline-strong)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--ash)]">
            {badge}
          </span>
        )}
      </span>
      <span className="text-[13px] leading-snug text-[var(--mute)]">{body}</span>
    </button>
  );
}
