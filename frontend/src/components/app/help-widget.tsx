"use client";

/**
 * Mary no app — balão de ajuda flutuante (estilo "Lu" do Magalu).
 * Presente em todas as telas do /app (montado no layout). A Mary responde via
 * POST /api/v1/help com o cérebro do agente (manual + conta + visão).
 * O aluno pode COLAR/ANEXAR um print — e há botão de capturar a tela
 * (getDisplayMedia) pra Mary "ver" onde a pessoa está.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { MessageCircle, X, Send, ImagePlus, Camera, Loader2 } from "lucide-react";

type Msg = {
  id: string;
  from_me: boolean; // true = Mary
  content: string;
  created_at: string;
};

const IMAGE_MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

/** Redimensiona + converte pra JPEG base64 (sem prefixo data:). */
async function toJpegBase64(blob: Blob): Promise<{ data: string; media_type: string } | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return { data: dataUrl.split(",")[1] ?? "", media_type: "image/jpeg" };
  } catch {
    return null;
  }
}

export function HelpWidget() {
  const t = useTranslations("help");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<{ data: string; media_type: string; preview: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  }, []);

  // Histórico ao abrir pela 1ª vez.
  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      try {
        const r = await fetch("/api/v1/help", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          setMessages((j.messages ?? []) as Msg[]);
        }
      } catch {
        /* histórico é best-effort */
      } finally {
        setLoaded(true);
        scrollToEnd();
      }
    })();
  }, [open, loaded, scrollToEnd]);

  useEffect(() => {
    if (open) scrollToEnd();
  }, [open, messages.length, scrollToEnd]);

  async function attachBlob(blob: Blob) {
    setError(null);
    const converted = await toJpegBase64(blob);
    if (!converted || !converted.data) {
      setError(t("imageError"));
      return;
    }
    setImage({ ...converted, preview: `data:image/jpeg;base64,${converted.data}` });
  }

  function onPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) {
      e.preventDefault();
      void attachBlob(file);
    }
  }

  /** Captura a tela (o navegador pede permissão) → 1 frame → anexo. */
  async function captureScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 300)); // 1º frame estável
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      track.stop();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", JPEG_QUALITY));
      if (blob) await attachBlob(blob);
    } catch {
      /* usuário cancelou a permissão — sem erro */
    }
  }

  async function send() {
    const text = input.trim();
    if ((!text && !image) || sending) return;
    setSending(true);
    setError(null);

    const optimistic: Msg = {
      id: `tmp-${Date.now()}`,
      from_me: false,
      content: text || t("imageOnly"),
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setInput("");
    const outgoingImage = image;
    setImage(null);
    scrollToEnd();

    try {
      const r = await fetch("/api/v1/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          pathname,
          locale,
          image: outgoingImage ? { data: outgoingImage.data, media_type: outgoingImage.media_type } : null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || t("errorGeneric"));
      setMessages((m) => [...m, j.message as Msg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errorGeneric"));
    } finally {
      setSending(false);
      scrollToEnd();
    }
  }

  const canCapture =
    typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);

  return (
    <>
      {/* Balão flutuante */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t("close") : t("open")}
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] text-[var(--ink)] shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && (
          <span className="absolute -top-1 -right-1 inline-flex h-4 items-center rounded-full bg-[var(--accent,#f97316)] px-1.5 text-[9px] font-bold uppercase tracking-wide text-black">
            {t("badge")}
          </span>
        )}
      </button>

      {/* Painel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[min(560px,calc(100svh-8rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] shadow-[0_16px_60px_rgba(0,0,0,0.6)]">
          <header className="flex items-center gap-3 border-b border-[var(--hairline)] px-4 py-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-elevated)] font-sans text-sm font-bold text-[var(--ink)]">
              M
            </span>
            <div className="min-w-0">
              <p className="truncate font-sans text-sm font-semibold text-[var(--ink)]">{t("title")}</p>
              <p className="truncate text-[11px] text-[var(--mute)]">{t("subtitle")}</p>
            </div>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {loaded && messages.length === 0 && (
              <Bubble fromMe content={t("greeting")} />
            )}
            {messages.map((m) => (
              <Bubble key={m.id} fromMe={m.from_me} content={m.content} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-[12px] text-[var(--mute)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("typing")}
              </div>
            )}
          </div>

          {error && (
            <p className="border-t border-[var(--hairline)] px-4 py-2 text-[12px] text-[var(--status-error,#f87171)]">
              {error}
            </p>
          )}

          {image && (
            <div className="flex items-center gap-2 border-t border-[var(--hairline)] px-4 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview local base64 */}
              <img src={image.preview} alt="" className="h-10 w-10 rounded object-cover" />
              <span className="flex-1 truncate text-[12px] text-[var(--mute)]">{t("attached")}</span>
              <button
                type="button"
                onClick={() => setImage(null)}
                aria-label={t("removeImage")}
                className="text-[var(--mute)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <footer className="flex items-end gap-2 border-t border-[var(--hairline)] px-3 py-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void attachBlob(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label={t("attach")}
              title={t("attach")}
              className="pb-2 text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            {canCapture && (
              <button
                type="button"
                onClick={() => void captureScreen()}
                aria-label={t("capture")}
                title={t("capture")}
                className="pb-2 text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
              >
                <Camera className="h-5 w-5" />
              </button>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={onPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder={t("placeholder")}
              className="max-h-28 min-h-[38px] flex-1 resize-none rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-deep)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus:border-[var(--hairline-bright)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || (!input.trim() && !image)}
              aria-label={t("send")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--canvas)] transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </footer>
        </div>
      )}
    </>
  );
}

function Bubble({ fromMe, content }: { fromMe: boolean; content: string }) {
  return (
    <div className={fromMe ? "flex justify-start" : "flex justify-end"}>
      <div
        className={[
          "max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-md,12px)] px-3 py-2 text-[13px] leading-relaxed",
          fromMe
            ? "border border-[var(--hairline)] bg-[var(--surface-elevated)] text-[var(--body,#d4d4d8)]"
            : "bg-[var(--ink)] text-[var(--canvas)]",
        ].join(" ")}
      >
        {content}
      </div>
    </div>
  );
}
