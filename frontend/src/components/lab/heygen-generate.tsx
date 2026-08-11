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
type Look = { id: string; name: string; image_url: string | null };

type Props = {
  /** Look clicado na galeria de avatares HeyGen (feedback Lucas 11/08) */
  selectedLook?: Look | null;
  onClearLook?: () => void;
  /** Criou um clone novo no HeyGen → o pai recarrega a galeria */
  onGroupsChanged?: () => void;
};

export function HeygenGenerate({ selectedLook, onClearLook, onGroupsChanged }: Props) {
  const [images, setImages] = useState<PlatformImage[]>([]);
  const [audios, setAudios] = useState<AudioGen[]>([]);
  const [videos, setVideos] = useState<HgVideo[]>([]);
  const [imageMode, setImageMode] = useState<"platform_image" | "upload" | "heygen_look">("platform_image");
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
      // GET /api/v1/images → jsonOk({ images: [{ id, name, status, image_url, ... }] })
      const imgItems = (imgs?.data?.images ?? imgs?.images ?? []) as {
        id: string;
        name: string | null;
        status: string;
        image_url: string | null;
      }[];
      setImages(
        imgItems
          .filter((i) => i.status === "ready" && i.image_url)
          .map((i) => ({ id: i.id, name: i.name, status: i.status, url: i.image_url })),
      );
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

  const [cloneBusy, setCloneBusy] = useState<string | null>(null);
  const [cloneMsg, setCloneMsg] = useState<string | null>(null);

  // Clicou num look da galeria acima → a foto do vídeo passa a ser ele
  useEffect(() => {
    if (selectedLook) setImageMode("heygen_look");
  }, [selectedLook]);

  // Cria um foto-avatar (clone) na conta HeyGen do aluno a partir de uma
  // imagem da plataforma (pedido Lucas 11/08).
  async function createClone(imageGenerationId: string, name: string | null) {
    setCloneBusy(imageGenerationId);
    setCloneMsg(null);
    try {
      const res = await fetch("/api/v1/heygen/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_generation_id: imageGenerationId, name: name ?? undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCloneMsg(json?.error?.message ?? json?.message ?? "Não foi possível criar o clone");
        return;
      }
      setCloneMsg("Clone criado na sua conta HeyGen — já aparece na galeria acima.");
      onGroupsChanged?.();
    } finally {
      setCloneBusy(null);
    }
  }

  function onFile(file: File | null) {
    if (!file) return setUploadDataUrl(null);
    const reader = new FileReader();
    reader.onload = () => setUploadDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  const canGenerate =
    Boolean(audioId) &&
    (imageMode === "platform_image"
      ? Boolean(imageId)
      : imageMode === "heygen_look"
        ? Boolean(selectedLook?.image_url)
        : Boolean(uploadDataUrl));

  async function generate() {
    const ok = window.confirm(
      "Gerar este vídeo vai consumir créditos de API da SUA conta HeyGen. Continuar?",
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const imagePayload =
        imageMode === "platform_image"
          ? { kind: "platform_image", image_generation_id: imageId }
          : imageMode === "heygen_look"
            ? { kind: "heygen_look", look_url: selectedLook?.image_url }
            : { kind: "upload", data_url: uploadDataUrl };
      const res = await fetch("/api/v1/heygen/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imagePayload,
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
        <div className="flex flex-wrap gap-2 text-[13px]">
          {(["platform_image", "heygen_look", "upload"] as const).map((m) => (
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
              {m === "platform_image"
                ? "Minhas imagens da plataforma"
                : m === "heygen_look"
                  ? "Avatar do HeyGen"
                  : "Enviar foto"}
            </button>
          ))}
        </div>
        {imageMode === "heygen_look" ? (
          selectedLook?.image_url ? (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview externo do HeyGen */}
              <img src={selectedLook.image_url} alt={selectedLook.name} className="size-20 rounded-[var(--radius-sm)] border border-[var(--ink)] object-cover" />
              <div className="text-[13px]">
                <p className="font-medium text-[var(--ink)]">{selectedLook.name}</p>
                <button
                  type="button"
                  onClick={() => onClearLook?.()}
                  className="text-[12px] text-[var(--mute)] underline underline-offset-2 hover:text-[var(--ink)]"
                >
                  trocar
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-[var(--mute)]">
              Clique numa foto na galeria de avatares acima pra escolher.
            </p>
          )
        ) : imageMode === "platform_image" ? (
          images.length === 0 ? (
            <p className="mt-2 text-[13px] text-[var(--mute)]">
              Você ainda não tem imagens prontas no Gerador de Imagens.
            </p>
          ) : (
            <>
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
              {imageId && (
                <button
                  type="button"
                  disabled={cloneBusy !== null}
                  onClick={() => {
                    const img = images.find((i) => i.id === imageId);
                    const nome = window.prompt(
                      "Nome do avatar que será criado na sua conta HeyGen:",
                      img?.name ?? "Meu avatar FastCloner",
                    );
                    if (nome !== null) void createClone(imageId, nome);
                  }}
                  className="mt-2 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 py-1.5 text-[12.5px] text-[var(--ink)] hover:bg-[var(--surface-raised)] disabled:opacity-40"
                >
                  {cloneBusy ? "Criando clone…" : "Criar clone no HeyGen com esta imagem"}
                </button>
              )}
              {cloneMsg && <p className="mt-1 text-[12.5px] text-[var(--mute)]">{cloneMsg}</p>}
            </>
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
        ⚠️ A geração consome créditos de API da <strong>sua conta HeyGen</strong>, não os
        créditos FastCloner. O valor por vídeo é definido pelo HeyGen conforme o seu plano.
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
