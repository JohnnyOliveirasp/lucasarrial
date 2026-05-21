"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload, X, AudioLines, Check, FolderUp } from "lucide-react";
import { measureAudioDuration, formatDuration } from "@/lib/audio/duration";
import { filterAudioFiles, gatherAudioFromDataTransfer } from "@/lib/audio/collect";

const MIN_DURATION_SECONDS = 20 * 60; // 20 minutos
const REC_DURATION_SECONDS = 30 * 60; // 30 minutos
const MAX_FILES = 20;
const ACCEPT = ".mp3,.wav,.m4a,.flac,.ogg,.webm,audio/*";

type LocalFile = {
  id: string;
  file: File;
  duration: number | null;     // null enquanto mede
  progress: number;            // 0..100
  state: "idle" | "uploading" | "done" | "error";
  error?: string;
  key?: string;                // R2 key (preenchido após receber upload_slot)
};

type Step = "form" | "upload" | "submitting" | "done";

export function VoiceCreator() {
  const t = useTranslations("app.voiceCloningNew");
  const router = useRouter();

  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement | null>(null);

  // Callback ref: aplica webkitdirectory ASSIM QUE o input monta no DOM.
  // (useEffect não serve aqui — o input só renderiza no step "upload".)
  const setDirInput = useCallback((el: HTMLInputElement | null) => {
    dirInputRef.current = el;
    if (el) {
      el.setAttribute("webkitdirectory", "");
      el.setAttribute("directory", "");
      el.setAttribute("mozdirectory", "");
    }
  }, []);

  const totalDuration = useMemo(
    () => files.reduce((acc, f) => acc + (f.duration ?? 0), 0),
    [files],
  );
  const meetsMinimum = totalDuration >= MIN_DURATION_SECONDS;
  const missing = Math.max(0, MIN_DURATION_SECONDS - totalDuration);

  const addFiles = useCallback(async (incoming: File[]) => {
    // Dedup contra arquivos já na lista (signature: name + size + lastModified)
    const existing = new Set(
      files.map((f) => `${f.file.name}|${f.file.size}|${f.file.lastModified}`),
    );
    const seen = new Set<string>();
    const unique: File[] = [];
    let duplicates = 0;
    for (const f of incoming) {
      const sig = `${f.name}|${f.size}|${f.lastModified}`;
      if (existing.has(sig) || seen.has(sig)) {
        duplicates++;
        continue;
      }
      seen.add(sig);
      unique.push(f);
    }

    const available = Math.max(0, MAX_FILES - files.length);
    const accepted = unique.slice(0, available);
    const overLimit = unique.length - accepted.length;

    if (accepted.length === 0) {
      if (duplicates > 0 && overLimit === 0) {
        setError(t("errors.allDuplicates"));
      } else {
        setError(t("errors.tooMany", { max: MAX_FILES }));
      }
      return;
    }

    // Mensagens informativas (mas não bloqueia)
    if (overLimit > 0 && duplicates > 0) {
      setError(t("errors.partialAddBoth", { duplicates, ignored: overLimit }));
    } else if (overLimit > 0) {
      setError(t("errors.partialOver", { ignored: overLimit, max: MAX_FILES }));
    } else if (duplicates > 0) {
      setError(t("errors.partialDup", { duplicates }));
    } else {
      setError(null);
    }

    const additions: LocalFile[] = accepted.map((file: File) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      file,
      duration: null,
      progress: 0,
      state: "idle",
    }));

    setFiles((prev) => [...prev, ...additions]);

    // Medir duração em paralelo (não bloqueia)
    for (const item of additions) {
      measureAudioDuration(item.file).then((duration) => {
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, duration } : f)),
        );
      });
    }
  }, [files.length, t]);

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function onDropzoneFiles(list: FileList | null) {
    if (!list) return;
    const arr = filterAudioFiles(Array.from(list));
    if (arr.length === 0) {
      setError(t("errors.invalidType"));
      return;
    }
    // Ordena por nome (estável quando vem de pasta com vários arquivos)
    arr.sort((a, b) => {
      const pa = (a as File & { webkitRelativePath?: string }).webkitRelativePath || a.name;
      const pb = (b as File & { webkitRelativePath?: string }).webkitRelativePath || b.name;
      return pa.localeCompare(pb);
    });
    addFiles(arr);
  }

  async function onDropItems(items: DataTransferItemList) {
    const arr = await gatherAudioFromDataTransfer(items);
    if (arr.length === 0) {
      setError(t("errors.invalidType"));
      return;
    }
    addFiles(arr);
  }

  async function startUpload() {
    if (!meetsMinimum) return;
    if (files.length === 0) return;

    setStep("submitting");
    setError(null);

    // 1. Pede backend pra criar voice + presigned URLs
    let response: Response;
    try {
      response = await fetch("/api/v1/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          files: files.map((f) => ({
            filename: f.file.name,
            content_type: f.file.type || "audio/mpeg",
            size_bytes: f.file.size,
          })),
        }),
      });
    } catch {
      setStep("upload");
      setError(t("errors.network"));
      return;
    }

    if (!response.ok) {
      setStep("upload");
      const body = await response.json().catch(() => ({}));
      setError(body?.error?.message || t("errors.generic"));
      return;
    }

    const json = await response.json();
    const voiceId: string = json.voice.id;
    const slots: Array<{ index: number; key: string; upload_url: string }> =
      json.upload_slots;

    // 2. Mapeia slot → file pelo index (mesma ordem)
    setFiles((prev) =>
      prev.map((f, i) => ({ ...f, key: slots[i]?.key, state: "uploading" })),
    );

    // 3. Upload paralelo browser → R2
    setStep("upload");
    const results = await Promise.allSettled(
      files.map((f, i) => uploadOne(f, slots[i], setFiles, setOverallProgress, files.length)),
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      setError(t("errors.uploadFailed", { count: failed }));
      return;
    }

    // 4. Avisa backend que terminou — manda também durações medidas no browser
    const uploadedKeys = slots.map((s) => s.key);
    const clientDurations = files.map((f) => f.duration ?? 0);
    const completeResp = await fetch(
      `/api/v1/voices/${voiceId}/uploads-complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploaded_keys: uploadedKeys,
          client_durations: clientDurations,
        }),
      },
    );

    if (!completeResp.ok) {
      const body = await completeResp.json().catch(() => ({}));
      setError(body?.error?.message || t("errors.generic"));
      return;
    }

    setStep("done");
    router.push(`/app/voice-cloning/${voiceId}`);
    router.refresh();
  }

  // ───── render ─────

  if (step === "form") {
    return (
      <FormStep
        name={name}
        setName={setName}
        consent={consent}
        setConsent={setConsent}
        onNext={() => setStep("upload")}
        t={t}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Dropzone
        onPickFiles={() => inputRef.current?.click()}
        onPickFolder={() => dirInputRef.current?.click()}
        onDrop={onDropzoneFiles}
        onDropItems={onDropItems}
        disabled={step === "submitting"}
        t={t}
      />
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          onDropzoneFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={setDirInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          onDropzoneFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <FileList files={files} onRemove={removeFile} t={t} />
      )}

      <DurationMeter
        total={totalDuration}
        min={MIN_DURATION_SECONDS}
        recommended={REC_DURATION_SECONDS}
        missing={missing}
        meets={meetsMinimum}
        t={t}
      />

      {error && (
        <p
          role="alert"
          className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent"
        >
          {error}
        </p>
      )}

      {step === "submitting" || (step === "upload" && files.some((f) => f.state === "uploading")) ? (
        <UploadProgress files={files} overall={overallProgress} t={t} />
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep("form")}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-fg hover:text-accent transition-colors"
        >
          ← {t("back")}
        </button>
        <button
          type="button"
          onClick={startUpload}
          disabled={!meetsMinimum || step === "submitting" || files.length === 0}
          className="bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-fg hover:text-bg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {step === "submitting"
            ? t("submitting")
            : t("train", { duration: formatDuration(totalDuration) })}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Subcomponents
// ───────────────────────────────────────────────────────────────

type TFn = (key: string, params?: Record<string, string | number>) => string;

function FormStep({
  name,
  setName,
  consent,
  setConsent,
  onNext,
  t,
}: {
  name: string;
  setName: (v: string) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
  onNext: () => void;
  t: TFn;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="voice-name"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg"
        >
          {t("nameLabel")}
        </label>
        <input
          id="voice-name"
          type="text"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          className="border border-border bg-bg px-3 py-3 text-sm text-fg placeholder:text-muted-fg/60 focus:border-accent focus:outline-none"
        />
      </div>

      <div className="border border-border p-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent mb-3">
          {t("rules.title")}
        </div>
        <ul className="flex flex-col gap-2 text-sm text-muted-fg">
          <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" /><span>{t("rules.min")}</span></li>
          <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" /><span>{t("rules.recommended")}</span></li>
          <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" /><span>{t("rules.clean")}</span></li>
          <li className="flex items-start gap-2"><Check className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" /><span>{t("rules.variety")}</span></li>
        </ul>
      </div>

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 accent-accent"
        />
        <span className="text-sm text-fg">{t("consent")}</span>
      </label>

      <button
        type="submit"
        disabled={!name.trim() || !consent}
        className="bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-fg hover:text-bg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("next")} →
      </button>
    </form>
  );
}

function Dropzone({
  onPickFiles,
  onPickFolder,
  onDrop,
  onDropItems,
  disabled,
  t,
}: {
  onPickFiles: () => void;
  onPickFolder: () => void;
  onDrop: (list: FileList | null) => void;
  onDropItems: (items: DataTransferItemList) => Promise<void>;
  disabled: boolean;
  t: TFn;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          // Suporta pastas arrastadas — usa items + webkitGetAsEntry
          onDropItems(e.dataTransfer.items);
        } else {
          onDrop(e.dataTransfer.files);
        }
      }}
      className={[
        "flex flex-col items-center justify-center gap-4 border-2 border-dashed p-12 text-center transition-colors",
        over ? "border-accent bg-accent/5" : "border-border bg-surface",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      <Upload className={`h-8 w-8 ${over ? "text-accent" : "text-muted-fg"}`} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-fg">{t("dropzone.title")}</p>
        <p className="text-xs text-muted-fg">{t("dropzone.hint")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        <button
          type="button"
          onClick={onPickFiles}
          disabled={disabled}
          className="flex items-center gap-2 border border-border bg-bg px-4 py-2 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-fg hover:bg-fg hover:text-bg disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {t("dropzone.pickFiles")}
        </button>
        <button
          type="button"
          onClick={onPickFolder}
          disabled={disabled}
          className="flex items-center gap-2 border border-border bg-bg px-4 py-2 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-fg hover:bg-fg hover:text-bg disabled:opacity-50"
        >
          <FolderUp className="h-3.5 w-3.5" />
          {t("dropzone.pickFolder")}
        </button>
      </div>
    </div>
  );
}

function FileList({
  files,
  onRemove,
  t,
}: {
  files: LocalFile[];
  onRemove: (id: string) => void;
  t: TFn;
}) {
  return (
    <ul className="flex flex-col gap-px bg-border">
      {files.map((f) => (
        <li
          key={f.id}
          className="flex items-center gap-3 bg-bg px-4 py-3"
        >
          <AudioLines className="h-4 w-4 text-accent flex-shrink-0" />
          <span className="flex-1 truncate text-sm text-fg">{f.file.name}</span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-muted-fg">
            {f.duration == null ? t("measuring") : formatDuration(f.duration)}
          </span>
          {f.state === "uploading" && (
            <span className="font-mono text-[10px] uppercase tracking-wide text-accent">
              {f.progress}%
            </span>
          )}
          {f.state === "done" && <Check className="h-4 w-4 text-accent" />}
          <button
            type="button"
            onClick={() => onRemove(f.id)}
            disabled={f.state === "uploading"}
            className="text-muted-fg hover:text-accent disabled:opacity-30"
            aria-label="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function DurationMeter({
  total,
  min,
  recommended,
  missing,
  meets,
  t,
}: {
  total: number;
  min: number;
  recommended: number;
  missing: number;
  meets: boolean;
  t: TFn;
}) {
  const pct = Math.min(100, (total / recommended) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
          {t("meter.total")}
        </span>
        <span className="font-display text-3xl uppercase text-fg leading-none">
          {formatDuration(total)}
        </span>
      </div>
      <div className="relative h-1.5 bg-border">
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-300 ${
            meets ? "bg-accent" : "bg-fg"
          }`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-fg"
          style={{ left: `${(min / recommended) * 100}%` }}
          aria-label="minimum threshold"
        />
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
        <span>
          {t("meter.min")}: {formatDuration(min)}
        </span>
        <span>
          {meets
            ? `✓ ${t("meter.ok")}`
            : `${t("meter.missing")}: ${formatDuration(missing)}`}
        </span>
        <span>
          {t("meter.recommended")}: {formatDuration(recommended)}
        </span>
      </div>
    </div>
  );
}

function UploadProgress({
  files,
  overall,
  t,
}: {
  files: LocalFile[];
  overall: number;
  t: TFn;
}) {
  const done = files.filter((f) => f.state === "done").length;
  return (
    <div className="border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {t("uploading")}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-fg">
          {done} / {files.length}
        </span>
      </div>
      <div className="h-1 bg-border">
        <div
          className="h-full bg-accent transition-all duration-200"
          style={{ width: `${overall}%` }}
        />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Upload helper — XHR pra ter progress
// ───────────────────────────────────────────────────────────────

async function uploadOne(
  file: LocalFile,
  slot: { index: number; key: string; upload_url: string } | undefined,
  setFiles: React.Dispatch<React.SetStateAction<LocalFile[]>>,
  setOverall: (v: number) => void,
  totalFiles: number,
): Promise<void> {
  if (!slot) {
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, state: "error", error: "no-slot" } : f)),
    );
    throw new Error("no slot");
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", slot.upload_url);
    xhr.setRequestHeader("Content-Type", file.file.type || "audio/mpeg");
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      setFiles((prev) => {
        const next = prev.map((f) =>
          f.id === file.id ? { ...f, progress: pct } : f,
        );
        const sum = next.reduce((acc, f) => acc + f.progress, 0);
        setOverall(Math.round(sum / Math.max(1, totalFiles)));
        return next;
      });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, state: "done", progress: 100 } : f,
          ),
        );
        resolve();
      } else {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? { ...f, state: "error", error: `HTTP ${xhr.status}` }
              : f,
          ),
        );
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, state: "error", error: "network" } : f,
        ),
      );
      reject(new Error("network"));
    };
    xhr.send(file.file);
  });
}
