"use client";

/**
 * Seletores de insumo do Vídeo Clone:
 * - ImagePicker: fotos PRONTAS do Gerador de Imagem (ou upload próprio).
 * - AudioPicker: áudios TTS gerados (mesma lista do wizard) ou upload.
 * Quem não tem, cria: links pro Gerador de Imagem / Gerar Voz.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Upload } from "lucide-react";

export type ImageChoice =
  | { kind: "history"; id: string; preview: string }
  | { kind: "upload"; key: string; preview: string };

export type AudioChoice =
  | { kind: "history"; id: string; seconds: number; preview: string | null; label: string; text: string | null }
  | { kind: "upload"; key: string; seconds: number; preview: string; label: string; text: string | null };

type HistImage = { id: string; status: string; image_url: string | null; name: string | null };
type HistAudio = {
  id: string;
  voice_name: string;
  name: string | null;
  text_raw: string | null;
  duration_seconds: number;
  audio_url: string | null;
  created_at: string;
};

const TAB =
  "rounded-[var(--radius)] border px-3 py-1.5 font-mono text-[11px] tracking-wide transition-colors";
const tabCls = (active: boolean) =>
  `${TAB} ${active ? "border-[var(--hairline-bright)] text-[var(--ink)]" : "border-[var(--hairline)] text-[var(--ash)] hover:text-[var(--ink)]"}`;

export function ImagePicker({
  selected,
  onSelect,
  onUploadClick,
  uploading,
}: {
  selected: ImageChoice | null;
  onSelect: (c: ImageChoice) => void;
  onUploadClick: () => void;
  uploading: boolean;
}) {
  const [tab, setTab] = useState<"history" | "upload">("history");
  const [items, setItems] = useState<HistImage[] | null>(null);

  useEffect(() => {
    if (tab !== "history" || items !== null) return;
    fetch("/api/v1/images", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { images: [] }))
      .then((j) => setItems(((j.images ?? []) as HistImage[]).filter((i) => i.status === "ready" && i.image_url)))
      .catch(() => setItems([]));
  }, [tab, items]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setTab("history")} className={tabCls(tab === "history")}>
          Minhas fotos
        </button>
        <button type="button" onClick={() => setTab("upload")} className={tabCls(tab === "upload")}>
          Enviar foto
        </button>
      </div>
      <p className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
        📸 Melhor resultado: foto da <strong className="text-[var(--silver)]">metade do corpo pra cima</strong>, rosto nítido e bem iluminado.
      </p>

      {tab === "history" &&
        (items === null ? (
          <div className="flex items-center gap-2 p-4 text-[var(--mute)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando suas fotos…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] p-4 text-sm text-[var(--mute)]">
            Você ainda não tem fotos geradas.{" "}
            <Link href="/app/images" className="text-[var(--silver)] underline hover:text-[var(--ink)]">
              Criar minha foto no Gerador de Imagem →
            </Link>
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {items.slice(0, 15).map((img) => {
                const active = selected?.kind === "history" && selected.id === img.id;
                return (
                  <li key={img.id}>
                    <button
                      type="button"
                      onClick={() => onSelect({ kind: "history", id: img.id, preview: img.image_url! })}
                      aria-pressed={active}
                      className={`relative block aspect-square w-full overflow-hidden rounded-[var(--radius)] border transition-colors ${
                        active ? "border-[var(--hairline-bright)] shadow-[0_0_0_1px_var(--hairline-bright)]" : "border-[var(--hairline)] hover:border-[var(--hairline-bright)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.image_url!} alt={img.name ?? ""} className="h-full w-full object-cover" />
                      {active && (
                        <span className="absolute right-1 top-1 rounded-full bg-[var(--silver)] p-0.5 text-[var(--canvas)]">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Link href="/app/images" className="w-fit font-mono text-[10px] tracking-wide text-[var(--silver)] underline hover:text-[var(--ink)]">
              Criar outra foto no Gerador de Imagem →
            </Link>
          </>
        ))}

      {tab === "upload" && (
        <div className="flex flex-col gap-2">
          {selected?.kind === "upload" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.preview} alt="" className="max-h-48 w-fit rounded-[var(--radius)] border border-[var(--hairline-strong)]" />
          ) : null}
          <button
            type="button"
            onClick={onUploadClick}
            disabled={uploading}
            className="flex w-fit items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] px-4 py-3 text-sm text-[var(--mute)] transition-colors hover:border-[var(--hairline-bright)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {selected?.kind === "upload" ? "Trocar foto" : "Escolher arquivo (PNG, JPG, WEBP)"}
          </button>
        </div>
      )}
    </div>
  );
}

export function AudioPicker({
  selected,
  onSelect,
  onUploadClick,
  uploading,
  maxSeconds,
}: {
  selected: AudioChoice | null;
  onSelect: (c: AudioChoice) => void;
  onUploadClick: () => void;
  uploading: boolean;
  maxSeconds: number;
}) {
  const [tab, setTab] = useState<"history" | "upload">("history");
  const [items, setItems] = useState<HistAudio[] | null>(null);

  useEffect(() => {
    if (tab !== "history" || items !== null) return;
    fetch("/api/v1/videos/audios", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { audios: [] }))
      .then((j) => setItems((j.audios ?? []) as HistAudio[]))
      .catch(() => setItems([]));
  }, [tab, items]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setTab("history")} className={tabCls(tab === "history")}>
          Meus áudios
        </button>
        <button type="button" onClick={() => setTab("upload")} className={tabCls(tab === "upload")}>
          Enviar áudio
        </button>
      </div>

      {tab === "history" &&
        (items === null ? (
          <div className="flex items-center gap-2 p-4 text-[var(--mute)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando seus áudios…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] p-4 text-sm text-[var(--mute)]">
            Você ainda não tem áudios gerados (até {maxSeconds}s).{" "}
            <Link href="/app/voice-cloning/generate" className="text-[var(--silver)] underline hover:text-[var(--ink)]">
              Gerar um áudio com a sua voz →
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {items.slice(0, 20).map((a) => {
                const active = selected?.kind === "history" && selected.id === a.id;
                const label = a.name?.trim() || `${a.voice_name} · ${new Date(a.created_at).toLocaleDateString("pt-BR")}`;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() =>
                        onSelect({ kind: "history", id: a.id, seconds: a.duration_seconds, preview: a.audio_url, label, text: a.text_raw })
                      }
                      aria-pressed={active}
                      className={`flex w-full flex-col gap-1.5 rounded-[var(--radius)] border p-3 text-left transition-colors ${
                        active ? "border-[var(--hairline-bright)] shadow-[0_0_0_1px_var(--hairline-bright)]" : "border-[var(--hairline)] hover:border-[var(--hairline-bright)]"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-[var(--ink)]">{label}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[var(--ash)]">{Math.ceil(a.duration_seconds)}s</span>
                          {active && <Check className="h-4 w-4 text-[var(--silver)]" />}
                        </span>
                      </span>
                      {/* O que o áudio FALA — sempre visível (2 linhas; completo ao selecionar) */}
                      {a.text_raw && (
                        <span className={`text-[12px] leading-snug text-[var(--mute)] ${active ? "max-h-28 overflow-y-auto" : "line-clamp-2"}`}>
                          “{a.text_raw}”
                        </span>
                      )}
                      {active && a.audio_url && (
                        <audio src={a.audio_url} controls preload="none" className="w-full" onClick={(e) => e.stopPropagation()} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Link href="/app/voice-cloning/generate" className="w-fit font-mono text-[10px] tracking-wide text-[var(--silver)] underline hover:text-[var(--ink)]">
              Gerar novo áudio com a sua voz →
            </Link>
          </>
        ))}

      {tab === "upload" && (
        <div className="flex flex-col gap-2">
          {selected?.kind === "upload" && (
            <div className="flex flex-col gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-3">
              <span className="truncate text-sm text-[var(--ink)]">{selected.label}</span>
              <audio src={selected.preview} controls preload="metadata" className="w-full" />
              {selected.text ? (
                <span className="max-h-28 overflow-y-auto text-[12px] leading-snug text-[var(--mute)]">
                  Transcrição: “{selected.text}”
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-[var(--ash)]">
                  <Loader2 className="h-3 w-3 animate-spin" /> Transcrevendo o áudio…
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onUploadClick}
            disabled={uploading}
            className="flex w-fit items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] px-4 py-3 text-sm text-[var(--mute)] transition-colors hover:border-[var(--hairline-bright)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {selected?.kind === "upload" ? "Trocar áudio" : `Escolher arquivo (MP3, WAV · até ${maxSeconds}s)`}
          </button>
        </div>
      )}
    </div>
  );
}
