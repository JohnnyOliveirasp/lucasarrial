"use client";

/**
 * Gravador de voz do chat de ajuda (estilo WhatsApp): toque pra gravar,
 * toque pra enviar, X pra cancelar. Auto-para em 60s. Devolve o blob
 * gravado via callback — o widget converte e envia.
 */
import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 60;

export function useVoiceRecorder(onFinish: (blob: Blob, mimeType: string) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- só no unmount
  useEffect(() => () => stop(true), []); // desmontou no meio → cancela

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
    recRef.current = null;
    setRecording(false);
    setSeconds(0);
  }

  async function start(): Promise<boolean> {
    if (recording) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      cancelledRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        cleanup();
        if (!cancelledRef.current && blob.size > 0) {
          onFinish(blob, type.split(";")[0]);
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop(false); // limite → envia o que tem
          return s + 1;
        });
      }, 1000);
      return true;
    } catch {
      return false; // sem permissão de microfone
    }
  }

  function stop(cancel: boolean) {
    cancelledRef.current = cancel;
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.stop(); // onstop faz o cleanup
    } else {
      cleanup();
    }
  }

  return { recording, seconds, start, stop };
}
