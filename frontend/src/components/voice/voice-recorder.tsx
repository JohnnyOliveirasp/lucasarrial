"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, AlertCircle } from "lucide-react";
import { workletUrl, rms, concatFloat32, encodeWav } from "@/lib/audio/recorder";
import { formatDuration } from "@/lib/audio/duration";

const SPEECH_RMS = 0.015; // acima disso considera fala
const SILENCE_MS = 2000; // silêncio após falar → para automaticamente
const MAX_SECONDS = 300; // trava de segurança (5 min por clipe)

type Status = "idle" | "requesting" | "ready" | "recording" | "recorded" | "denied";

type Props = {
  /** Recebe o clipe gravado (WAV) + duração em segundos. Slice 2 usa pra subir. */
  onClip?: (blob: Blob, seconds: number) => void;
};

export function VoiceRecorder({ onClip }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const muteRef = useRef<GainNode | null>(null);
  const wUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const meterBufRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  const chunksRef = useRef<Float32Array[]>([]);
  const recordingRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const lastSpeechRef = useRef(0);
  const startedRef = useRef(0);
  const recordedUrlRef = useRef<string | null>(null);

  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    workletRef.current?.disconnect();
    analyserRef.current?.disconnect();
    muteRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    if (wUrlRef.current) URL.revokeObjectURL(wUrlRef.current);
    ctxRef.current = null;
    streamRef.current = null;
    analyserRef.current = null;
    workletRef.current = null;
    muteRef.current = null;
    wUrlRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      teardown();
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    };
  }, [teardown]);

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    const ctx = ctxRef.current;
    const samples = concatFloat32(chunksRef.current);
    if (!ctx || samples.length === 0) {
      setStatus("ready");
      return;
    }
    const dur = samples.length / ctx.sampleRate;
    const blob = encodeWav(samples, ctx.sampleRate);
    if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    const u = URL.createObjectURL(blob);
    recordedUrlRef.current = u;
    setRecordedUrl(u);
    setSeconds(dur);
    setStatus("recorded");
    onClip?.(blob, dur);
  }, [onClip]);

  const tick = useCallback(() => {
    const an = analyserRef.current;
    if (an) {
      const buf = meterBufRef.current ?? (meterBufRef.current = new Float32Array(an.fftSize));
      an.getFloatTimeDomainData(buf);
      const r = rms(buf);
      setLevel(Math.min(1, r * 6));
      if (recordingRef.current) {
        const now = performance.now();
        if (r > SPEECH_RMS) {
          hasSpokenRef.current = true;
          lastSpeechRef.current = now;
        }
        const elapsed = (now - startedRef.current) / 1000;
        setSeconds(Math.floor(elapsed));
        const silenceStopped =
          hasSpokenRef.current && now - lastSpeechRef.current > SILENCE_MS;
        if (silenceStopped || elapsed >= MAX_SECONDS) stopRecording();
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [stopRecording]);

  async function activateMic() {
    setError(null);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      await ctx.resume();
      const url = workletUrl();
      wUrlRef.current = url;
      await ctx.audioWorklet.addModule(url);

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;
      const worklet = new AudioWorkletNode(ctx, "pcm-processor");
      workletRef.current = worklet;
      const mute = ctx.createGain();
      mute.gain.value = 0;
      muteRef.current = mute;

      worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
        if (recordingRef.current) chunksRef.current.push(e.data);
      };

      source.connect(analyser);
      source.connect(worklet);
      worklet.connect(mute);
      mute.connect(ctx.destination);

      setStatus("ready");
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Permissão de microfone negada — libere o mic no navegador e tente de novo."
          : "Não consegui acessar o microfone.",
      );
      setStatus("denied");
    }
  }

  function startRecording() {
    chunksRef.current = [];
    hasSpokenRef.current = false;
    startedRef.current = performance.now();
    lastSpeechRef.current = performance.now();
    recordingRef.current = true;
    setSeconds(0);
    setStatus("recording");
  }

  const meterPct = Math.round(level * 100);

  return (
    <section className="border border-border bg-surface p-6 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-accent" />
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Gravar voz
        </h2>
      </div>

      {/* Medidor de nível */}
      {(status === "ready" || status === "recording") && (
        <div className="flex items-center gap-3">
          <div className="h-3 flex-1 bg-bg border border-border overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-75"
              style={{ width: `${meterPct}%` }}
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums text-muted-fg w-10 text-right">
            {formatDuration(seconds)}
          </span>
        </div>
      )}

      {status === "recording" && (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg">
          Gravando… para sozinho após {SILENCE_MS / 1000}s de silêncio
        </p>
      )}

      {/* Playback do clipe */}
      {status === "recorded" && recordedUrl && (
        <div className="flex flex-col gap-2">
          <audio src={recordedUrl} controls className="w-full" preload="metadata" />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-fg">
            Clipe de {formatDuration(seconds)}
          </span>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-2 border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        {(status === "idle" || status === "denied") && (
          <button
            type="button"
            onClick={activateMic}
            className="flex items-center gap-2 bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wide text-bg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-accent hover:text-accent-fg active:scale-[0.99]"
          >
            <Mic className="h-4 w-4" /> Ativar microfone
          </button>
        )}

        {status === "requesting" && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            Pedindo permissão…
          </span>
        )}

        {status === "ready" && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-fg hover:text-bg active:scale-[0.99]"
          >
            <Mic className="h-4 w-4" /> Gravar
          </button>
        )}

        {status === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2 border border-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:bg-accent hover:text-accent-fg active:scale-[0.99]"
          >
            <Square className="h-4 w-4" /> Parar
          </button>
        )}

        {status === "recorded" && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 bg-fg px-5 py-3 text-sm font-bold uppercase tracking-wide text-bg transition-all duration-[var(--dur-base)] ease-[var(--ease-snap)] hover:scale-[1.01] hover:bg-accent hover:text-accent-fg active:scale-[0.99]"
          >
            <RotateCcw className="h-4 w-4" /> Regravar
          </button>
        )}
      </div>
    </section>
  );
}
