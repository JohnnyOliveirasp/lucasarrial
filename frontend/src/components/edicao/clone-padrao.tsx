"use client";

/**
 * E3 · caminho Clone → Padrão 2.0 (W3): o áudio vem PRONTO da estação de
 * Áudio (geração TTS ou take gravado) — aqui a pessoa só escolhe a FOTO e
 * gera. Reusa o fluxo da tela video-clone (ImagePicker, upload presign,
 * import pro acervo, POST + poll). Diferenças pro clone-studio:
 *  - generation → vai direto como generation_id (a API já resolve duração);
 *  - take → POST /video-clone/import-take copia voices→generations e devolve
 *    a audio_key + duração Whisper (a API do clone só aceita esse bucket).
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Film, Loader2, RefreshCw } from "lucide-react";
import { CLONE_MAX_AUDIO_SECONDS, cloneCreditsCost, getCloneTier } from "@/lib/video-clone/config";
import { ImageChoice, ImagePicker } from "@/components/video-clone/clone-pickers";
import { ensureUploadableImage, IMAGE_ACCEPT_WITH_HEIC } from "@/lib/images/heic";
import type { AudioSel, VideoSel } from "./edicao-wizard";

const TIER = getCloneTier("480p-v3")!; // Padrão 2.0 — único tier do wizard

/** Áudio resolvido pro POST /video-clone: id de geração OU key já no bucket certo. */
type AudioPronto =
  | { kind: "generation"; id: string; seconds: number }
  | { kind: "key"; audio_key: string; seconds: number };

async function presignAndPut(kind: "image" | "audio", file: File): Promise<string> {
  const res = await fetch("/api/v1/video-clone/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, filename: file.name, content_type: file.type, size: file.size }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message || "");
  const put = await fetch(j.upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!put.ok) throw new Error("");
  return j.key as string;
}

function readImageDims(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 0, height: 0 });
    };
    img.src = url;
  });
}

type Props = {
  audio: AudioSel;
  selecionado: VideoSel | null;
  escolher: (v: VideoSel | null) => void;
};

export function ClonePadrao({ audio, selecionado, escolher }: Props) {
  const t = useTranslations("edicao.video.padrao");
  const [pronto, setPronto] = useState<AudioPronto | null>(null);
  const [audioErro, setAudioErro] = useState<string | null>(null);
  const [image, setImage] = useState<ImageChoice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerRefresh, setPickerRefresh] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<{ id: string; status: string; video_url: string | null; error: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const imgInput = useRef<HTMLInputElement>(null);

  // 1) Resolve o áudio da E2 pro formato que o POST /video-clone aceita.
  useEffect(() => {
    let vivo = true;
    setPronto(null);
    setAudioErro(null);
    void (async () => {
      try {
        if (audio.kind === "generation") {
          const j = await fetch(`/api/v1/generations/${audio.id}`).then((r) => r.json());
          const g = j?.data?.generation ?? j?.generation;
          const s = Number(g?.duration_seconds ?? 0);
          if (!vivo) return;
          if (!(s > 0)) throw new Error();
          if (s > CLONE_MAX_AUDIO_SECONDS + 0.5) {
            setAudioErro(t("audioLongo", { s: Math.round(s), max: CLONE_MAX_AUDIO_SECONDS }));
            return;
          }
          setPronto({ kind: "generation", id: audio.id, seconds: s });
        } else {
          const res = await fetch("/api/v1/video-clone/import-take", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ take_key: audio.key }),
          });
          const j = await res.json().catch(() => ({}));
          if (!vivo) return;
          if (!res.ok) {
            setAudioErro(j?.error?.message ?? j?.message ?? t("erroAudio"));
            return;
          }
          const d = j?.data ?? j;
          setPronto({ kind: "key", audio_key: d.audio_key, seconds: Number(d.duration_seconds) });
        }
      } catch {
        if (vivo) setAudioErro(t("erroAudio"));
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.kind, audio.kind === "generation" ? audio.id : audio.key]);

  // 2) Retoma job em andamento (recarregou no meio) — igual ao clone-studio.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/video-clone", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        const running = ((j.clones ?? []) as { id: string; status: string }[]).find(
          (c) => c.status === "pending" || c.status === "generating",
        );
        if (running && !cancelled) {
          setJob((prev) => prev ?? { id: running.id, status: running.status, video_url: null, error: null });
        }
      } catch {
        /* segue no formulário */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 3) Poll do job (o GET sincroniza com o RunPod).
  const inflight = job?.status === "pending" || job?.status === "generating";
  useEffect(() => {
    if (!job || !inflight) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/video-clone/${job.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        const c = j.clone ?? {};
        setJob({ id: job.id, status: c.status, video_url: c.video_url ?? null, error: c.error_message ?? null });
        if (c.status === "ready") {
          escolher({
            kind: "clone-padrao",
            id: job.id,
            label: t("labelVideo", { s: Math.round(c.duration_seconds ?? pronto?.seconds ?? 0) }),
          });
        }
      } catch {
        /* próximo tick */
      }
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, inflight]);

  async function pickImageFile(file: File) {
    setErro(null);
    setUploading(true);
    try {
      file = await ensureUploadableImage(file); // iPhone .heic -> jpeg
      const key = await presignAndPut("image", file);
      const preview = URL.createObjectURL(file);
      const dims = await readImageDims(file);
      // Upload vira item do acervo "Minhas fotos" (mesma regra da tela clone).
      const imp = await fetch("/api/v1/images/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, width: dims.width, height: dims.height }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (imp?.image?.id) {
        setImage({ kind: "history", id: imp.image.id, preview: imp.image.image_url ?? preview });
        setPickerRefresh((k) => k + 1);
      } else {
        setImage({ kind: "upload", key, preview });
      }
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erroUpload"));
    } finally {
      setUploading(false);
    }
  }

  async function gerar() {
    if (!image || !pronto) return;
    setSubmitting(true);
    setErro(null);
    try {
      const payload: Record<string, string> = { tier: TIER.id };
      if (image.kind === "history") payload.image_generation_id = image.id;
      else payload.image_key = image.key;
      if (pronto.kind === "generation") payload.generation_id = pronto.id;
      else payload.audio_key = pronto.audio_key;

      const res = await fetch("/api/v1/video-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setErro(t("semCreditos"));
        return;
      }
      if (res.status === 409) {
        setErro(t("emAndamento"));
        return;
      }
      if (!res.ok) throw new Error(j?.error?.message || t("erroGerar"));
      escolher(null); // vídeo novo a caminho: o anterior deixa de valer
      setJob({ id: j.clone.id, status: "pending", video_url: null, error: null });
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : t("erroGerar"));
    } finally {
      setSubmitting(false);
    }
  }

  if (audioErro) {
    return <p className="rounded-[var(--radius-sm)] border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-300">{audioErro}</p>;
  }
  if (!pronto) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-[var(--mute)]">
        <Loader2 className="size-4 animate-spin" /> {t("carregandoAudio")}
      </p>
    );
  }

  const custo = cloneCreditsCost(TIER, pronto.seconds);

  // Job em voo ou terminado → mostra o progresso/resultado no lugar do form.
  if (job) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
        {inflight ? (
          <p className="flex items-center gap-2 text-[13.5px] text-[var(--ink)]">
            <Loader2 className="size-4 animate-spin" /> {t("gerando")}
          </p>
        ) : job.status === "ready" ? (
          <>
            <p className="flex items-center gap-2 text-[13.5px] font-medium text-emerald-300">
              <Film className="size-4" /> {t("pronto")}
            </p>
            {job.video_url && <video src={job.video_url} controls className="max-h-96 w-full rounded-[var(--radius-sm)]" />}
          </>
        ) : (
          <p className="text-[13px] text-red-400">{job.error || t("falhou")}</p>
        )}
        {!inflight && (
          <button
            type="button"
            onClick={() => {
              setJob(null);
              if (selecionado?.kind === "clone-padrao") escolher(null);
            }}
            className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3.5 py-2 text-[13px] text-[var(--ink)]"
          >
            <RefreshCw className="size-4" /> {t("refazer")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-[12.5px] text-[var(--mute)]">
        {t("audioPronto", { label: audio.label, s: Math.round(pronto.seconds), custo })}
      </p>
      <p className="text-[13px] font-medium text-[var(--ink)]">{t("foto")}</p>
      <ImagePicker
        selected={image}
        onSelect={setImage}
        onUploadClick={() => imgInput.current?.click()}
        uploading={uploading}
        refreshKey={pickerRefresh}
      />
      <input
        ref={imgInput}
        type="file"
        accept={IMAGE_ACCEPT_WITH_HEIC}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pickImageFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => void gerar()}
        disabled={submitting || !image}
        className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Film className="size-4" />}
        {t("gerar", { custo })}
      </button>
      {erro && <p className="text-[13px] text-red-400">{erro}</p>}
    </div>
  );
}
