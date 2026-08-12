"use client";

/**
 * 🚧 Vídeo Edição 2.0 — E5 Saída (W6 da spec 11/08).
 * BAIXAR é o caminho principal e está SEMPRE presente. Publicar/agendar é
 * OPCIONAL: o <PublishButton> se esconde sozinho pra quem o Publicador não
 * está liberado (gate socialPublisherEnabled — hoje admin-only; decisão do
 * Johnny 12/08: enquanto o app é por convite e sem login social, nada aqui
 * pode ser obrigatório).
 * Mídia final: preferimos o vídeo EDITADO do W5 (draft.videoEditadoKey);
 * sem edição, o vídeo base da E3 (clone Padrão/HeyGen ou cenas do Estúdio).
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, Check, Download, Loader2, RotateCcw, X } from "lucide-react";
import { downloadFromUrl } from "@/components/image/download-file";
import { PublishButton, type PublishButtonSource } from "@/components/social/publish-button";
import { DRAFT_VAZIO, type EdicaoDraft } from "./edicao-wizard";

type Props = {
  draft: EdicaoDraft;
  onChange: (patch: Partial<EdicaoDraft>) => void;
};

type Agendada = { id: string; scheduled_at: string; caption: string | null };

export function PassoSaida({ draft, onChange }: Props) {
  const t = useTranslations("edicao.saida");
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [tick, setTick] = useState(0);
  const [baixando, setBaixando] = useState(false);

  const video = draft.video;
  const editadoKey = draft.videoEditadoKey;

  // Resolve a URL presignada da mídia final (editada > base) pelos GETs que
  // já existem — o wizard não reinventa fonte de vídeo.
  useEffect(() => {
    if (!video) return;
    let alive = true;
    setUrl(null);
    setErro(false);
    const load = async () => {
      try {
        let resolved: string | null = null;
        if (editadoKey) {
          const res = await fetch(`/api/v1/edicao/video-url?key=${encodeURIComponent(editadoKey)}`);
          const d = (await res.json())?.data ?? {};
          resolved = d.video_url ?? null;
        } else if (video.kind === "clone-padrao") {
          const res = await fetch(`/api/v1/video-clone/${video.id}`, { cache: "no-store" });
          const d = (await res.json())?.data ?? {};
          resolved = d.clone?.video_url ?? null;
        } else if (video.kind === "clone-heygen") {
          const res = await fetch(`/api/v1/heygen/videos/${video.id}`, { cache: "no-store" });
          const d = (await res.json())?.data ?? {};
          resolved = d.video_url ?? null;
        } else {
          const res = await fetch(`/api/v1/studio/${video.id}`, { cache: "no-store" });
          const d = (await res.json())?.data ?? {};
          resolved = d.project?.edited_video_url ?? d.project?.video_url ?? null;
        }
        if (!alive) return;
        if (resolved) setUrl(resolved);
        else setErro(true);
      } catch {
        if (alive) setErro(true);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [video, editadoKey, tick]);

  if (!video) {
    return (
      <p className="rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-[13px] text-[var(--mute)]">
        {t("semVideo")}
      </p>
    );
  }

  const publishSource: PublishButtonSource = editadoKey
    ? { kind: "edicao", key: editadoKey }
    : { kind: video.kind, id: video.id };

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-[14px] font-medium text-[var(--ink)]">
        <Check className="size-4 text-emerald-400" />
        {editadoKey ? t("prontoEditado") : t("pronto")}
      </p>

      {erro ? (
        <div className="flex flex-col items-start gap-2 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
          <p className="text-[13px] text-[var(--mute)]">{t("erro")}</p>
          <button
            type="button"
            onClick={() => setTick((n) => n + 1)}
            className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 py-1.5 text-[12.5px] text-[var(--ink)]"
          >
            {t("tentarDeNovo")}
          </button>
        </div>
      ) : !url ? (
        <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4 text-[13px] text-[var(--mute)]">
          <Loader2 className="size-4 animate-spin" /> {t("carregando")}
        </p>
      ) : (
        <>
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[420px] w-auto self-start rounded-[var(--radius)] border border-[var(--hairline)]"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBaixando(true);
                void downloadFromUrl(url, video.label || "video-final", "mp4").finally(() =>
                  setBaixando(false),
                );
              }}
              disabled={baixando}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
            >
              {baixando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {t("baixar")}
            </button>
            {/* Opcional por desenho: só aparece com o Publicador liberado. */}
            <PublishButton source={publishSource} context={draft.roteiro} previewVideoUrl={url} />
          </div>
        </>
      )}

      <Agendadas />

      <div className="border-t border-[var(--hairline)] pt-3">
        <button
          type="button"
          onClick={() => onChange({ ...DRAFT_VAZIO })}
          className="flex items-center gap-1.5 text-[12.5px] text-[var(--mute)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
        >
          <RotateCcw className="size-3.5" /> {t("novo")}
        </button>
      </div>
    </div>
  );
}

/** Publicações agendadas do usuário (qualquer origem) com cancelamento —
 *  só aparece se existir alguma; pra quem não tem o Publicador, fica vazio. */
function Agendadas() {
  const t = useTranslations("edicao.saida");
  const [lista, setLista] = useState<Agendada[]>([]);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const carregar = async () => {
    try {
      const res = await fetch("/api/v1/social/publish", { cache: "no-store" });
      if (!res.ok) return;
      const d = (await res.json())?.data ?? {};
      const rows = (d.publications ?? []) as Array<
        Agendada & { status: string; scheduled_at: string | null }
      >;
      setLista(
        rows
          .filter((p) => p.status === "ready" && p.scheduled_at)
          .map((p) => ({ id: p.id, scheduled_at: p.scheduled_at as string, caption: p.caption })),
      );
    } catch {
      /* silencioso: seção é opcional */
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const cancelar = async (id: string) => {
    setCancelando(id);
    try {
      await fetch(`/api/v1/social/publish?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await carregar();
    } finally {
      setCancelando(null);
    }
  };

  if (lista.length === 0) return null;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]">
        <CalendarClock className="size-4" /> {t("agendadas")}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {lista.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="text-[var(--mute)]">
              {new Date(p.scheduled_at).toLocaleString()}
              {p.caption ? ` — ${p.caption.slice(0, 60)}${p.caption.length > 60 ? "…" : ""}` : ""}
            </span>
            <button
              type="button"
              onClick={() => void cancelar(p.id)}
              disabled={cancelando === p.id}
              className="flex items-center gap-1 text-[12px] text-[var(--ash)] hover:text-[var(--danger,#e5484d)] disabled:opacity-40"
            >
              {cancelando === p.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              {t("cancelar")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
