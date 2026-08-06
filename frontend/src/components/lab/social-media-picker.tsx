"use client";

/**
 * Seletor de mídia do Publicador (06/08): a pessoa escolhe a foto/vídeo
 * PELA PLATAFORMA (imagens geradas) ou PELO COMPUTADOR (upload → R2
 * social-uploads/, apagado pelo sweeper 7d após publicar). Sem URL na tela.
 */
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

export type PickedMedia = {
  source: { kind: "image"; id: string } | { kind: "upload"; key: string; media_type: "image" | "reel" };
  mediaType: "image" | "reel";
  previewUrl: string | null;
  /** contexto pro "✨ Gerar legenda" (prompt da imagem, se houver) */
  context: string | null;
};

type PlatformImg = { id: string; image_url: string | null; prompt_display: string | null; prompt: string; status: string };

export function SocialMediaPicker({
  value,
  onChange,
}: {
  value: PickedMedia | null;
  onChange: (media: PickedMedia | null) => void;
}) {
  const t = useTranslations("social.picker");
  const locale = useLocale();
  const [tab, setTab] = useState<"platform" | "upload">("platform");
  const [images, setImages] = useState<PlatformImg[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    setLoadingImages(true);
    const lang = locale.startsWith("en") ? "en" : locale.startsWith("es") ? "es" : "pt";
    fetch(`/api/v1/images?lang=${lang}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        const list = ((j?.data?.images ?? j?.images ?? []) as PlatformImg[]).filter(
          (i) => i.status === "ready" && i.image_url,
        );
        if (alive) setImages(list.slice(0, 24));
      })
      .catch(() => {})
      .finally(() => alive && setLoadingImages(false));
    return () => {
      alive = false;
    };
  }, [locale]);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/social/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content_type: file.type }),
      });
      const j = await res.json();
      const d = j?.data ?? j;
      if (!res.ok || !d?.upload_url) {
        setError(j?.error?.message ?? t("uploadError"));
        return;
      }
      const put = await fetch(d.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        setError(t("uploadError"));
        return;
      }
      onChange({
        source: { kind: "upload", key: d.key, media_type: d.media_type },
        mediaType: d.media_type,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        context: null,
      });
    } finally {
      setUploading(false);
    }
  }

  // Mídia escolhida → mostra o preview + trocar
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--hairline)] p-2">
        {value.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.previewUrl} alt="" className="h-16 w-16 rounded-[var(--radius-sm)] object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-deep)] text-[20px]">🎬</span>
        )}
        <span className="flex-1 text-[13px] text-[var(--mute)]">
          {value.mediaType === "image" ? t("selectedImage") : t("selectedVideo")}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[12px] text-[var(--ash)] underline-offset-2 hover:underline"
        >
          {t("change")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <TabButton active={tab === "platform"} onClick={() => setTab("platform")} label={t("fromPlatform")} />
        <TabButton active={tab === "upload"} onClick={() => setTab("upload")} label={t("fromComputer")} />
      </div>

      {tab === "platform" &&
        (loadingImages ? (
          <p className="text-[13px] text-[var(--mute)]">{t("loading")}</p>
        ) : images.length === 0 ? (
          <p className="text-[13px] text-[var(--mute)]">{t("noImages")}</p>
        ) : (
          <div className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() =>
                  onChange({
                    source: { kind: "image", id: img.id },
                    mediaType: "image",
                    previewUrl: img.image_url,
                    context: img.prompt_display ?? img.prompt,
                  })
                }
                className="aspect-square overflow-hidden rounded-[var(--radius-sm)] border border-[var(--hairline)] transition-transform hover:scale-[1.03] hover:border-[var(--hairline-bright)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.image_url ?? ""} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ))}

      {tab === "upload" && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-[var(--radius-sm)] border border-dashed border-[var(--hairline-strong)] px-4 py-6 text-[13.5px] text-[var(--mute)] transition-colors hover:border-[var(--hairline-bright)] hover:text-[var(--ink)] disabled:opacity-40"
          >
            {uploading ? t("uploading") : t("uploadHint")}
          </button>
        </div>
      )}
      {error && <p className="text-[13px] text-[var(--danger,#e5484d)]">{error}</p>}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-[12.5px] transition-colors ${
        active
          ? "border-[var(--hairline-bright)] text-[var(--ink)]"
          : "border-[var(--hairline)] text-[var(--mute)] hover:text-[var(--ink)]"
      }`}
    >
      {label}
    </button>
  );
}
