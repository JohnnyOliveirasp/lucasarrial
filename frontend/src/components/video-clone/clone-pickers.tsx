"use client";

/**
 * Seletores de insumo do Vídeo Clone:
 * - ImagePicker: fotos PRONTAS do Gerador de Imagem (ou upload próprio).
 * - AudioPicker: áudios TTS gerados (mesma lista do wizard) ou upload.
 * Quem não tem, cria: links pro Gerador de Imagem / Gerar Voz.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AlertTriangle, Check, Loader2, RefreshCw, Upload } from "lucide-react";
import { acimaDoTeto, duracaoLegivel, separarPorTeto } from "@/lib/video/audio-eligibility";
import { avisoDeFormato } from "@/lib/video-clone/formato-saida";
import { FACE_GATE_CRITERIOS } from "@/lib/video-clone/face-gate";

/**
 * `aspectRatio` é a proporção declarada da foto (image_generations.aspect_ratio
 * do acervo, ou "W:H" montado das dimensões do arquivo recém-enviado). Serve
 * SÓ pro aviso de formato: ausente ou "auto" cai no aviso genérico, e em
 * nenhum caso bloqueia a geração.
 */
export type ImageChoice =
  | { kind: "history"; id: string; preview: string; aspectRatio?: string | null }
  | { kind: "upload"; key: string; preview: string; aspectRatio?: string | null };

export type AudioChoice =
  | { kind: "history"; id: string; seconds: number; preview: string | null; label: string; text: string | null }
  | {
      kind: "upload";
      key: string;
      seconds: number;
      preview: string;
      label: string;
      text: string | null;
      /**
       * Por que a PRÉVIA da transcrição falhou (#251). `text` e `textError`
       * nulos = ainda transcrevendo. Isso NÃO bloqueia gerar o vídeo: o
       * servidor transcreve de novo a partir do `key`.
       */
      textError?: string | null;
    };

type HistImage = {
  id: string;
  status: string;
  image_url: string | null;
  name: string | null;
  /** Já vem no GET /api/v1/images — dá pra saber se é deitada sem abrir o arquivo. */
  aspect_ratio: string | null;
};
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
  refreshKey = 0,
}: {
  selected: ImageChoice | null;
  onSelect: (c: ImageChoice) => void;
  onUploadClick: () => void;
  uploading: boolean;
  /** Bump externo (ex.: upload importado pro acervo) → refetch + aba histórico. */
  refreshKey?: number;
}) {
  const t = useTranslations("videoClone.pickers");
  const [tab, setTab] = useState<"history" | "upload">("history");
  const [items, setItems] = useState<HistImage[] | null>(null);

  // A saída do Vídeo Clone é sempre o mesmo quadro em pé (CLONE_TIERS). Dizer
  // isso ANTES de gerar é o que faltava no caso quaglioandre@gmail.com: 8
  // vídeos e 43.360 créditos pra descobrir sozinho que foto deitada é cortada.
  const { formato, cortaLaterais } = avisoDeFormato(selected?.aspectRatio);

  useEffect(() => {
    if (refreshKey > 0) {
      setItems(null);
      setTab("history");
    }
  }, [refreshKey]);

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
          {t("myPhotos")}
        </button>
        <button type="button" onClick={() => setTab("upload")} className={tabCls(tab === "upload")}>
          {t("uploadPhoto")}
        </button>
      </div>
      <p className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
        {t.rich("photoHint", {
          strong: (chunks) => <strong className="text-[var(--silver)]">{chunks}</strong>,
        })}
      </p>
      {/* Critérios do gate de rosto (ordem 26/09, "avisa antes de cobrar"):
          antes a tela só mostrava o CUSTO, nunca o que a foto precisa ter — um
          aluno pagou 4 tentativas (525cr cada) adivinhando a regra. A lista
          vem de FACE_GATE_CRITERIOS (lib/video-clone/face-gate.ts), que é o
          mesmo contrato que checkFrontalFace julga; não hardcode a frase
          aqui — se o gate mudar de campo, o array muda lá e esta tela segue
          junto (ver tradução `faceGateCriterio_<campo>`). */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-wide text-[var(--ash)]">
        <span>{t("faceGateLabel")}</span>
        {FACE_GATE_CRITERIOS.map((c) => (
          <span key={c.campo} className="text-[var(--silver)]">
            · {t(`faceGateCriterio_${c.campo}`)}
          </span>
        ))}
      </p>
      {/* Formato da saída: aparece SEMPRE, antes de escolher qualquer foto.
          Largura/altura vão como TEXTO de propósito: como número, o next-intl
          formataria por locale e um quadro futuro de 1280 viraria "1.280". */}
      {formato && (
        <p className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
          {t("outputVertical", { w: String(formato.width), h: String(formato.height) })}
        </p>
      )}
      {/* Foto deitada: o recado específico, no momento da escolha. É AVISO —
          o botão de gerar continua habilitado (recortar é uso legítimo). */}
      {formato && cortaLaterais && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 py-2 text-[12px] leading-snug text-[var(--mute)]"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--silver)]" />
          <span>{t("horizontalWarning", { w: String(formato.width), h: String(formato.height) })}</span>
        </p>
      )}

      {tab === "history" &&
        (items === null ? (
          <div className="flex items-center gap-2 p-4 text-[var(--mute)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t("loadingPhotos")}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] p-4 text-sm text-[var(--mute)]">
            {t("noPhotos")}{" "}
            <Link href="/app/images" className="text-[var(--silver)] underline hover:text-[var(--ink)]">
              {t("createPhoto")}
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
                      onClick={() =>
                        onSelect({
                          kind: "history",
                          id: img.id,
                          preview: img.image_url!,
                          aspectRatio: img.aspect_ratio,
                        })
                      }
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
              {t("createAnotherPhoto")}
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
            {selected?.kind === "upload" ? t("changePhoto") : t("choosePhotoFile")}
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
  onRetryTranscription,
}: {
  selected: AudioChoice | null;
  onSelect: (c: AudioChoice) => void;
  onUploadClick: () => void;
  uploading: boolean;
  maxSeconds: number;
  /** Redispara a prévia da transcrição do áudio enviado (#251). */
  onRetryTranscription?: () => void;
}) {
  const t = useTranslations("videoClone.pickers");
  const [tab, setTab] = useState<"history" | "upload">("history");
  const [items, setItems] = useState<HistAudio[] | null>(null);
  // Falha de carga NÃO pode se parecer com "você não tem áudios": eram o mesmo
  // pixel antes (`r.ok ? … : {audios:[]}` + `.catch(() => setItems([]))`).
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (tab !== "history" || items !== null) return;
    fetch("/api/v1/videos/audios", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        setLoadFailed(false);
        setItems((j.audios ?? []) as HistAudio[]);
      })
      .catch(() => {
        setLoadFailed(true);
        setItems([]);
      });
  }, [tab, items]);

  // O teto (90s) continua valendo, mas quem passa dele aparece DESABILITADO com
  // o motivo — sumir calado é o que gerou o chamado #adc3ed99.
  const { usaveis, longos, ordenados } = separarPorTeto(items ?? [], maxSeconds);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setTab("history")} className={tabCls(tab === "history")}>
          {t("myAudios")}
        </button>
        <button type="button" onClick={() => setTab("upload")} className={tabCls(tab === "upload")}>
          {t("uploadAudio")}
        </button>
      </div>
      <p className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
        {t("audioHint", { max: maxSeconds })}
      </p>

      {tab === "history" &&
        (items === null ? (
          <div className="flex items-center gap-2 p-4 text-[var(--mute)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t("loadingAudios")}</span>
          </div>
        ) : loadFailed ? (
          <div
            role="alert"
            className="rounded-[var(--radius)] border border-dashed border-[var(--status-error)]/40 p-4 text-sm text-[var(--mute)]"
          >
            {t("audiosLoadFailed")}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] p-4 text-sm text-[var(--mute)]">
            {t("noAudios")}{" "}
            <Link href="/app/voice-cloning/generate" className="text-[var(--silver)] underline hover:text-[var(--ink)]">
              {t("createAudio")}
            </Link>
          </div>
        ) : (
          <>
            {/* Tem áudio, mas TODOS passam do teto: era este o aluno que lia
                "você ainda não tem áudios" com o acervo cheio. */}
            {usaveis.length === 0 && (
              <div className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] p-4 text-sm text-[var(--mute)]">
                {t("noAudiosOnlyLong", { n: longos.length, max: maxSeconds })}
              </div>
            )}
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
              {ordenados.slice(0, 20).map((a) => {
                const active = selected?.kind === "history" && selected.id === a.id;
                const tooLong = acimaDoTeto(a.duration_seconds, maxSeconds);
                const label = a.name?.trim() || `${a.voice_name} · ${new Date(a.created_at).toLocaleDateString("pt-BR")}`;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      disabled={tooLong}
                      onClick={() =>
                        onSelect({ kind: "history", id: a.id, seconds: a.duration_seconds, preview: a.audio_url, label, text: a.text_raw })
                      }
                      aria-pressed={active}
                      title={tooLong ? t("tooLongReason", { dur: duracaoLegivel(a.duration_seconds), max: maxSeconds }) : undefined}
                      className={`flex w-full flex-col gap-1.5 rounded-[var(--radius)] border p-3 text-left transition-colors ${
                        tooLong
                          ? "cursor-not-allowed border-dashed border-[var(--hairline)] opacity-60"
                          : active
                            ? "border-[var(--hairline-bright)] shadow-[0_0_0_1px_var(--hairline-bright)]"
                            : "border-[var(--hairline)] hover:border-[var(--hairline-bright)]"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-[var(--ink)]">{label}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[var(--ash)]">{duracaoLegivel(a.duration_seconds)}</span>
                          {active && !tooLong && <Check className="h-4 w-4 text-[var(--silver)]" />}
                        </span>
                      </span>
                      {/* Por que este não dá pra usar — dito na cara, no lugar
                          onde antes não havia nada porque a linha nem vinha. */}
                      {tooLong && (
                        <span className="font-mono text-[10px] leading-snug tracking-wide text-[var(--status-error)]">
                          {t("tooLongReason", { dur: duracaoLegivel(a.duration_seconds), max: maxSeconds })}
                        </span>
                      )}
                      {/* O que o áudio FALA — sempre visível (2 linhas; completo ao selecionar) */}
                      {a.text_raw && (
                        <span className={`text-[12px] leading-snug text-[var(--mute)] ${active && !tooLong ? "max-h-28 overflow-y-auto" : "line-clamp-2"}`}>
                          “{a.text_raw}”
                        </span>
                      )}
                      {active && !tooLong && a.audio_url && (
                        <audio src={a.audio_url} controls preload="none" className="w-full" onClick={(e) => e.stopPropagation()} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Link href="/app/voice-cloning/generate" className="w-fit font-mono text-[10px] tracking-wide text-[var(--silver)] underline hover:text-[var(--ink)]">
              {t("createAnotherAudio")}
            </Link>
          </>
        ))}

      {tab === "upload" && (
        <div className="flex flex-col gap-2">
          {selected?.kind === "upload" && (
            <div className="flex flex-col gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-3">
              <span className="truncate text-sm text-[var(--ink)]">{selected.label}</span>
              <audio src={selected.preview} controls preload="metadata" className="w-full" />
              {/* Três estados EXPLÍCITOS (#251). Antes eram dois — "tem texto"
                  ou spinner — então qualquer falha virava um spinner eterno,
                  porque a ausência de texto era lida como "ainda vem". */}
              {selected.textError ? (
                <div className="flex flex-col items-start gap-1.5">
                  <span className="flex items-start gap-1.5 text-[12px] leading-snug text-[var(--status-error)]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{selected.textError}</span>
                  </span>
                  {/* A prévia é opcional: dizer isso na tela é o que evita a
                      pessoa achar que travou e desistir de gerar o vídeo. */}
                  <span className="text-[12px] leading-snug text-[var(--mute)]">
                    {t("transcriptionOptional")}
                  </span>
                  {onRetryTranscription && (
                    <button
                      type="button"
                      onClick={onRetryTranscription}
                      className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-[var(--silver)] underline hover:text-[var(--ink)]"
                    >
                      <RefreshCw className="h-3 w-3" /> {t("retryTranscription")}
                    </button>
                  )}
                </div>
              ) : selected.text ? (
                <span className="max-h-28 overflow-y-auto text-[12px] leading-snug text-[var(--mute)]">
                  {t("transcription", { text: selected.text })}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-[var(--ash)]">
                  <Loader2 className="h-3 w-3 animate-spin" /> {t("transcribing")}
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
            {selected?.kind === "upload" ? t("changeAudio") : t("chooseAudioFile", { max: maxSeconds })}
          </button>
        </div>
      )}
    </div>
  );
}
