"use client";

/**
 * Vídeo Vendas TikTok — passo 5: a VOZ que narra o roteiro. Dois caminhos:
 *   A) Voz CLONADA: escolhe uma voz pronta → TTS do roteiro (cobra 1cr/char,
 *      mín 400 — cobrança do próprio endpoint de geração) → poll → anexa.
 *   B) Áudio PRÓPRIO já gravado: valida ≤60s no browser, sobe, Whisper
 *      transcreve no server (transcrição SUBSTITUI o roteiro) → anexa.
 * Anexou → o projeto converge pro pipeline normal (cenas → imagens → final).
 */
import { useEffect, useRef, useState } from "react";
import { AudioLines, Upload, Loader2, AlertCircle, Mic2 } from "lucide-react";
import { SALES_MAX_AUDIO_SECONDS } from "@/lib/video/config";

type Voice = { id: string; name: string; status: string };
type Phase = "idle" | "generating" | "uploading" | "attaching";

const MIN_TTS_CREDITS = 400;

function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = new Audio();
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(el.duration);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não conseguimos ler esse arquivo de áudio."));
    };
    el.src = url;
  });
}

async function api(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || "Algo deu errado.");
  return json;
}

export function SalesVoice({
  projectId,
  script,
  onAttached,
}: {
  projectId: string;
  script: string;
  onAttached: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== "idle";
  const ttsCost = Math.max(script.length, MIN_TTS_CREDITS);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/v1/voices", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const ready = ((json.voices ?? []) as Voice[]).filter((v) => v.status === "ready");
        setVoices(ready);
        if (ready.length > 0) setVoiceId(ready[0].id);
      } catch {
        /* sem vozes — só o upload fica disponível */
      }
    })();
  }, []);

  async function generateWithVoice() {
    if (!voiceId) return;
    setError(null);
    setPhase("generating");
    setNote("Gerando o áudio com a sua voz…");
    try {
      const gen = await api(`/api/v1/voices/${voiceId}/generate`, "POST", { text: script });
      const genId = gen.generation_id as string;

      // Poll até ficar pronto (RunPod; frio pode demorar — 4min de teto).
      const deadline = Date.now() + 4 * 60 * 1000;
      let ready = false;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const st = await api(`/api/v1/generations/${genId}`, "GET");
        const status = st.generation?.status ?? st.status;
        if (status === "ready") {
          ready = true;
          break;
        }
        if (status === "failed") {
          throw new Error(st.generation?.error_message || "A geração do áudio falhou.");
        }
        setNote("Gerando o áudio com a sua voz… (pode levar 1-2 min)");
      }
      if (!ready) throw new Error("A geração demorou demais — veja o Histórico e tente anexar de novo.");

      setPhase("attaching");
      setNote("Anexando o áudio ao projeto…");
      await api(`/api/v1/videos/${projectId}/audio`, "POST", { generation_id: genId });
      onAttached();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar o áudio.");
      setPhase("idle");
      setNote(null);
    }
  }

  async function handleUpload(file: File) {
    setError(null);
    if (file.size > 25 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. 25MB).");
      return;
    }
    setPhase("uploading");
    setNote("Lendo o áudio…");
    try {
      const duration = await readDuration(file);
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Não conseguimos ler a duração desse áudio.");
      }
      if (duration > SALES_MAX_AUDIO_SECONDS) {
        throw new Error(
          `Seu áudio tem ${Math.round(duration)}s — no Vídeo Vendas o máximo é ${SALES_MAX_AUDIO_SECONDS}s.`,
        );
      }

      setNote("Enviando…");
      const slot = await api("/api/v1/videos/upload-audio", "POST", {
        filename: file.name,
        content_type: file.type || "audio/mpeg",
        size: file.size,
      });
      const put = await fetch(slot.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "audio/mpeg" },
        body: file,
      });
      if (!put.ok) throw new Error("Falha ao enviar o áudio. Tente novamente.");

      setPhase("attaching");
      setNote("Transcrevendo e anexando…");
      await api(`/api/v1/videos/${projectId}/audio`, "POST", { uploaded_key: slot.key });
      onAttached();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao processar o áudio.");
      setPhase("idle");
      setNote(null);
    }
  }

  const btnCls =
    "inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50";
  const ghostBtnCls =
    "inline-flex h-10 w-fit items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)] disabled:opacity-50";

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
      <div className="flex items-center gap-2">
        <AudioLines className="h-5 w-5 text-[var(--silver)]" />
        <h2 className="font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
          5 · A voz que narra (máx. {SALES_MAX_AUDIO_SECONDS}s)
        </h2>
      </div>

      {error && (
        <p role="alert" className="inline-flex items-start gap-2 rounded-[var(--radius)] border border-[var(--status-error)]/40 px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
      {note && busy && (
        <p className="inline-flex items-center gap-2 font-mono text-[11px] text-[var(--mute)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {note}
        </p>
      )}

      {/* A — voz clonada */}
      <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] p-4">
        <span className="text-[14px] font-medium text-[var(--ink)]">Narrar com a minha voz clonada</span>
        {voices.length === 0 ? (
          <span className="font-mono text-[11px] text-[var(--ash)]">
            Você ainda não tem uma voz pronta — treine uma em Vozes, ou envie um áudio gravado abaixo.
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              disabled={busy}
              className="h-10 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 text-[14px] text-[var(--ink)] focus:border-[var(--hairline-bright)] focus:outline-none"
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={generateWithVoice} disabled={busy || !voiceId} className={btnCls}>
              {phase === "generating" || phase === "attaching" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic2 className="h-4 w-4" />
              )}
              Gerar áudio ({ttsCost.toLocaleString("pt-BR")} cr)
            </button>
          </div>
        )}
      </div>

      {/* B — áudio próprio */}
      <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] p-4">
        <span className="text-[14px] font-medium text-[var(--ink)]">Já gravei o áudio do produto</span>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={ghostBtnCls}>
            {phase === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar áudio
          </button>
          <span className="font-mono text-[10px] text-[var(--ash)]">
            MP3/WAV/M4A/OGG · máx. {SALES_MAX_AUDIO_SECONDS}s · a transcrição do que você fala substitui o roteiro
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) handleUpload(f);
          }}
        />
      </div>
    </section>
  );
}
