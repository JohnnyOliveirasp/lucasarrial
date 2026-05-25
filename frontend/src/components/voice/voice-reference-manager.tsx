"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic2, Upload, Trash2, RefreshCw } from "lucide-react";
import { measureAudioDuration, formatDuration } from "@/lib/audio/duration";

const REF_MIN_SECONDS = 60;

type Props = {
  voiceId: string;
  /** Presigned GET da referência atual, ou null se não houver. */
  referenceUrl: string | null;
};

type Busy = "idle" | "uploading" | "deleting";

/**
 * Gerencia o áudio de referência PERSISTENTE da voz: subir a primeira vez,
 * trocar por outro ou apagar. A referência fica salva e é reusada em toda
 * geração — o usuário não precisa subir de novo a cada vez.
 */
export function VoiceReferenceManager({ voiceId, referenceUrl }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasReference = !!referenceUrl;

  async function handlePick(file: File) {
    setError(null);

    // Valida duração no cliente (≥60s) antes de gastar upload.
    const dur = await measureAudioDuration(file).catch(() => null);
    if (dur == null) {
      setError("Não consegui ler esse áudio. Tente outro arquivo.");
      return;
    }
    if (dur < REF_MIN_SECONDS) {
      setError(`Áudio muito curto (${formatDuration(dur)}). Mínimo 1:00.`);
      return;
    }

    setBusy("uploading");
    try {
      // 1. Presigned PUT
      const prepRes = await fetch(`/api/v1/voices/${voiceId}/reference/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type || "audio/mpeg",
        }),
      });
      if (!prepRes.ok) {
        const j = await prepRes.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Falha ao preparar upload");
      }
      const { reference_audio_key, upload_url } = await prepRes.json();

      // 2. Upload direto pro R2
      const putRes = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "audio/mpeg" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload R2 falhou (${putRes.status})`);

      // 3. Grava a chave na voz (e o backend limpa a referência antiga)
      const saveRes = await fetch(`/api/v1/voices/${voiceId}/reference`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_audio_key }),
      });
      if (!saveRes.ok) {
        const j = await saveRes.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Falha ao salvar referência");
      }

      setBusy("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no upload");
      setBusy("idle");
    }
  }

  async function handleDelete() {
    setBusy("deleting");
    setError(null);
    try {
      const res = await fetch(`/api/v1/voices/${voiceId}/reference`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Falha ao apagar");
      }
      setBusy("idle");
      setConfirmingDelete(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao apagar");
      setBusy("idle");
    }
  }

  const uploading = busy === "uploading";
  const deleting = busy === "deleting";

  return (
    <section className="border border-border bg-surface p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Mic2 className="h-4 w-4 text-accent" />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Áudio de referência
        </h2>
      </div>

      <p className="text-sm text-muted-fg">
        {hasReference ? (
          <>
            Esta referência é usada em <strong className="text-fg">todas as gerações</strong>.
            Você só precisa trocá-la se quiser outra base de prosódia/sotaque.
          </>
        ) : (
          <>
            Opcional. Um áudio de referência (≥1:00) melhora a fidelidade da voz. Sem ele, a
            geração usa só a LoRA.
          </>
        )}
      </p>

      {hasReference && referenceUrl && (
        <audio src={referenceUrl} controls className="w-full" preload="metadata" />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handlePick(f);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={uploading || deleting}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wide text-bg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-accent hover:text-accent-fg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {hasReference ? <RefreshCw className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          {uploading
            ? "Subindo…"
            : hasReference
            ? "Alterar áudio de referência"
            : "Adicionar áudio de referência"}
        </button>

        {hasReference && !confirmingDelete && (
          <button
            type="button"
            disabled={uploading || deleting}
            onClick={() => setConfirmingDelete(true)}
            className="flex items-center gap-2 border border-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:bg-accent hover:text-accent-fg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Apagar
          </button>
        )}
      </div>

      {confirmingDelete && (
        <div className="flex flex-col gap-3 border border-accent/40 bg-accent/5 p-4">
          <p className="text-sm text-fg">
            Apagar o áudio de referência? As próximas gerações vão usar só a LoRA.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Apagando…" : "Sim, apagar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="border border-border px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:bg-surface disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent"
        >
          {error}
        </p>
      )}
    </section>
  );
}
