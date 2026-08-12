"use client";

/**
 * Gerar vídeo Avatar IV (BYOK): foto (plataforma, look HeyGen ou upload) +
 * áudio (histórico da voz clonada OU gravação na hora) → HeyGen → player.
 * ⚠️ Consome créditos de API da CONTA HEYGEN do aluno — o botão avisa.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { HeygenAudioPicker, type AudioGen, type HeygenAudioSel } from "./heygen-audio-picker";
import { HeygenImagePicker, type HeygenImageSel, type Look, type PlatformImage } from "./heygen-image-picker";

type HgVideo = { id: string; status: string; title: string | null; error_message: string | null; video_url?: string | null; created_at: string };

type Props = {
  /** Look clicado na galeria de avatares HeyGen (feedback Lucas 11/08) */
  selectedLook?: Look | null;
  onClearLook?: () => void;
  /** Criou um clone novo no HeyGen → o pai recarrega a galeria */
  onGroupsChanged?: () => void;
  /** Wizard Vídeo Edição (W3): áudio vem travado da estação anterior —
   *  o picker some e todo vídeo usa esta fonte. */
  presetAudio?: HeygenAudioSel;
  presetAudioLabel?: string;
  /** Um vídeo SUBMETIDO NESTA TELA ficou pronto (o wizard guarda no draft). */
  onVideoReady?: (v: { id: string; video_url: string | null }) => void;
};

export function HeygenGenerate({
  selectedLook, onClearLook, onGroupsChanged, presetAudio, presetAudioLabel, onVideoReady,
}: Props) {
  const [images, setImages] = useState<PlatformImage[]>([]);
  const [audios, setAudios] = useState<AudioGen[]>([]);
  const [videos, setVideos] = useState<HgVideo[]>([]);
  const [imageMode, setImageMode] = useState<"platform_image" | "upload" | "heygen_look">("platform_image");
  const [imageSel, setImageSel] = useState<HeygenImageSel | null>(null);
  const [audioSelLivre, setAudioSelLivre] = useState<HeygenAudioSel | null>(null);
  const audioSel = presetAudio ?? audioSelLivre;
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Só vídeos submetidos AQUI disparam onVideoReady (a lista mostra os antigos).
  const submittedRef = useRef<Set<string>>(new Set());
  const onReadyRef = useRef(onVideoReady);
  onReadyRef.current = onVideoReady;

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
    if (v.status === "ready" && submittedRef.current.has(id)) {
      submittedRef.current.delete(id); // dispara 1x por vídeo
      onReadyRef.current?.({ id, video_url: v.video_url ?? null });
    }
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

  // Clicou num look da galeria acima → a foto do vídeo passa a ser ele
  useEffect(() => {
    if (selectedLook) setImageMode("heygen_look");
  }, [selectedLook]);

  // O modo "heygen_look" seleciona pelo clique na galeria do pai, não no picker.
  const effectiveImage: HeygenImageSel | null =
    imageMode === "heygen_look"
      ? selectedLook?.image_url
        ? { kind: "heygen_look", look_url: selectedLook.image_url }
        : null
      : imageSel?.kind === imageMode
        ? imageSel
        : null;

  const canGenerate = Boolean(audioSel) && Boolean(effectiveImage);

  async function generate() {
    if (!effectiveImage || !audioSel) return;
    const ok = window.confirm(
      "Gerar este vídeo vai consumir créditos de API da SUA conta HeyGen. Continuar?",
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/heygen/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: effectiveImage,
          ...(audioSel.kind === "generation"
            ? { audio_generation_id: audioSel.id }
            : { audio_take_key: audioSel.key }),
          title: title.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? json?.message ?? "Não foi possível gerar");
        return;
      }
      const id = (json?.data?.id ?? json?.id) as string;
      submittedRef.current.add(id);
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
          Escolha a foto e o áudio — da sua voz clonada ou gravado na hora. O vídeo sai em 1080p, em poucos minutos.
        </p>
      </div>

      <HeygenImagePicker
        images={images}
        selectedLook={selectedLook}
        onClearLook={onClearLook}
        onGroupsChanged={onGroupsChanged}
        mode={imageMode}
        onModeChange={setImageMode}
        value={imageSel}
        onChange={setImageSel}
      />

      {presetAudio ? (
        <p className="rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-[12.5px] text-[var(--mute)]">
          🔒 Áudio do vídeo: <strong className="text-[var(--ink)]">{presetAudioLabel ?? "áudio escolhido no passo anterior"}</strong>
        </p>
      ) : (
        <HeygenAudioPicker audios={audios} value={audioSelLivre} onChange={setAudioSelLivre} />
      )}

      {/* Título + gerar */}
      <div className="flex flex-wrap items-center gap-2">
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
