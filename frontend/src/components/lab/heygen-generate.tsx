"use client";

/**
 * Gerar vídeo Avatar IV (BYOK): foto (gerada na plataforma OU upload) + áudio
 * da voz clonada → HeyGen → vídeo no player. ⚠️ Consome créditos de API da
 * CONTA HEYGEN do aluno (~US$4 por minuto de vídeo 1080p) — o botão avisa.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type PlatformImage = { id: string; name: string | null; url: string | null; status: string };
type AudioGen = { id: string; name: string | null; text_raw: string; duration_seconds: number | null; status: string };
type HgVideo = { id: string; status: string; title: string | null; error_message: string | null; video_url?: string | null; created_at: string };

export function HeygenGenerate() {
  const [images, setImages] = useState<PlatformImage[]>([]);
  const [audios, setAudios] = useState<AudioGen[]>([]);
  const [videos, setVideos] = useState<HgVideo[]>([]);
  const [imageMode, setImageMode] = useState<"platform_image" | "upload">("platform_image");
  const [imageId, setImageId] = useState<string | null>(null);
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void (async () => {
      const [imgs, gens, vids] = await Promise.all([
        fetch("/api/v1/images").then((r) => r.json()).catch(() => null),
        fetch("/api/v1/generations").then((r) => r.json()).catch(() => null),
        fetch("/api/v1/heygen/videos").then((r) => r.json()).catch(() => null),
      ]);
      const imgItems = (imgs?.data?.items ?? imgs?.items ?? []) as (PlatformImage & { url?: string })[];
      setImages(imgItems.filter((i) => i.status === "ready" && i.url));
      const genItems = (gens?.data?.generations ?? gens?.generations ?? gens?.data?.items ?? []) as AudioGen[];
      setAudios(genItems.filter((g) => g.status === "ready"));
      setVideos((vids?.data?.videos ?? vids?.videos ?? []) as HgVideo[]);
    })();
  }, []);

  const refreshVideo = useCallback(async (id: string) => {
    const res = await fetch(`/api/v1/heygen/videos/${id}`);
    const json = await res.json();
    const v = (json?.data ?? json) as HgVideo;
    setVideos((prev) => prev.map((p) => (p.id === id ? { ...p, ...v } : p)));
    return v;
  }, []);

  // poll dos processing a cada 20s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const pending = videos.filter((v) => v.status === "processing").map((v) => v.id);
    if (pending.length === 0) return;
    pollRef.current = setInterval(() => {
      for (const id of pending) void refreshVideo(id);
    }, 20_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [videos, refreshVideo]);

  function onFile(file: File | null) {
    if (!file) return setUploadDataUrl(null);
    const reader = new FileReader();
    reader.onload = () => setUploadDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  const canGenerate =
    Boolean(audioId) &&
    (imageMode === "platform_image" ? Boolean(imageId) : Boolean(uploadDataUrl));

  async function generate() {
    const audio = audios.find((a) => a.id === audioId);
    const mins = audio?.duration_seconds ? Math.max(1, Math.ceil(audio.duration_seconds / 60)) : 1;
    const ok = window.confirm(
      `Gerar este vídeo vai consumir créditos de API da SUA conta HeyGen ` +
        `(Avatar IV custa ~US$4 por minuto de vídeo — este áudio ≈ ${mins} min). Continuar?`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/heygen/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image:
            imageMode === "platform_image"
              ? { kind: "platform_image", image_generation_id: imageId }
              : { kind: "upload", data_url: uploadDataUrl },
          audio_generation_id: audioId,
          title: title.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? json?.message ?? "Não foi possível gerar");
        return;
      }
      const id = (json?.data?.id ?? json?.id) as string;
      setVideos((prev) => [
        { id, status: "processing", title: title.trim() || null, error_message: null, created_at: new Date().toISOString() },
        ...prev,
      ]);
      setTitle("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 border-t border-[var(--hairline)] pt-5">
      <div>
        <h2 className="font-sans text-[16px] font-semibold text-[var(--ink)]">Gerar vídeo Avatar IV</h2>
        <p className="mt-0.5 text-[13px] text-[var(--mute)]">
          Escolha a foto e um áudio da sua voz clonada. O vídeo sai em 1080p, em poucos minutos.
        </p>
      </div>

      {/* Foto */}
      <div>
        <div className="flex gap-2 text-[13px]">
          {(["platform_image", "upload"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setImageMode(m)}
              className={[
                "rounded-full border px-3 py-1",
                imageMode === m
                  ? "border-[var(--ink)] text-[var(--ink)]"
                  : "border-[var(--hairline)] text-[var(--mute)]",
              ].join(" ")}
            >
              {m === "platform_image" ? "Minhas imagens da plataforma" : "Enviar foto"}
            </button>
          ))}
        </div>
        {imageMode === "platform_image" ? (
          images.length === 0 ? (
            <p className="mt-2 text-[13px] text-[var(--mute)]">
              Você ainda não tem imagens prontas no Gerador de Imagens.
            </p>
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {images.slice(0, 18).map((img) => (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => setImageId(img.id)}
                    className={[
                      "block w-full overflow-hidden rounded-[var(--radius-sm)] border-2",
                      imageId === img.id ? "border-[var(--ink)]" : "border-transparent",
                    ].join(" ")}
                    title={img.name ?? undefined}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 */}
                    <img src={img.url ?? ""} alt={img.name ?? "imagem"} className="aspect-square w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="mt-3">
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className="text-[13px] text-[var(--mute)]"
            />
            {uploadDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local
              <img src={uploadDataUrl} alt="prévia" className="mt-2 max-h-40 rounded-[var(--radius-sm)]" />
            )}
          </div>
        )}
      </div>

      {/* Áudio + título + gerar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={audioId ?? ""}
          onChange={(e) => setAudioId(e.target.value || null)}
          className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)]"
        >
          <option value="">Escolha um áudio da sua voz…</option>
          {audios.slice(0, 40).map((a) => (
            <option key={a.id} value={a.id}>
              {(a.name || a.text_raw.slice(0, 60)) +
                (a.duration_seconds ? ` · ${Math.round(a.duration_seconds)}s` : "")}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (opcional)"
          className="w-44 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ash)]"
        />
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy || !canGenerate}
          className="rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
        >
          {busy ? "Enviando…" : "Gerar vídeo"}
        </button>
      </div>
      <p className="text-[12px] text-[var(--ash)]">
        ⚠️ A geração consome créditos de API da <strong>sua conta HeyGen</strong> (~US$4/min de
        vídeo), não os créditos FastCloner.
      </p>
      {error && <p className="text-[13px] text-[var(--danger,#e5484d)]">{error}</p>}

      {/* Vídeos */}
      {videos.length > 0 && (
        <div>
          <h3 className="text-[14px] font-semibold text-[var(--ink)]">Seus vídeos HeyGen</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {videos.map((v) => (
              <li
                key={v.id}
                className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-3"
              >
                <div className="flex items-center gap-2 text-[13px]">
                  <span
                    className={[
                      "size-2 rounded-full",
                      v.status === "ready"
                        ? "bg-emerald-500"
                        : v.status === "failed"
                          ? "bg-red-500"
                          : "animate-pulse bg-amber-400",
                    ].join(" ")}
                    aria-hidden
                  />
                  <span className="font-medium text-[var(--ink)]">{v.title || "Vídeo HeyGen"}</span>
                  <span className="text-[var(--mute)]">
                    {v.status === "processing"
                      ? "gerando… (alguns minutos)"
                      : v.status === "failed"
                        ? v.error_message || "falhou"
                        : ""}
                  </span>
                  {v.status === "processing" && (
                    <button
                      type="button"
                      onClick={() => void refreshVideo(v.id)}
                      className="ml-auto text-[12px] text-[var(--mute)] underline underline-offset-2"
                    >
                      atualizar
                    </button>
                  )}
                </div>
                {v.status === "ready" && v.video_url && (
                  <video src={v.video_url} controls className="mt-2 max-h-96 w-full rounded-[var(--radius-sm)]" />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
