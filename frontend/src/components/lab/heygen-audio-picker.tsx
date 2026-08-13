"use client";

/**
 * Áudio do vídeo HeyGen (feedback Lucas 11/08): ou um áudio já gerado com a
 * voz clonada (histórico), ou uma GRAVAÇÃO feita na hora pelo microfone.
 * A gravação usa a mesma rotina do Gravador (sessão + upload recorder-test),
 * então o take fica salvo e pode entrar no treino da voz depois.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, AlertTriangle, Upload as UploadIcon } from "lucide-react";
import {
  AUDIO_UPLOAD_MAX_BYTES,
  AUDIO_VIDEO_MAX_S,
  medirDuracaoArquivo,
} from "@/lib/audio/duracao-arquivo";

// Regra universal 13/08 (Johnny): áudio de vídeo tem teto de 120s — Reels
// não passa de 2 minutos. Vale pra gravar E pra subir arquivo.
const MAX_SECONDS = 120;

export type AudioGen = {
  id: string;
  name: string | null;
  text_raw: string;
  duration_seconds: number | null;
  status: string;
};

export type HeygenAudioSel =
  | { kind: "generation"; id: string }
  | { kind: "take"; key: string };

type Take = { key: string; name: string; url: string; at: string | null };

type Props = {
  audios: AudioGen[];
  value: HeygenAudioSel | null;
  onChange: (v: HeygenAudioSel | null) => void;
};

export function HeygenAudioPicker({ audios, value, onChange }: Props) {
  const [tab, setTab] = useState<"history" | "record" | "upload">("history");
  const [token, setToken] = useState<string | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sessão do gravador (mesma do "Gravar pelo Celular") + takes já salvos.
  useEffect(() => {
    if ((tab !== "record" && tab !== "upload") || token) return;
    void (async () => {
      try {
        const res = await fetch("/api/v1/recorder-test/session");
        const j = await res.json();
        const t = (j?.data?.token ?? j?.token) as string | undefined;
        if (!t) throw new Error();
        setToken(t);
        await refreshTakes(t);
      } catch {
        setError("Não consegui abrir a sessão de gravação — recarregue a página.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function refreshTakes(t: string) {
    const res = await fetch("/api/v1/recorder-test/takes", { headers: { "x-recorder-token": t } });
    const j = await res.json().catch(() => null);
    if (res.ok) {
      const list = ((j?.data?.takes ?? j?.takes ?? []) as Take[]).slice().reverse();
      setTakes(list);
      return list;
    }
    return [];
  }

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recRef.current?.stream.getTracks().forEach((tr) => tr.stop());
    recRef.current = null;
    setRecording(false);
    setSeconds(0);
  }

  async function start() {
    setError(null);
    try {
      // Sem NR/eco (mudam o timbre), com AGC pra nivelar o volume — mesma
      // receita do gravador do celular.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 128000 } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = (rec.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunksRef.current, { type });
        cleanup();
        if (blob.size > 0) void upload(blob, type);
      };
      recRef.current = rec;
      rec.start(1000);
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) recRef.current?.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError("Não consegui acessar o microfone — verifique a permissão do navegador.");
    }
  }

  async function upload(blob: Blob, type: string) {
    if (!token) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      const ext = type === "audio/mp4" ? "m4a" : "webm";
      fd.append("file", new File([blob], `take.${ext}`, { type }));
      const res = await fetch("/api/v1/recorder-test/upload", {
        method: "POST",
        headers: { "x-recorder-token": token },
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || "Falha no envio.");
      const key = (j?.data?.key ?? j?.key) as string | undefined;
      const list = await refreshTakes(token);
      // A gravação recém-feita já entra selecionada.
      const mine = key ?? list[0]?.key;
      if (mine) onChange({ kind: "take", key: mine });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no envio — grave de novo.");
    } finally {
      setUploading(false);
    }
  }

  /** Aba "Subir arquivo" (13/08): mesma rotina dos takes, teto 120s + 25MB. */
  async function enviarArquivo(file: File) {
    setError(null);
    if (file.size > AUDIO_UPLOAD_MAX_BYTES) {
      setError("Arquivo grande demais (máx 25MB).");
      return;
    }
    let dur = 0;
    try {
      dur = await medirDuracaoArquivo(file);
    } catch {
      setError("Não consegui ler esse arquivo — tente MP3, WAV ou M4A.");
      return;
    }
    if (!Number.isFinite(dur) || dur > AUDIO_VIDEO_MAX_S + 0.5) {
      setError(`O áudio tem ${Math.round(dur)}s — o máximo é ${AUDIO_VIDEO_MAX_S}s (Reels não passa de 2 minutos).`);
      return;
    }
    if (!token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/recorder-test/upload", {
        method: "POST",
        headers: { "x-recorder-token": token },
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || "Falha no envio.");
      const key = (j?.data?.key ?? j?.key) as string | undefined;
      await refreshTakes(token);
      if (key) onChange({ kind: "take", key });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no envio — tente de novo.");
    } finally {
      setUploading(false);
    }
  }

  const mm = String(Math.floor(seconds / 60));
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div>
      <div className="flex flex-wrap gap-2 text-[13px]">
        {([["history", "Meus áudios"], ["record", "Gravar agora"], ["upload", "Subir arquivo"]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={[
              "rounded-full border px-3 py-1",
              tab === k ? "border-[var(--ink)] text-[var(--ink)]" : "border-[var(--hairline)] text-[var(--mute)]",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <div className="mt-3">
          <select
            value={value?.kind === "generation" ? value.id : ""}
            onChange={(e) => onChange(e.target.value ? { kind: "generation", id: e.target.value } : null)}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)]"
          >
            <option value="">Escolha um áudio da sua voz…</option>
            {audios.slice(0, 40).map((a) => (
              <option key={a.id} value={a.id}>
                {(a.name || a.text_raw.slice(0, 60)) +
                  (a.duration_seconds ? ` · ${Math.round(a.duration_seconds)}s` : "")}
              </option>
            ))}
          </select>
          {audios.length === 0 && (
            <p className="mt-1.5 text-[12.5px] text-[var(--mute)]">
              Você ainda não tem áudios prontos — gere um na aba de voz, ou use “Gravar agora”.
            </p>
          )}
        </div>
      ) : tab === "upload" ? (
        <div className="mt-3 flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 self-start rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-4 py-2 text-[13px] font-medium text-[var(--ink)]">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadIcon className="size-4" />}
            {uploading ? "Enviando…" : "Escolher arquivo de áudio"}
            <input
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg"
              className="hidden"
              disabled={uploading || !token}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void enviarArquivo(f);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-[12px] text-[var(--ash)]">MP3, WAV ou M4A · máx 2 minutos e 25MB. O arquivo fica salvo nos seus takes.</p>
          {error && (
            <p className="flex items-start gap-1.5 text-[12.5px] text-red-400">
              <AlertTriangle className="mt-0.5 size-3.5 flex-none" /> {error}
            </p>
          )}
          {value?.kind === "take" && (
            <p className="text-[12.5px] text-emerald-300">Áudio enviado e selecionado ✓</p>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (recording ? recRef.current?.stop() : void start())}
              disabled={uploading || !token}
              className={[
                "flex size-12 flex-none items-center justify-center rounded-full border-2 transition-transform active:scale-95 disabled:opacity-40",
                recording ? "border-red-500 bg-red-500/15" : "border-[var(--hairline-strong)] bg-[var(--surface-deep)]",
              ].join(" ")}
              aria-label={recording ? "Parar gravação" : "Gravar"}
            >
              {uploading ? (
                <Loader2 className="size-5 animate-spin text-[var(--mute)]" />
              ) : recording ? (
                <Square className="size-4 fill-red-400 text-red-400" />
              ) : (
                <Mic className="size-5 text-[var(--ink)]" />
              )}
            </button>
            <div className="text-[13px]">
              {recording ? (
                <span className="font-mono tabular-nums text-red-400">{mm}:{ss} · clique pra parar</span>
              ) : uploading ? (
                <span className="text-[var(--mute)]">salvando a gravação…</span>
              ) : (
                <span className="text-[var(--mute)]">Clique pra gravar com o microfone (máx 2min)</span>
              )}
              <p className="text-[12px] text-[var(--ash)]">
                A gravação fica salva nos seus takes e pode ser usada depois no treino da sua voz.
              </p>
            </div>
          </div>

          {error && (
            <p className="flex items-start gap-1.5 text-[12.5px] text-red-400">
              <AlertTriangle className="mt-0.5 size-3.5 flex-none" /> {error}
            </p>
          )}

          {takes.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {takes.slice(0, 8).map((t) => {
                const sel = value?.kind === "take" && value.key === t.key;
                return (
                  <li key={t.key}>
                    <label
                      className={[
                        "flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] border px-3 py-2",
                        sel ? "border-[var(--ink)]" : "border-[var(--hairline)]",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="heygen-take"
                        checked={sel}
                        onChange={() => onChange({ kind: "take", key: t.key })}
                        className="accent-[var(--ink)]"
                      />
                      <span className="truncate text-[12.5px] text-[var(--ink)]">{t.name}</span>
                      <audio src={t.url} controls preload="none" className="ml-auto h-8 max-w-[220px]" />
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
