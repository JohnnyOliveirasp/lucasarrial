"use client";

/**
 * 🧪 Lab · Gravador pelo Celular — tela do CELULAR (aberta pelo link/QR,
 * sem login). Botão grandão de gravar (até 5min por take), sobe cada take
 * pro servidor na hora e mostra a lista do que já subiu.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Check, AlertTriangle } from "lucide-react";

const MAX_SECONDS = 300;

type Take = { name: string; size: number };

export function PhoneRecorderMobile({ token }: { token: string }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [takes, setTakes] = useState<Take[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/v1/recorder-test/takes", { headers: { "x-recorder-token": token } });
      const j = await res.json();
      if (res.ok) setTakes((j.takes ?? []).map((t: { name: string; size: number }) => ({ name: t.name, size: t.size })));
    } catch { /* silencioso */ }
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
    recRef.current = null;
    setRecording(false);
    setSeconds(0);
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Pro TESTE de qualidade: captura CRUA — sem NR/AGC do navegador,
        // pra ouvir o que o mic de lapela entrega de verdade.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
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
      rec.start();
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
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no envio — grave de novo.");
    } finally {
      setUploading(false);
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-[#0a0a0c] px-6 py-10 text-white">
      <div className="text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-neutral-500">FastCloner · Lab</p>
        <h1 className="mt-1 font-sans text-[20px] font-semibold tracking-[-0.02em]">Gravador pelo celular</h1>
        <p className="mt-2 max-w-[38ch] text-[13px] leading-relaxed text-neutral-400">
          Deixe o roteiro aberto no computador. Grave aqui — cada take sobe sozinho e aparece lá.
        </p>
      </div>

      <div className="flex flex-col items-center gap-5">
        {recording && (
          <span className="font-mono text-[28px] tabular-nums text-red-400">{mm}:{ss}</span>
        )}
        <button
          type="button"
          onClick={() => (recording ? recRef.current?.stop() : void start())}
          disabled={uploading}
          className={[
            "flex size-28 items-center justify-center rounded-full border-2 transition-transform active:scale-95 disabled:opacity-50",
            recording ? "border-red-500 bg-red-500/15" : "border-neutral-600 bg-neutral-900",
          ].join(" ")}
          aria-label={recording ? "Parar gravação" : "Gravar"}
        >
          {uploading ? (
            <Loader2 className="size-10 animate-spin text-neutral-400" />
          ) : recording ? (
            <Square className="size-9 fill-red-400 text-red-400" />
          ) : (
            <Mic className="size-11 text-neutral-200" />
          )}
        </button>
        <span className="font-mono text-[12px] text-neutral-500">
          {uploading ? "enviando…" : recording ? "toque pra parar" : "toque pra gravar (máx 5min)"}
        </span>
        {error && (
          <span className="flex max-w-[42ch] items-start gap-1.5 text-center text-[12px] text-red-400">
            <AlertTriangle className="mt-0.5 size-3.5 flex-none" /> {error}
          </span>
        )}
      </div>

      <div className="w-full max-w-sm">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
          Takes enviados · {takes.length}
        </p>
        <ul className="flex flex-col gap-1.5">
          {takes.map((t) => (
            <li key={t.name} className="flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 font-mono text-[11px] text-neutral-300">
              <Check className="size-3.5 flex-none text-emerald-400" />
              <span className="truncate">{t.name}</span>
              <span className="ml-auto flex-none text-neutral-500">{Math.round(t.size / 1024)}KB</span>
            </li>
          ))}
          {takes.length === 0 && <li className="font-mono text-[11px] text-neutral-600">nenhum ainda</li>}
        </ul>
      </div>
    </div>
  );
}
