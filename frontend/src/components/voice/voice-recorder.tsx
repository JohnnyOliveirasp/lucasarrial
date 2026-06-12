"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Mic, Square, Trash2, AlertCircle, AlertTriangle, Check, ArrowRight } from "lucide-react";
import { workletUrl, rms, concatFloat32, encodeWav } from "@/lib/audio/recorder";
import { formatDuration } from "@/lib/audio/duration";
import { saveClip, listClips, deleteClip, type StoredClip } from "@/lib/audio/clip-store";

const SPEECH_RMS = 0.015; // acima disso considera fala
const SILENCE_MS = 2000; // silêncio após falar → para automaticamente
const MAX_SECONDS = 300; // trava por clipe (limita RAM a ~57MB/clipe)
const CLIP_PEAK = 0.99; // saturação (clipping)
const TARGET_SECONDS = 20 * 60; // meta de fala pro treino

type Status = "idle" | "requesting" | "ready" | "recording" | "denied";
type ClipView = { id: string; seconds: number; createdAt: number; url: string };

/**
 * Gravador guiado: a pessoa lê o roteiro e grava CLIPES curtos (auto-stop por
 * silêncio). Cada clipe é persistido em IndexedDB (anti-perda) e listado. Slice
 * 2 vai subir os clipes do IndexedDB pro R2.
 */
export function VoiceRecorder() {
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("idle");
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [clipping, setClipping] = useState(false);
  const [clips, setClips] = useState<ClipView[]>([]);

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
  const clipsRef = useRef<ClipView[]>([]);
  clipsRef.current = clips;

  // Carrega clipes salvos (sobrevivem a reload) + cleanup.
  useEffect(() => {
    let alive = true;
    listClips()
      .then((stored) => {
        if (!alive) return;
        setClips(stored.map(toView));
      })
      .catch(() => {});
    return () => {
      alive = false;
      teardownAudio();
      clipsRef.current.forEach((c) => URL.revokeObjectURL(c.url));
    };
  }, []);

  function teardownAudio() {
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
  }

  const finalizeClip = useCallback((blob: Blob, secs: number) => {
    const clip: StoredClip = {
      id: crypto.randomUUID(),
      blob,
      seconds: secs,
      createdAt: Date.now(),
    };
    void saveClip(clip).catch(() => {});
    setClips((prev) => [...prev, toView(clip)]);
  }, []);

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    const ctx = ctxRef.current;
    const samples = concatFloat32(chunksRef.current);
    chunksRef.current = [];
    setStatus("ready");
    if (!ctx || samples.length === 0) return;
    const dur = samples.length / ctx.sampleRate;
    if (dur < 0.4) return; // descarta clique acidental
    finalizeClip(encodeWav(samples, ctx.sampleRate), dur);
  }, [finalizeClip]);

  const tick = useCallback(() => {
    const an = analyserRef.current;
    if (an) {
      const buf = meterBufRef.current ?? (meterBufRef.current = new Float32Array(an.fftSize));
      an.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const a = Math.abs(buf[i]);
        if (a > peak) peak = a;
      }
      const r = rms(buf);
      setLevel(Math.min(1, r * 6));
      if (recordingRef.current) {
        const now = performance.now();
        if (peak >= CLIP_PEAK) setClipping(true);
        if (r > SPEECH_RMS) {
          hasSpokenRef.current = true;
          lastSpeechRef.current = now;
        }
        const elapsed = (now - startedRef.current) / 1000;
        setSeconds(Math.floor(elapsed));
        const silenceStopped = hasSpokenRef.current && now - lastSpeechRef.current > SILENCE_MS;
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
    setClipping(false);
    setSeconds(0);
    setStatus("recording");
  }

  async function removeClip(id: string) {
    const c = clipsRef.current.find((x) => x.id === id);
    if (c) URL.revokeObjectURL(c.url);
    setClips((prev) => prev.filter((x) => x.id !== id));
    await deleteClip(id).catch(() => {});
  }

  const totalSeconds = clips.reduce((s, c) => s + c.seconds, 0);
  const pct = Math.min(100, Math.round((totalSeconds / TARGET_SECONDS) * 100));
  const meterPct = Math.round(level * 100);
  const showPill = status === "ready" || status === "recording";
  const targetMet = totalSeconds >= TARGET_SECONDS;

  return (
    <>
      {/* Pill flutuante (fixed bottom-right): Mic + Stop + Timer + mini meter.
          Aparece quando o mic está pronto/gravando pra acompanhar a leitura
          do roteiro sem precisar scrollar pro fim da página. */}
      {showPill && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)]/95 px-3 py-2 backdrop-blur-sm">
          {/* Mini medidor (5 barras verticais) — saída de áudio: canal ativo violeta */}
          <div className="flex h-6 items-end gap-0.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => {
              const active = meterPct / 100 >= (i + 1) / 5 * 0.4;
              return (
                <span
                  key={i}
                  className={`w-1 rounded-[var(--radius-full)] transition-all duration-75 ${
                    active ? "h-full bg-[var(--hue-violet)]" : "h-1.5 bg-[var(--hairline-strong)]"
                  }`}
                />
              );
            })}
          </div>
          {/* Timer do clipe atual */}
          <span className="w-10 text-center font-mono text-[11px] tabular-nums text-[var(--ink)]">
            {formatDuration(seconds)}
          </span>
          {/* Botão único Mic/Stop */}
          {status === "ready" ? (
            <button
              type="button"
              onClick={startRecording}
              aria-label="Gravar"
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-full)] bg-[var(--pill-bg)] text-[var(--pill-ink)] transition-transform hover:scale-110 active:scale-95"
            >
              <Mic className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              aria-label="Parar gravação"
              className="flex h-9 w-9 animate-pulse items-center justify-center rounded-[var(--radius-full)] border-2 border-[var(--status-error)] text-[var(--status-error)]"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          )}
        </div>
      )}

      <section className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-[var(--silver)]" />
        <h2 className="font-mono text-[12px] tracking-wide text-[var(--silver)]">Gravar voz</h2>
      </div>

      {/* Progresso acumulado (anti-perda: vem do IndexedDB) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between font-mono text-[10px] tracking-wide text-[var(--mute)]">
          <span>Fala acumulada</span>
          <span className="tabular-nums text-[var(--silver)]">
            {formatDuration(totalSeconds)} / {formatDuration(TARGET_SECONDS)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-[var(--radius-full)] bg-[var(--surface-deep)] border border-[var(--hairline-strong)]">
          <div className="h-full rounded-[var(--radius-full)] bg-[var(--silver)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Medidor de nível — saída de áudio ao vivo: violeta */}
      {(status === "ready" || status === "recording") && (
        <div className="flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-[var(--radius-full)] bg-[var(--surface-deep)] border border-[var(--hairline-strong)]">
            <div
              className="h-full rounded-[var(--radius-full)] bg-[var(--hue-violet)] transition-[width] duration-75"
              style={{ width: `${meterPct}%` }}
            />
          </div>
          <span className="w-10 text-right font-mono text-[10px] tabular-nums text-[var(--mute)]">
            {formatDuration(seconds)}
          </span>
        </div>
      )}

      {clipping && (
        <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--status-warn)]/40 bg-[var(--surface-deep)] px-3 py-2 font-mono text-[10px] tracking-wide text-[var(--status-warn)]">
          <AlertTriangle className="h-4 w-4" /> Áudio estourando — afaste o microfone ou fale mais baixo
        </p>
      )}

      {status === "recording" && (
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-wide text-[var(--mute)]">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-[var(--radius-full)] bg-[var(--status-error)]" />
          Gravando… para sozinho após {SILENCE_MS / 1000}s de silêncio
        </p>
      )}

      {error && (
        <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-deep)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        {(status === "idle" || status === "denied") && (
          <button type="button" onClick={activateMic} className={btnPrimary}>
            <Mic className="h-4 w-4" /> Ativar microfone
          </button>
        )}
        {status === "requesting" && (
          <span className="font-mono text-[12px] tracking-wide text-[var(--silver)]">Pedindo permissão…</span>
        )}
        {status === "ready" && (
          <button type="button" onClick={startRecording} className={btnPrimary}>
            <Mic className="h-4 w-4" /> Gravar
          </button>
        )}
        {status === "recording" && (
          <button type="button" onClick={stopRecording} className={btnOutline}>
            <Square className="h-4 w-4" /> Parar
          </button>
        )}
      </div>

      {/* Lista de clipes gravados */}
      {clips.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-4">
          <span className="font-mono text-[10px] tracking-wide text-[var(--mute)]">
            Áudios gravados ({clips.length})
          </span>
          {clips.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="w-6 font-mono text-[10px] tabular-nums text-[var(--ash)]">{i + 1}</span>
              <audio src={c.url} controls className="h-9 flex-1" preload="metadata" />
              <span className="w-10 text-right font-mono text-[10px] tabular-nums text-[var(--mute)]">
                {formatDuration(c.seconds)}
              </span>
              <button
                type="button"
                onClick={() => removeClip(c.id)}
                aria-label="Apagar clipe"
                className="text-[var(--mute)] transition-colors hover:text-[var(--status-error)]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CTA enviar pra treinamento — aparece ao bater 20min. Usuário
          pode continuar gravando (CTA fica disponível, não bloqueia). */}
      {targetMet && (
        <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline-bright)] bg-[var(--surface-elevated)] p-4">
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-wide text-[var(--status-online)]">
            <Check className="h-4 w-4" /> Meta de 20 min atingida
          </p>
          <Link
            href={`/${locale}/app/voice-cloning/new`}
            className={`${btnOutline} justify-center`}
          >
            Enviar para treinamento <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-xs text-[var(--mute)]">
            Pode continuar gravando se quiser melhorar — quanto mais limpo, melhor a voz clonada.
          </p>
        </div>
      )}
    </section>
    </>
  );
}

function toView(c: StoredClip): ClipView {
  return { id: c.id, seconds: c.seconds, createdAt: c.createdAt, url: URL.createObjectURL(c.blob) };
}

const btnPrimary =
  "inline-flex h-10 items-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]";
const btnOutline =
  "inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]";
